'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { gerarParcelas, montarCodigo, type InputCalculoParcelas } from '@/lib/crm/calculos'

export type GarantiaTipo = 'fiador' | 'caucao' | 'seguro_fianca' | 'sem_garantia'

export interface ContratoInput {
  imovel_id: string
  inquilino_id: string
  proprietario_id: string

  valor_aluguel: number
  valor_seguro_fianca_mensal: number
  valor_seguro_incendio_anual: number | null
  seguro_incendio_data: string | null
  iptu_mensal: number
  condominio_mensal: number

  taxa_admin_tipo: 'percentual' | 'fixo'
  taxa_admin_valor: number

  primeira_parcela_cheia: boolean

  garantia_tipo: GarantiaTipo
  fiador_id: string | null
  caucao_valor: number | null
  seguro_fianca_seguradora: string | null
  seguro_fianca_apolice: string | null

  data_inicio: string
  data_primeiro_aluguel: string
  data_termino: string | null
  duracao_meses: number
  dia_vencimento: number

  forma_pagamento: 'boleto' | 'pix' | 'transferencia' | 'dinheiro' | 'cheque'
  observacoes: string | null
  clausulas_extras: string | null
  indice_reajuste: string | null
  data_proximo_reajuste: string | null
}

function valida(input: ContratoInput): string | null {
  if (!input.imovel_id) return 'Escolha o imóvel.'
  if (!input.inquilino_id) return 'Escolha o inquilino.'
  if (!input.proprietario_id) return 'Escolha o proprietário.'
  if (!input.valor_aluguel || input.valor_aluguel <= 0) return 'Valor do aluguel inválido.'
  if (!input.duracao_meses || input.duracao_meses < 1) return 'Duração inválida.'
  if (!input.dia_vencimento || input.dia_vencimento < 1 || input.dia_vencimento > 31) return 'Dia de vencimento inválido (1 a 31).'
  if (!input.data_inicio) return 'Data de início obrigatória.'
  if (!input.data_primeiro_aluguel) return 'Data do 1º aluguel obrigatória.'
  if (input.garantia_tipo === 'fiador' && !input.fiador_id) return 'Selecione o fiador.'
  if (input.garantia_tipo === 'caucao' && (!input.caucao_valor || input.caucao_valor <= 0)) return 'Valor de caução inválido.'
  if (input.garantia_tipo === 'seguro_fianca') {
    if (!input.seguro_fianca_seguradora?.trim()) return 'Informe a seguradora.'
    if (!input.seguro_fianca_apolice?.trim()) return 'Informe o número da apólice.'
  }
  return null
}

async function proximoCodigo(userId: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const ano = new Date().getFullYear()
  const prefixo = `${ano}CT`
  const { data } = await supabase
    .from('contratos_locacao')
    .select('codigo')
    .eq('user_id', userId)
    .like('codigo', `${prefixo}%`)
    .order('codigo', { ascending: false })
    .limit(1)
    .maybeSingle()

  let proximo = 1
  if (data?.codigo) {
    const n = parseInt(data.codigo.slice(prefixo.length), 10)
    if (Number.isFinite(n)) proximo = n + 1
  }
  return montarCodigo(ano, proximo)
}

export async function criarContrato(input: ContratoInput) {
  const erro = valida(input)
  if (erro) return { error: erro }

  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  // 1. Próximo código sequencial
  const codigo = await proximoCodigo(acesso.userId, supabase)

  // 2. Insere o contrato
  const { data: contrato, error } = await supabase
    .from('contratos_locacao')
    .insert({
      user_id: acesso.userId,
      codigo,
      imovel_id: input.imovel_id,
      inquilino_id: input.inquilino_id,
      proprietario_id: input.proprietario_id,
      valor_aluguel: input.valor_aluguel,
      valor_seguro_fianca_mensal: input.valor_seguro_fianca_mensal,
      valor_seguro_incendio_anual: input.valor_seguro_incendio_anual,
      seguro_incendio_data: input.seguro_incendio_data,
      iptu_mensal: input.iptu_mensal,
      condominio_mensal: input.condominio_mensal,
      taxa_admin_tipo: input.taxa_admin_tipo,
      taxa_admin_valor: input.taxa_admin_valor,
      primeira_parcela_cheia: input.primeira_parcela_cheia,
      garantia_tipo: input.garantia_tipo,
      fiador_id: input.fiador_id,
      caucao_valor: input.caucao_valor,
      seguro_fianca_seguradora: input.seguro_fianca_seguradora,
      seguro_fianca_apolice: input.seguro_fianca_apolice,
      data_inicio: input.data_inicio,
      data_primeiro_aluguel: input.data_primeiro_aluguel,
      data_termino: input.data_termino,
      duracao_meses: input.duracao_meses,
      dia_vencimento: input.dia_vencimento,
      status: 'ativo',
      forma_pagamento: input.forma_pagamento,
      observacoes: input.observacoes,
      clausulas_extras: input.clausulas_extras,
      indice_reajuste: input.indice_reajuste,
      data_proximo_reajuste: input.data_proximo_reajuste,
    })
    .select('id, codigo')
    .single()

  if (error || !contrato) return { error: error?.message ?? 'Falha ao criar contrato.' }

  // 3. Gera as parcelas
  const calcInput: InputCalculoParcelas = {
    duracao_meses: input.duracao_meses,
    data_primeiro_aluguel: input.data_primeiro_aluguel,
    dia_vencimento: input.dia_vencimento,
    valor_aluguel: input.valor_aluguel,
    valor_seguro_fianca_mensal: input.valor_seguro_fianca_mensal,
    iptu_mensal: input.iptu_mensal,
    condominio_mensal: input.condominio_mensal,
    taxa_admin_tipo: input.taxa_admin_tipo,
    taxa_admin_valor: input.taxa_admin_valor,
    primeira_parcela_cheia: input.primeira_parcela_cheia,
  }
  const parcelas = gerarParcelas(calcInput)
  const parcelasPayload = parcelas.map(p => ({
    contrato_id: contrato.id,
    numero: p.numero,
    mes_referencia: p.mes_referencia,
    vencimento: p.vencimento,
    valor_aluguel: p.valor_aluguel,
    valor_seguro: p.valor_seguro,
    valor_iptu: p.valor_iptu,
    valor_condominio: p.valor_condominio,
    valor_total: p.valor_total,
    valor_comissao: p.valor_comissao,
    valor_repasse_proprietario: p.valor_repasse_proprietario,
    status_seguro: p.valor_seguro > 0 ? 'pendente' : 'sem_seguro',
  }))

  const { error: errParcelas } = await supabase.from('parcelas_aluguel').insert(parcelasPayload)
  if (errParcelas) {
    // Rollback: apaga o contrato pra não ficar inconsistente
    await supabase.from('contratos_locacao').delete().eq('id', contrato.id)
    return { error: `Falha ao gerar parcelas: ${errParcelas.message}` }
  }

  // 4. Vincula proprietário ao imóvel (se ainda não tinha)
  await supabase
    .from('imoveis')
    .update({ proprietario_id: input.proprietario_id })
    .eq('id', input.imovel_id)
    .is('proprietario_id', null)

  revalidatePath('/painel/contratos')
  revalidatePath('/painel/financeiro')

  return { ok: true, id: contrato.id, codigo: contrato.codigo }
}

// ───────────────── Ações sobre parcelas ─────────────────

export interface MarcarPagamentoInput {
  parcela_id: string
  data_pagamento: string    // YYYY-MM-DD
  valor_pago: number
  juros_multa?: number
  desconto?: number
  observacoes?: string
}

export async function marcarPagamento(input: MarcarPagamentoInput) {
  await exigirAcessoCRM()
  const supabase = await createClient()

  const { error } = await supabase
    .from('parcelas_aluguel')
    .update({
      status_pagamento: 'pago',
      data_pagamento: input.data_pagamento,
      valor_pago: input.valor_pago,
      juros_multa: input.juros_multa ?? 0,
      desconto: input.desconto ?? 0,
      observacoes: input.observacoes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.parcela_id)

  if (error) return { error: error.message }
  revalidatePath('/painel/contratos')
  revalidatePath('/painel/financeiro')
  return { ok: true }
}

export async function desfazerPagamento(parcelaId: string) {
  await exigirAcessoCRM()
  const supabase = await createClient()
  const { error } = await supabase
    .from('parcelas_aluguel')
    .update({
      status_pagamento: 'pendente',
      data_pagamento: null,
      valor_pago: null,
      juros_multa: 0,
      desconto: 0,
    })
    .eq('id', parcelaId)
  if (error) return { error: error.message }
  revalidatePath('/painel/contratos')
  return { ok: true }
}

export async function alternarRepasse(parcelaId: string, novo: 'pendente' | 'pago') {
  await exigirAcessoCRM()
  const supabase = await createClient()
  const { error } = await supabase
    .from('parcelas_aluguel')
    .update({ status_repasse: novo })
    .eq('id', parcelaId)
  if (error) return { error: error.message }
  revalidatePath('/painel/contratos')
  return { ok: true }
}

export async function alternarSeguro(parcelaId: string, novo: 'pendente' | 'pago' | 'sem_seguro') {
  await exigirAcessoCRM()
  const supabase = await createClient()
  const { error } = await supabase
    .from('parcelas_aluguel')
    .update({ status_seguro: novo })
    .eq('id', parcelaId)
  if (error) return { error: error.message }
  revalidatePath('/painel/contratos')
  return { ok: true }
}

export async function alternarBoletoEnviado(parcelaId: string, enviado: boolean) {
  await exigirAcessoCRM()
  const supabase = await createClient()
  const { error } = await supabase
    .from('parcelas_aluguel')
    .update({ boleto_enviado: enviado })
    .eq('id', parcelaId)
  if (error) return { error: error.message }
  revalidatePath('/painel/contratos')
  return { ok: true }
}

// ───────────────── Edição do contrato ─────────────────

export interface ContratoEditavel {
  status?: 'ativo' | 'encerrado' | 'rescindido' | 'inadimplente' | 'rascunho'
  data_termino?: string | null
  observacoes?: string | null
  clausulas_extras?: string | null
  indice_reajuste?: string | null
  data_proximo_reajuste?: string | null
  vistoria_ok?: boolean
  termo_chaves_ok?: boolean
  forma_pagamento?: 'boleto' | 'pix' | 'transferencia' | 'dinheiro' | 'cheque'
}

export async function atualizarContrato(id: string, dados: ContratoEditavel) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { error } = await supabase
    .from('contratos_locacao')
    .update({
      ...dados,
      status_data: dados.status ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', acesso.userId)

  if (error) return { error: error.message }
  revalidatePath('/painel/contratos')
  revalidatePath(`/painel/contratos/${id}`)
  return { ok: true }
}

export async function excluirContrato(id: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  // Cascata: parcelas e documentos deletam junto pelo ON DELETE CASCADE
  const { error } = await supabase
    .from('contratos_locacao')
    .delete()
    .eq('id', id)
    .eq('user_id', acesso.userId)

  if (error) return { error: error.message }
  revalidatePath('/painel/contratos')
  return { ok: true }
}
