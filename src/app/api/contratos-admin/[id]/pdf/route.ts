import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ContratoDocument, type ContratoPDFData, type ContratoPDFClausula } from '@/lib/crm/contrato-pdf'
import { aplicarPlaceholders, type DadosContrato } from '@/lib/contratos/montar'
import React from 'react'

export const runtime = 'nodejs'
export const maxDuration = 60

function fmtCpf(s: string | null): string | null {
  if (!s) return null
  const d = s.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return s
}

function fmtCnpj(s: string | null): string | null {
  if (!s) return null
  const d = s.replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return s
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const admin = createAdminClient()

    // 1. Carrega contrato de administração + proprietário + imóvel
    const { data: c } = await admin
      .from('contratos_administracao')
      .select(`
        *,
        proprietario:pessoas!proprietario_id(
          nome, cpf_cnpj, rg, rg_orgao_emissor, rg_uf,
          nacionalidade, estado_civil, profissao,
          endereco_logradouro, endereco_numero, endereco_complemento,
          endereco_bairro, endereco_cidade, endereco_estado, endereco_cep
        ),
        imovel:imoveis(
          tipo, endereco_resumido, endereco_completo, endereco_numero, endereco_complemento,
          endereco_cep, descricao, descricao_real,
          matricula_cartorio, inscricao_municipal, uc_energia, matricula_agua,
          area_construida_m2, area_terreno_m2,
          cartorio_registro, livro_folha_matricula,
          bairro:bairros(nome)
        )
      `)
      .eq('id', id)
      .single()

    if (!c) return NextResponse.json({ error: 'Contrato de administração não encontrado' }, { status: 404 })
    if (c.user_id !== user.id) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    // 2. Perfil emitente (administradora)
    const { data: perfil } = await admin
      .from('perfis')
      .select(`
        nome, razao_social, cnpj, creci, creci_juridico, recibo_logo_url,
        endereco_logradouro, endereco_numero, endereco_bairro,
        endereco_cidade, endereco_uf, endereco_cep
      `)
      .eq('id', user.id)
      .maybeSingle()

    const cnpjFmt = perfil?.cnpj
      ? perfil.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
      : null
    const cepFmt = perfil?.endereco_cep
      ? perfil.endereco_cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')
      : null

    const adminEnderecoPartes = [
      perfil?.endereco_logradouro,
      perfil?.endereco_numero ? `nº ${perfil.endereco_numero}` : null,
      perfil?.endereco_bairro,
      perfil?.endereco_cidade && perfil?.endereco_uf
        ? `${perfil.endereco_cidade}-${perfil.endereco_uf}`
        : null,
      cepFmt ? `CEP ${cepFmt}` : null,
    ].filter(Boolean)

    // 3. Carrega TODAS as cláusulas tipo='administracao' ativas do user
    const { data: clausulasRaw } = await admin
      .from('contrato_clausulas')
      .select('id, titulo, corpo, numero')
      .eq('user_id', user.id)
      .eq('tipo', 'administracao')
      .eq('ativa', true)
      .order('numero', { ascending: true })

    if (!clausulasRaw || clausulasRaw.length === 0) {
      return NextResponse.json({
        error: 'Nenhuma cláusula de administração cadastrada. Vá em /painel/contratos/clausulas e reimporte o modelo.',
      }, { status: 400 })
    }

    // 4. Monta dados pros placeholders
    const prop = Array.isArray(c.proprietario) ? c.proprietario[0] : c.proprietario
    const im = Array.isArray(c.imovel) ? c.imovel[0] : c.imovel
    const bairro = im && (Array.isArray(im.bairro) ? im.bairro[0] : im.bairro)

    const dadosContrato: DadosContrato = {
      locador: prop,  // proprietário aparece como "LOCADOR" em alguns placeholders
      locatario: null,
      fiador: null,
      admin: perfil ? {
        nome: perfil.nome,
        razao_social: perfil.razao_social,
        cnpj: perfil.cnpj,
        creci: perfil.creci,
        creci_juridico: perfil.creci_juridico,
        endereco_logradouro: perfil.endereco_logradouro,
        endereco_numero: perfil.endereco_numero,
        endereco_bairro: perfil.endereco_bairro,
        endereco_cidade: perfil.endereco_cidade,
        endereco_uf: perfil.endereco_uf,
        endereco_cep: perfil.endereco_cep,
      } : null,
      imovel: im ? {
        ...im,
        bairro_nome: bairro?.nome ?? null,
      } : null,
      contrato: null,
      administracao: {
        codigo: c.codigo,
        data_inicio: c.data_inicio,
        data_termino: c.data_termino,
        prazo_meses: c.prazo_meses,
        taxa_tipo: c.taxa_tipo,
        taxa_valor: c.taxa_valor,
        dia_repasse: c.dia_repasse,
        aviso_previo_dias: c.aviso_previo_dias,
        multa_rescisao_meses: c.multa_rescisao_meses,
        exclusividade: c.exclusividade,
      },
    }

    const clausulas: ContratoPDFClausula[] = clausulasRaw.map((cl, idx) => ({
      numero: idx + 1,
      titulo: cl.titulo,
      corpo: aplicarPlaceholders(cl.corpo, dadosContrato),
    }))

    // 5. Monta data pro PDF
    const pdfData: ContratoPDFData = {
      codigo: c.codigo,
      data_assinatura: new Date().toISOString().slice(0, 10),
      anunciante_nome: perfil?.nome ?? 'AluguelCuiabá',
      anunciante_razao_social: perfil?.razao_social ?? null,
      anunciante_cnpj: fmtCnpj(perfil?.cnpj ?? null),
      anunciante_creci: perfil?.creci ?? null,
      anunciante_creci_juridico: perfil?.creci_juridico ?? null,
      anunciante_logo_url: perfil?.recibo_logo_url ?? null,
      anunciante_endereco: adminEnderecoPartes.length ? adminEnderecoPartes.join(', ') : null,
      anunciante_cidade_uf: perfil?.endereco_cidade && perfil?.endereco_uf
        ? `${perfil.endereco_cidade}-${perfil.endereco_uf}`
        : null,
      locador_nome: prop?.nome ?? '[PREENCHER]',
      locador_cpf: fmtCpf(prop?.cpf_cnpj ?? null),
      tem_administracao: true,
      admin_responsavel_nome: perfil?.nome ?? null,
      admin_responsavel_creci: perfil?.creci ?? null,
      // No contrato de administração não há locatário/cônjuge/fiador
      locatario_nome: prop?.nome ?? '[PREENCHER]',  // pra capa
      locatario_cpf: fmtCpf(prop?.cpf_cnpj ?? null),
      conjuge_nome: null,
      conjuge_cpf: null,
      moradores_adicionais: [],
      fiador_nome: null,
      fiador_cpf: null,
      testemunhas: [],
      clausulas_seguradora_texto: null,
      clausulas,
      quadro_entrada: [],
      tabela_12_meses: [],
      termo_chaves: null,
    }

    const element = React.createElement(ContratoDocument, { data: pdfData }) as unknown as React.ReactElement<DocumentProps>
    const buffer = await renderToBuffer(element)

    const filename = `contrato-administracao-${c.codigo}.pdf`
    return new Response(new Uint8Array(buffer) as unknown as BodyInit, {
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
    console.error('[contrato-admin-pdf] erro:', msg, stack)
    return NextResponse.json(
      {
        error: 'Falha ao gerar PDF',
        detail: msg,
        stack: stack ? stack.split('\n').slice(0, 20).join('\n') : null,
      },
      { status: 500 }
    )
  }
}
