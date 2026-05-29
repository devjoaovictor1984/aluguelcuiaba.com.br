import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AditivoDocument, type AditivoPDFData } from '@/lib/crm/aditivo-pdf'
import React from 'react'

export const runtime = 'nodejs'
export const maxDuration = 60

function fmtCpf(s: string | null | undefined): string | null {
  if (!s) return null
  const d = s.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return s
}

function fmtCnpj(s: string | null | undefined): string | null {
  if (!s) return null
  const d = s.replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return s
}

function fmtData(iso: string | null | undefined): string | null {
  if (!iso) return null
  const s = iso.slice(0, 10)
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

async function carimbarPaginacao(pdfBytes: Uint8Array, codigo: string): Promise<Uint8Array> {
  try {
    const pdf = await PDFDocument.load(pdfBytes)
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const paginas = pdf.getPages()
    const total = paginas.length
    paginas.forEach((page, i) => {
      const { width } = page.getSize()
      const texto = `Termo Aditivo · Contrato ${codigo}  ·  AluguelCuiaba.com.br  ·  Página ${i + 1} de ${total}`
      const size = 7
      const larguraTexto = font.widthOfTextAtSize(texto, size)
      page.drawText(texto, { x: (width - larguraTexto) / 2, y: 22, size, font, color: rgb(0.6, 0.6, 0.64) })
    })
    return await pdf.save()
  } catch (e) {
    console.error('[aditivo-pdf] falha ao carimbar paginação:', e)
    return pdfBytes
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ aditivoId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { aditivoId } = await params
    const admin = createAdminClient()

    // 1. Carrega o aditivo
    const { data: aditivo } = await admin
      .from('contratos_aditivos')
      .select('id, user_id, contrato_id, numero, data_aditivo, tipo, titulo, objeto')
      .eq('id', aditivoId)
      .maybeSingle()

    if (!aditivo || aditivo.user_id !== user.id) {
      return NextResponse.json({ error: 'Aditivo não encontrado' }, { status: 404 })
    }

    // 2. Carrega contrato + partes + imóvel
    const { data: contrato } = await admin
      .from('contratos_locacao')
      .select(`
        id, codigo, garantia_tipo, finalidade, conjuge_inquilino_papel,
        taxa_admin_valor, created_at,
        imovel:imoveis(
          endereco_resumido, endereco_completo, endereco_numero, endereco_complemento,
          endereco_bairro, bairro:bairros(nome)
        ),
        proprietario:pessoas!proprietario_id(nome, cpf_cnpj),
        inquilino:pessoas!inquilino_id(nome, cpf_cnpj, conjuge_nome, conjuge_cpf),
        fiador:pessoas!fiador_id(nome, cpf_cnpj)
      `)
      .eq('id', aditivo.contrato_id)
      .single()

    if (!contrato) return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })

    // 3. Perfil (administradora)
    const { data: perfil } = await admin
      .from('perfis')
      .select(`
        nome, razao_social, cnpj, creci, creci_juridico, recibo_logo_url,
        endereco_logradouro, endereco_numero, endereco_bairro,
        endereco_cidade, endereco_uf, endereco_cep
      `)
      .eq('id', user.id)
      .maybeSingle()

    const inq = Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino
    const prop = Array.isArray(contrato.proprietario) ? contrato.proprietario[0] : contrato.proprietario
    const fia = Array.isArray(contrato.fiador) ? contrato.fiador[0] : contrato.fiador
    const im = Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel
    const bairro = im && (Array.isArray(im.bairro) ? im.bairro[0] : im.bairro)

    // Endereço do imóvel
    let endereco = ''
    if (im?.endereco_completo) {
      endereco = [
        im.endereco_completo,
        im.endereco_numero ? `nº ${im.endereco_numero}` : null,
        im.endereco_complemento,
        im.endereco_bairro ?? bairro?.nome,
      ].filter(Boolean).join(', ')
    } else if (im?.endereco_resumido) {
      endereco = `${im.endereco_resumido}${bairro?.nome ? `, ${bairro.nome}` : ''}`
    }

    // Endereço da administradora
    const cepFmt = perfil?.endereco_cep ? perfil.endereco_cep.replace(/^(\d{5})(\d{3})$/, '$1-$2') : null
    const adminEndereco = [
      perfil?.endereco_logradouro,
      perfil?.endereco_numero ? `nº ${perfil.endereco_numero}` : null,
      perfil?.endereco_bairro,
      perfil?.endereco_cidade && perfil?.endereco_uf ? `${perfil.endereco_cidade}-${perfil.endereco_uf}` : null,
      cepFmt ? `CEP ${cepFmt}` : null,
    ].filter(Boolean).join(', ')

    const temAdministracao = (contrato.taxa_admin_valor ?? 0) > 0

    // Data do contrato originário (registro)
    const dataAssinatura = fmtData(contrato.created_at ?? null)

    const data: AditivoPDFData = {
      anunciante_nome: perfil?.nome ?? 'AluguelCuiabá',
      anunciante_razao_social: perfil?.razao_social ?? null,
      anunciante_cnpj: fmtCnpj(perfil?.cnpj),
      anunciante_creci: perfil?.creci ?? null,
      anunciante_creci_juridico: perfil?.creci_juridico ?? null,
      anunciante_logo_url: perfil?.recibo_logo_url ?? null,
      anunciante_endereco: adminEndereco || null,
      anunciante_cidade_uf: perfil?.endereco_cidade && perfil?.endereco_uf
        ? `${perfil.endereco_cidade}-${perfil.endereco_uf}` : null,

      contrato_codigo: contrato.codigo,
      contrato_data_assinatura: dataAssinatura,
      imovel_endereco: endereco,
      finalidade: (contrato.finalidade ?? 'residencial') as 'residencial' | 'comercial' | 'misto',

      locador_nome: prop?.nome ?? '[PREENCHER]',
      locador_cpf: fmtCpf(prop?.cpf_cnpj),
      tem_administracao: temAdministracao,
      admin_responsavel_nome: perfil?.nome ?? null,
      admin_responsavel_creci: perfil?.creci ?? null,

      locatario_nome: inq?.nome ?? '[PREENCHER]',
      locatario_cpf: fmtCpf(inq?.cpf_cnpj),
      conjuge_nome: inq?.conjuge_nome ?? null,
      conjuge_cpf: fmtCpf(inq?.conjuge_cpf),
      conjuge_papel: (contrato.conjuge_inquilino_papel ?? 'solidario') as 'solidario' | 'anuente' | 'nao_participa',

      fiador_nome: contrato.garantia_tipo === 'fiador' ? (fia?.nome ?? null) : null,
      fiador_cpf: contrato.garantia_tipo === 'fiador' ? fmtCpf(fia?.cpf_cnpj) : null,

      testemunhas: [],

      numero: aditivo.numero,
      data_aditivo: aditivo.data_aditivo,
      tipo: aditivo.tipo,
      titulo: aditivo.titulo,
      objeto: aditivo.objeto,
    }

    const element = React.createElement(AditivoDocument, { data }) as unknown as React.ReactElement<DocumentProps>
    const buffer = await renderToBuffer(element)
    const finalBytes = await carimbarPaginacao(new Uint8Array(buffer), contrato.codigo)

    const filename = `aditivo-${aditivo.numero}-${contrato.codigo}.pdf`
    return new Response(finalBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[aditivo-pdf] erro ao gerar:', msg, stack)
    return NextResponse.json(
      { error: 'Falha ao gerar PDF do aditivo', detail: msg, stack: stack ? stack.split('\n').slice(0, 20).join('\n') : null },
      { status: 500 }
    )
  }
}
