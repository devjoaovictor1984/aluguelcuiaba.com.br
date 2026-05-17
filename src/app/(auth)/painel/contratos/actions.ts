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

// ───────────────── Reajuste ─────────────────

export interface AplicarReajusteInput {
  contrato_id: string
  novo_valor_aluguel: number
  data_efetiva: string           // YYYY-MM-DD — primeira parcela afetada (mes_referencia)
  indice_usado?: string          // IGPM / IPCA / INPC / manual
  observacao?: string
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function aplicarReajuste(input: AplicarReajusteInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (input.novo_valor_aluguel <= 0) return { error: 'Valor do aluguel inválido.' }
  if (!input.data_efetiva) return { error: 'Data efetiva obrigatória.' }

  // 1. Contrato (precisa pegar taxa_admin pra recalcular comissão)
  const { data: contrato, error: errCtr } = await supabase
    .from('contratos_locacao')
    .select('id, valor_aluguel, taxa_admin_tipo, taxa_admin_valor, data_proximo_reajuste')
    .eq('id', input.contrato_id)
    .eq('user_id', acesso.userId)
    .single()
  if (errCtr || !contrato) return { error: 'Contrato não encontrado.' }

  const valorAntigo = Number(contrato.valor_aluguel)
  const valorNovo = round2(input.novo_valor_aluguel)
  if (valorNovo === valorAntigo) return { error: 'Novo valor é igual ao atual.' }

  const percentual = round2(((valorNovo / valorAntigo) - 1) * 100)

  // 2. Parcelas afetadas: não pagas, com mes_referencia >= data_efetiva
  const { data: parcelas, error: errPar } = await supabase
    .from('parcelas_aluguel')
    .select('id, valor_seguro, valor_iptu, valor_condominio, status_pagamento')
    .eq('contrato_id', input.contrato_id)
    .gte('mes_referencia', input.data_efetiva)
    .neq('status_pagamento', 'pago')

  if (errPar) return { error: errPar.message }
  if (!parcelas || parcelas.length === 0) {
    return { error: 'Nenhuma parcela elegível (todas pagas ou data efetiva no futuro demais).' }
  }

  // 3. Recalcula cada uma e atualiza em série (poderia ser bulk via RPC, mas N é pequeno)
  const tipo = contrato.taxa_admin_tipo as 'percentual' | 'fixo'
  const taxa = Number(contrato.taxa_admin_valor)

  for (const p of parcelas) {
    const seguro = Number(p.valor_seguro) || 0
    const iptu = Number(p.valor_iptu) || 0
    const condo = Number(p.valor_condominio) || 0
    const total = round2(valorNovo + seguro + iptu + condo)
    const comissao = tipo === 'fixo' ? round2(taxa) : round2((valorNovo * taxa) / 100)
    const repasse = round2(valorNovo - comissao)

    const { error: errUp } = await supabase
      .from('parcelas_aluguel')
      .update({
        valor_aluguel: valorNovo,
        valor_total: total,
        valor_comissao: comissao,
        valor_repasse_proprietario: repasse,
      })
      .eq('id', p.id)
    if (errUp) return { error: `Falha ao atualizar parcela: ${errUp.message}` }
  }

  // 4. Atualiza valor de referência + próxima janela de reajuste (+12 meses)
  const proxReajuste = (() => {
    const d = new Date(input.data_efetiva + 'T00:00:00')
    d.setMonth(d.getMonth() + 12)
    return d.toISOString().slice(0, 10)
  })()

  await supabase
    .from('contratos_locacao')
    .update({
      valor_aluguel: valorNovo,
      data_proximo_reajuste: proxReajuste,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.contrato_id)

  // 5. Registra no histórico
  const { error: errHist } = await supabase
    .from('reajustes_historico')
    .insert({
      contrato_id: input.contrato_id,
      user_id: acesso.userId,
      data_efetiva: input.data_efetiva,
      valor_antigo: valorAntigo,
      valor_novo: valorNovo,
      percentual,
      indice_usado: input.indice_usado ?? null,
      parcelas_afetadas: parcelas.length,
      observacao: input.observacao ?? null,
    })
  if (errHist) return { error: errHist.message }

  revalidatePath(`/painel/contratos/${input.contrato_id}`)
  revalidatePath('/painel/financeiro')
  return { ok: true, parcelas_afetadas: parcelas.length, percentual }
}

// ───────────────── Moradores adicionais ─────────────────

export type ParentescoMorador =
  | 'conjuge' | 'filho' | 'pai_mae' | 'irmao' | 'socio' | 'dependente' | 'outro'

export interface AdicionarMoradorInput {
  contrato_id: string
  pessoa_id: string
  parentesco: ParentescoMorador
  observacao?: string
}

export async function adicionarMorador(input: AdicionarMoradorInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  // Garante que o contrato é do user (RLS já cobre, mas falha rápido aqui)
  const { data: contrato } = await supabase
    .from('contratos_locacao')
    .select('id')
    .eq('id', input.contrato_id)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!contrato) return { error: 'Contrato não encontrado.' }

  const { error } = await supabase.from('contratos_moradores').insert({
    contrato_id: input.contrato_id,
    pessoa_id: input.pessoa_id,
    parentesco: input.parentesco,
    observacao: input.observacao ?? null,
  })
  if (error) {
    if (error.code === '23505') return { error: 'Essa pessoa já está cadastrada como morador.' }
    return { error: error.message }
  }
  revalidatePath(`/painel/contratos/${input.contrato_id}`)
  return { ok: true }
}

export async function atualizarMorador(
  moradorId: string,
  dados: { parentesco?: ParentescoMorador; observacao?: string | null }
) {
  await exigirAcessoCRM()
  const supabase = await createClient()
  const { error } = await supabase
    .from('contratos_moradores')
    .update(dados)
    .eq('id', moradorId)
  if (error) return { error: error.message }
  revalidatePath('/painel/contratos')
  return { ok: true }
}

export async function removerMorador(moradorId: string) {
  await exigirAcessoCRM()
  const supabase = await createClient()
  const { error } = await supabase
    .from('contratos_moradores')
    .delete()
    .eq('id', moradorId)
  if (error) return { error: error.message }
  revalidatePath('/painel/contratos')
  return { ok: true }
}

// ───────────────── Encerramento ─────────────────

export type MotivoEncerramento =
  | 'fim_natural'        // contrato chegou ao fim do prazo
  | 'rescisao_inquilino' // inquilino quis sair antes
  | 'rescisao_proprietario' // proprietário pediu o imóvel
  | 'inadimplencia'      // saída por falta de pagamento
  | 'acordo'             // saída por acordo entre as partes
  | 'outro'

export interface EncerrarContratoInput {
  motivo: MotivoEncerramento
  data_encerramento: string  // YYYY-MM-DD
  observacao?: string        // detalhamento livre
}

export async function encerrarContrato(id: string, input: EncerrarContratoInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  // fim_natural → 'encerrado'; demais motivos → 'rescindido'
  const novoStatus = input.motivo === 'fim_natural' ? 'encerrado' : 'rescindido'

  const { error } = await supabase
    .from('contratos_locacao')
    .update({
      status: novoStatus,
      motivo_encerramento: input.motivo,
      data_encerramento: input.data_encerramento,
      data_termino: input.data_encerramento,
      observacoes: input.observacao
        ? `[${novoStatus.toUpperCase()} em ${input.data_encerramento}] ${input.observacao}`
        : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', acesso.userId)

  if (error) return { error: error.message }

  // O trigger sincronizar_status_imovel libera o imóvel se não houver outro contrato ativo.
  revalidatePath('/painel/contratos')
  revalidatePath(`/painel/contratos/${id}`)
  revalidatePath('/painel/financeiro')
  return { ok: true }
}

// ───────────────── Renovação ─────────────────

export interface RenovarContratoInput {
  contrato_anterior_id: string
  data_inicio: string              // YYYY-MM-DD
  data_primeiro_aluguel: string    // YYYY-MM-DD
  duracao_meses: number
  dia_vencimento: number
  valor_aluguel: number            // novo valor (pode ter reajuste)
  valor_seguro_fianca_mensal?: number
  encerrar_anterior?: boolean      // default true
}

export async function renovarContrato(input: RenovarContratoInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  // 1. Busca o contrato anterior pra copiar os campos
  const { data: anterior, error: errAnt } = await supabase
    .from('contratos_locacao')
    .select('*')
    .eq('id', input.contrato_anterior_id)
    .eq('user_id', acesso.userId)
    .single()
  if (errAnt || !anterior) return { error: errAnt?.message ?? 'Contrato anterior não encontrado.' }

  // 2. Novo código sequencial
  const codigo = await proximoCodigo(acesso.userId, supabase)

  const dataTermino = (() => {
    const d = new Date(input.data_inicio + 'T00:00:00')
    d.setMonth(d.getMonth() + input.duracao_meses)
    return d.toISOString().slice(0, 10)
  })()

  // 3. Cria o novo contrato espelhando o anterior + overrides
  const seguroMensal = input.valor_seguro_fianca_mensal ?? anterior.valor_seguro_fianca_mensal

  const { data: novo, error } = await supabase
    .from('contratos_locacao')
    .insert({
      user_id: acesso.userId,
      codigo,
      imovel_id: anterior.imovel_id,
      inquilino_id: anterior.inquilino_id,
      proprietario_id: anterior.proprietario_id,
      valor_aluguel: input.valor_aluguel,
      valor_seguro_fianca_mensal: seguroMensal,
      valor_seguro_incendio_anual: anterior.valor_seguro_incendio_anual,
      seguro_incendio_data: anterior.seguro_incendio_data,
      iptu_mensal: anterior.iptu_mensal,
      condominio_mensal: anterior.condominio_mensal,
      taxa_admin_tipo: anterior.taxa_admin_tipo,
      taxa_admin_valor: anterior.taxa_admin_valor,
      // Em renovação a 1ª parcela cheia não se repete (já foi cobrada na original)
      primeira_parcela_cheia: false,
      garantia_tipo: anterior.garantia_tipo,
      fiador_id: anterior.fiador_id,
      caucao_valor: anterior.caucao_valor,
      seguro_fianca_seguradora: anterior.seguro_fianca_seguradora,
      seguro_fianca_apolice: anterior.seguro_fianca_apolice,
      data_inicio: input.data_inicio,
      data_primeiro_aluguel: input.data_primeiro_aluguel,
      data_termino: dataTermino,
      duracao_meses: input.duracao_meses,
      dia_vencimento: input.dia_vencimento,
      status: 'ativo',
      forma_pagamento: anterior.forma_pagamento,
      clausulas_extras: anterior.clausulas_extras,
      indice_reajuste: anterior.indice_reajuste,
      data_proximo_reajuste: anterior.data_proximo_reajuste,
      contrato_anterior_id: anterior.id,
      observacoes: `Renovação do contrato ${anterior.codigo}`,
    })
    .select('id, codigo')
    .single()

  if (error || !novo) return { error: error?.message ?? 'Falha ao criar renovação.' }

  // 4. Gera parcelas do novo contrato
  const calcInput: InputCalculoParcelas = {
    duracao_meses: input.duracao_meses,
    data_primeiro_aluguel: input.data_primeiro_aluguel,
    dia_vencimento: input.dia_vencimento,
    valor_aluguel: input.valor_aluguel,
    valor_seguro_fianca_mensal: seguroMensal,
    iptu_mensal: anterior.iptu_mensal,
    condominio_mensal: anterior.condominio_mensal,
    taxa_admin_tipo: anterior.taxa_admin_tipo,
    taxa_admin_valor: anterior.taxa_admin_valor,
    primeira_parcela_cheia: false,
  }
  const parcelas = gerarParcelas(calcInput)
  const parcelasPayload = parcelas.map(p => ({
    contrato_id: novo.id,
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

  const { error: errParc } = await supabase.from('parcelas_aluguel').insert(parcelasPayload)
  if (errParc) {
    await supabase.from('contratos_locacao').delete().eq('id', novo.id)
    return { error: `Falha ao gerar parcelas: ${errParc.message}` }
  }

  // 5. Encerra o anterior (se solicitado) — mantém imóvel sempre alugado durante a transição
  if (input.encerrar_anterior !== false) {
    await supabase
      .from('contratos_locacao')
      .update({
        status: 'encerrado',
        motivo_encerramento: 'fim_natural',
        data_encerramento: input.data_inicio,
        updated_at: new Date().toISOString(),
      })
      .eq('id', anterior.id)
      .eq('user_id', acesso.userId)
  }

  revalidatePath('/painel/contratos')
  revalidatePath(`/painel/contratos/${anterior.id}`)
  revalidatePath('/painel/financeiro')

  return { ok: true, id: novo.id, codigo: novo.codigo }
}
