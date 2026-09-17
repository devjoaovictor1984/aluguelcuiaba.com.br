import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validarTokenAssinatura } from '@/lib/crm/assinatura-token'
import { referenciaOriginario, referenciaOriginarioPadrao } from '@/lib/crm/contrato-originario'
import { lerClausulas } from '@/lib/crm/aditivo-clausulas'
import { DistratoDocument, type DistratoPDFData } from '@/lib/crm/distrato-pdf'
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

/** `codigo` null = contrato não assinado pela plataforma: o rodapé não cita o código interno. */
async function carimbarPaginacao(pdfBytes: Uint8Array, codigo: string | null): Promise<Uint8Array> {
  try {
    const pdf = await PDFDocument.load(pdfBytes)
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const paginas = pdf.getPages()
    const total = paginas.length
    paginas.forEach((page, i) => {
      const { width } = page.getSize()
      const texto = `Distrato${codigo ? ` · Contrato ${codigo}` : ''}  ·  AluguelCuiaba.com.br  ·  Página ${i + 1} de ${total}`
      const size = 7
      const larguraTexto = font.widthOfTextAtSize(texto, size)
      page.drawText(texto, { x: (width - larguraTexto) / 2, y: 22, size, font, color: rgb(0.6, 0.6, 0.64) })
    })
    return await pdf.save()
  } catch (e) {
    console.error('[distrato-pdf] falha ao carimbar paginação:', e)
    return pdfBytes
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ distratoId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { distratoId } = await params
    const admin = createAdminClient()

    // Token de signatário (?st=) primeiro, login depois — mesma regra do PDF
    // do contrato e do aditivo. O token é amarrado a ESTE distrato.
    const st = new URL(request.url).searchParams.get('st')
    const ownerId = (st ? await validarTokenAssinatura(admin, st, 'distrato_locacao', distratoId) : null) ?? user?.id ?? null
    if (!ownerId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // 1. Distrato
    const { data: distrato } = await admin
      .from('contratos_distratos')
      .select(`
        id, user_id, contrato_id, data_distrato, data_desocupacao, motivo, titulo, objeto,
        multa_valor, multa_dispensada, debitos_valor, caucao_devolver, acerto_observacao,
        quitacao_reciproca, testemunha_ids, contrato_originario_ref, clausulas, fechamento
      `)
      .eq('id', distratoId)
      .maybeSingle()

    if (!distrato || distrato.user_id !== ownerId) {
      return NextResponse.json({ error: 'Distrato não encontrado' }, { status: 404 })
    }

    // 1b. Testemunhas escolhidas. Filtra por user_id: o admin ignora RLS.
    const testemunhaIds = ((distrato.testemunha_ids ?? []) as string[]).slice(0, 2)
    const { data: testemunhasRaw } = testemunhaIds.length > 0
      ? await admin
          .from('pessoas')
          .select('id, nome, cpf_cnpj, rg, rg_orgao_emissor, rg_uf')
          .in('id', testemunhaIds)
          .eq('user_id', ownerId)
      : { data: [] as Array<{ id: string; nome: string; cpf_cnpj: string | null; rg: string | null; rg_orgao_emissor: string | null; rg_uf: string | null }> }
    const testemunhas = testemunhaIds
      .map(tid => (testemunhasRaw ?? []).find(t => t.id === tid))
      .filter((t): t is NonNullable<typeof t> => !!t)
      .map(t => ({
        nome: t.nome,
        cpf: fmtCpf(t.cpf_cnpj),
        rg: t.rg ? [t.rg, t.rg_orgao_emissor, t.rg_uf].filter(Boolean).join(' ') : null,
      }))

    // 1c. Assinaturas desenhadas na plataforma → por cima da linha de cada parte
    const { data: procAssin } = await admin
      .from('contrato_assinaturas')
      .select('id')
      .eq('tipo_contrato', 'distrato_locacao').eq('contrato_id', distratoId).neq('status', 'cancelado')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    const { data: sigsAssin } = procAssin
      ? await admin
          .from('contrato_assinatura_signatarios')
          .select('nome, assinatura_b64').eq('assinatura_id', procAssin.id).eq('status', 'assinado')
      : { data: [] as Array<{ nome: string; assinatura_b64: string | null }> }
    const assinaturas = (sigsAssin ?? [])
      .filter(s => s.assinatura_b64)
      .map(s => ({ nome: s.nome as string, imagem: s.assinatura_b64 as string }))

    // 2. Contrato + partes + imóvel
    const { data: contrato, error: contratoErr } = await admin
      .from('contratos_locacao')
      .select(`
        id, codigo, garantia_tipo, finalidade, conjuge_inquilino_papel,
        taxa_admin_valor, created_at,
        imovel:imoveis(
          endereco_resumido, endereco_completo, endereco_numero, endereco_complemento,
          bairro:bairros(nome)
        ),
        proprietario:pessoas!proprietario_id(nome, cpf_cnpj),
        inquilino:pessoas!inquilino_id(nome, cpf_cnpj, conjuge_nome, conjuge_cpf),
        fiador:pessoas!fiador_id(nome, cpf_cnpj)
      `)
      .eq('id', distrato.contrato_id)
      .single()

    if (contratoErr || !contrato) {
      return NextResponse.json(
        { error: 'Contrato não encontrado', detail: contratoErr?.message ?? null },
        { status: 404 }
      )
    }

    // 3. Perfil (administradora)
    const { data: perfil } = await admin
      .from('perfis')
      .select(`
        nome, razao_social, cnpj, creci, creci_juridico, recibo_logo_url,
        endereco_logradouro, endereco_numero, endereco_bairro,
        endereco_cidade, endereco_uf, endereco_cep
      `)
      .eq('id', ownerId)
      .maybeSingle()

    const inq = Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino
    const prop = Array.isArray(contrato.proprietario) ? contrato.proprietario[0] : contrato.proprietario
    const fia = Array.isArray(contrato.fiador) ? contrato.fiador[0] : contrato.fiador
    const im = Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel
    const bairro = im && (Array.isArray(im.bairro) ? im.bairro[0] : im.bairro)

    let endereco = ''
    if (im?.endereco_completo) {
      endereco = [
        im.endereco_completo,
        im.endereco_numero ? `nº ${im.endereco_numero}` : null,
        im.endereco_complemento,
        bairro?.nome,
      ].filter(Boolean).join(', ')
    } else if (im?.endereco_resumido) {
      endereco = `${im.endereco_resumido}${bairro?.nome ? `, ${bairro.nome}` : ''}`
    }

    const cepFmt = perfil?.endereco_cep ? perfil.endereco_cep.replace(/^(\d{5})(\d{3})$/, '$1-$2') : null
    const adminEndereco = [
      perfil?.endereco_logradouro,
      perfil?.endereco_numero ? `nº ${perfil.endereco_numero}` : null,
      perfil?.endereco_bairro,
      perfil?.endereco_cidade && perfil?.endereco_uf ? `${perfil.endereco_cidade}-${perfil.endereco_uf}` : null,
      cepFmt ? `CEP ${cepFmt}` : null,
    ].filter(Boolean).join(', ')

    const temAdministracao = (contrato.taxa_admin_valor ?? 0) > 0

    const originarioPadrao = await referenciaOriginarioPadrao(admin, 'locacao', { id: contrato.id, codigo: contrato.codigo })
    const referencia = referenciaOriginario(distrato.contrato_originario_ref, originarioPadrao)

    const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

    const data: DistratoPDFData = {
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
      contrato_referencia: referencia,
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

      // O fiador assina o distrato pra ficar exonerado da garantia.
      fiador_nome: contrato.garantia_tipo === 'fiador' ? (fia?.nome ?? null) : null,
      fiador_cpf: contrato.garantia_tipo === 'fiador' ? fmtCpf(fia?.cpf_cnpj) : null,

      testemunhas,
      assinaturas,

      data_distrato: distrato.data_distrato,
      data_desocupacao: distrato.data_desocupacao,
      motivo: distrato.motivo,
      titulo: distrato.titulo,
      objeto: distrato.objeto,

      multa_valor: num(distrato.multa_valor),
      multa_dispensada: !!distrato.multa_dispensada,
      debitos_valor: num(distrato.debitos_valor),
      caucao_devolver: num(distrato.caucao_devolver),
      acerto_observacao: distrato.acerto_observacao,
      quitacao_reciproca: distrato.quitacao_reciproca !== false,

      clausulas: lerClausulas(distrato.clausulas),
      fechamento: distrato.fechamento ?? null,
    }

    const element = React.createElement(DistratoDocument, { data }) as unknown as React.ReactElement<DocumentProps>
    const buffer = await renderToBuffer(element)
    const finalBytes = await carimbarPaginacao(new Uint8Array(buffer), originarioPadrao ? contrato.codigo : null)

    const filename = `distrato-${contrato.codigo}.pdf`
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
    console.error('[distrato-pdf] erro ao gerar:', msg, stack)
    return NextResponse.json(
      { error: 'Falha ao gerar PDF do distrato', detail: msg, stack: stack ? stack.split('\n').slice(0, 20).join('\n') : null },
      { status: 500 }
    )
  }
}
