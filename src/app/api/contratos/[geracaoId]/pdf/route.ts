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
  { params }: { params: Promise<{ geracaoId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { geracaoId } = await params
  const admin = createAdminClient()

  // 1. Carrega a geração
  const { data: geracao } = await admin
    .from('contrato_geracoes')
    .select('id, user_id, contrato_id, tipo_seguro_incendio, saida_sem_multa_12m, clausula_ids')
    .eq('id', geracaoId)
    .maybeSingle()

  if (!geracao || geracao.user_id !== user.id) {
    return NextResponse.json({ error: 'Geração não encontrada' }, { status: 404 })
  }

  // 2. Carrega contrato + pessoas + imóvel
  const { data: contrato } = await admin
    .from('contratos_locacao')
    .select(`
      id, codigo, valor_aluguel, iptu_mensal, condominio_mensal,
      data_inicio, data_termino, duracao_meses, dia_vencimento,
      garantia_tipo, caucao_valor,
      seguro_fianca_seguradora, seguro_fianca_apolice,
      valor_seguro_fianca_mensal, valor_seguro_incendio_anual,
      taxa_admin_tipo, taxa_admin_valor,
      imovel:imoveis(
        tipo, endereco_resumido, endereco_completo, endereco_numero, endereco_complemento,
        endereco_cep, descricao, descricao_real,
        matricula_cartorio, inscricao_municipal, uc_energia, matricula_agua,
        area_construida_m2, area_terreno_m2,
        bairro:bairros(nome)
      ),
      proprietario:pessoas!proprietario_id(
        nome, cpf_cnpj, rg, rg_orgao_emissor, rg_uf,
        nacionalidade, estado_civil, profissao,
        endereco_logradouro, endereco_numero, endereco_complemento,
        endereco_bairro, endereco_cidade, endereco_estado, endereco_cep
      ),
      inquilino:pessoas!inquilino_id(
        nome, cpf_cnpj, rg, rg_orgao_emissor, rg_uf,
        nacionalidade, estado_civil, regime_bens, profissao,
        data_nascimento, naturalidade, nome_pai, nome_mae,
        endereco_logradouro, endereco_numero, endereco_complemento,
        endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
        conjuge_nome, conjuge_cpf, conjuge_rg, conjuge_data_nascimento,
        conjuge_profissao, conjuge_nacionalidade
      ),
      fiador:pessoas!fiador_id(
        nome, cpf_cnpj, rg,
        endereco_logradouro, endereco_numero,
        endereco_cidade, endereco_estado
      )
    `)
    .eq('id', geracao.contrato_id)
    .single()

  if (!contrato) return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })

  // 2b. Carrega moradores adicionais (co-locatários solidários, moradores, sócios signatários)
  const { data: moradoresRaw } = await admin
    .from('contratos_moradores')
    .select(`
      papel, mora_no_imovel,
      pessoa:pessoas(nome, cpf_cnpj)
    `)
    .eq('contrato_id', geracao.contrato_id)

  // 3. Carrega perfil do usuário (administradora)
  const { data: perfil } = await admin
    .from('perfis')
    .select(`
      nome, razao_social, cnpj, creci, creci_juridico, recibo_logo_url,
      endereco_logradouro, endereco_numero, endereco_bairro,
      endereco_cidade, endereco_uf, endereco_cep
    `)
    .eq('id', user.id)
    .maybeSingle()

  // 4. Carrega as cláusulas selecionadas e mantém a ordem do array
  const ids = (geracao.clausula_ids ?? []) as string[]
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Nenhuma cláusula selecionada na geração' }, { status: 400 })
  }

  const { data: clausulasRaw } = await admin
    .from('contrato_clausulas')
    .select('id, titulo, corpo')
    .in('id', ids)

  const mapaClausulas = new Map((clausulasRaw ?? []).map(c => [c.id, c]))
  const clausulasOrdenadas = ids
    .map(id => mapaClausulas.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c)

  // 5. Monta os dados pra placeholders
  const inq = Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino
  const prop = Array.isArray(contrato.proprietario) ? contrato.proprietario[0] : contrato.proprietario
  const fia = Array.isArray(contrato.fiador) ? contrato.fiador[0] : contrato.fiador
  const im = Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel
  const bairro = im && (Array.isArray(im.bairro) ? im.bairro[0] : im.bairro)

  const dadosContrato: DadosContrato = {
    locador: prop,
    locatario: inq,
    fiador: fia,
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
    contrato: {
      codigo: contrato.codigo,
      valor_aluguel: contrato.valor_aluguel,
      iptu_mensal: contrato.iptu_mensal,
      condominio_mensal: contrato.condominio_mensal,
      data_inicio: contrato.data_inicio,
      data_termino: contrato.data_termino,
      duracao_meses: contrato.duracao_meses,
      dia_vencimento: contrato.dia_vencimento,
      caucao_valor: contrato.caucao_valor,
      seguro_fianca_seguradora: contrato.seguro_fianca_seguradora,
      seguro_fianca_apolice: contrato.seguro_fianca_apolice,
      valor_seguro_fianca_mensal: contrato.valor_seguro_fianca_mensal,
      valor_seguro_incendio_anual: contrato.valor_seguro_incendio_anual,
    },
  }

  // 6. Aplica placeholders em cada cláusula
  const clausulas: ContratoPDFClausula[] = clausulasOrdenadas.map((c, idx) => ({
    numero: idx + 1,
    titulo: c.titulo,
    corpo: aplicarPlaceholders(c.corpo, dadosContrato),
  }))

  // 7. Endereço da admin
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

  // Inferência: há administração imobiliária quando taxa_admin_valor > 0
  const temAdministracao = (contrato.taxa_admin_valor ?? 0) > 0

  // Mapeia papel técnico pra texto humano na folha de assinatura
  const labelPapel: Record<string, string> = {
    inquilino_solidario: 'Co-locatário solidário',
    morador: 'Morador',
    socio_signatario: 'Sócio signatário',
  }
  type MoradorRel = {
    papel: string
    mora_no_imovel: boolean
    pessoa: { nome: string; cpf_cnpj: string | null } | { nome: string; cpf_cnpj: string | null }[] | null
  }
  const moradoresAdicionais = (moradoresRaw ?? [])
    .map((m: MoradorRel) => {
      const p = Array.isArray(m.pessoa) ? m.pessoa[0] : m.pessoa
      if (!p?.nome) return null
      // Solidário sempre aparece; morador comum só se mora no imóvel
      if (m.papel === 'morador' && !m.mora_no_imovel) return null
      return {
        nome: p.nome,
        cpf: fmtCpf(p.cpf_cnpj),
        papel: labelPapel[m.papel] ?? m.papel,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // 8. Monta o data final do PDF
  const pdfData: ContratoPDFData = {
    codigo: contrato.codigo,
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
    tem_administracao: temAdministracao,
    admin_responsavel_nome: perfil?.nome ?? null,
    admin_responsavel_creci: perfil?.creci ?? null,
    locatario_nome: inq?.nome ?? '[PREENCHER]',
    locatario_cpf: fmtCpf(inq?.cpf_cnpj ?? null),
    conjuge_nome: inq?.conjuge_nome ?? null,
    conjuge_cpf: fmtCpf(inq?.conjuge_cpf ?? null),
    moradores_adicionais: moradoresAdicionais,
    fiador_nome: fia?.nome ?? null,
    fiador_cpf: fmtCpf(fia?.cpf_cnpj ?? null),
    testemunhas: [],  // preenchimento de testemunhas vem em iteração futura
    clausulas,
  }

  // 9. Renderiza
  const element = React.createElement(ContratoDocument, { data: pdfData }) as unknown as React.ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)

  const filename = `contrato-${contrato.codigo}.pdf`
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
