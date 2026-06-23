'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { gerarParcelas, montarCodigo, type InputCalculoParcelas } from '@/lib/crm/calculos'
import { PLANOS } from '@/lib/constants'

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

  // Pagamento à vista (v55): inquilino paga o período inteiro adiantado.
  // Parcelas entram já quitadas; repasse ao proprietário segue mensal.
  pagamento_antecipado: boolean
  data_pagamento_antecipado: string | null

  // Perfil do contrato (v37+): controla cláusulas auto-injetadas
  finalidade: 'residencial' | 'comercial' | 'misto'
  tipo_atuacao: 'administracao' | 'intermediacao' | 'direto'
  intermediador_assina: boolean
  tipo_mobilia: 'sem' | 'semi' | 'parcial' | 'total'
  tem_inventario_bens: boolean
  aceita_pet: 'sim' | 'nao' | 'autorizacao' | 'condominio'
  pet_observacao: string | null

  // Aluguel pacote (v38): quando o aluguel já inclui encargos
  aluguel_inclui_iptu: boolean
  aluguel_inclui_condominio: boolean
  aluguel_inclui_agua: boolean
  aluguel_inclui_energia: boolean
  aluguel_inclui_gas: boolean
  aluguel_inclui_internet: boolean
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
  // Considera só contratos ATIVOS (não apagados) — testes na lixeira não
  // ocupam número. O unique parcial (v47) permite reusar códigos de apagados.
  const { data } = await supabase
    .from('contratos_locacao')
    .select('codigo')
    .eq('user_id', userId)
    .like('codigo', `${prefixo}%`)
    .is('deleted_at', null)

  // Monta o conjunto de números já usados e acha o primeiro livre (preenche buracos)
  const usados = new Set<number>()
  for (const row of data ?? []) {
    const n = parseInt(row.codigo.slice(prefixo.length), 10)
    if (Number.isFinite(n)) usados.add(n)
  }
  let proximo = 1
  while (usados.has(proximo)) proximo++
  return montarCodigo(ano, proximo)
}

export async function criarContrato(input: ContratoInput) {
  const erro = valida(input)
  if (erro) return { error: erro }

  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  // Limite por plano: admin e profissional (999) ilimitados; demais batem na cota.
  if (acesso.role !== 'admin') {
    const plano = (acesso.plano ?? 'free') as keyof typeof PLANOS
    const limite = PLANOS[plano]?.imoveis ?? 1
    if (limite < 999) {
      const { count } = await supabase
        .from('contratos_locacao')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', acesso.userId)
        .is('deleted_at', null)
      if ((count ?? 0) >= limite) {
        return {
          error: `Limite do plano ${PLANOS[plano]?.nome ?? plano} atingido (${limite} contratos). Faça upgrade para profissional.`,
        }
      }
    }
  }

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
      pagamento_antecipado: input.pagamento_antecipado,
      data_pagamento_antecipado: input.pagamento_antecipado ? input.data_pagamento_antecipado : null,
      finalidade: input.finalidade,
      tipo_atuacao: input.tipo_atuacao,
      intermediador_assina: input.intermediador_assina,
      tipo_mobilia: input.tipo_mobilia,
      tem_inventario_bens: input.tem_inventario_bens,
      aceita_pet: input.aceita_pet,
      pet_observacao: input.pet_observacao,
      aluguel_inclui_iptu: input.aluguel_inclui_iptu,
      aluguel_inclui_condominio: input.aluguel_inclui_condominio,
      aluguel_inclui_agua: input.aluguel_inclui_agua,
      aluguel_inclui_energia: input.aluguel_inclui_energia,
      aluguel_inclui_gas: input.aluguel_inclui_gas,
      aluguel_inclui_internet: input.aluguel_inclui_internet,
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
  // Pagamento à vista: parcelas entram já quitadas na data do pagamento.
  // O repasse ao proprietário (status_repasse) continua 'pendente' → segue mensal.
  const antecipado = input.pagamento_antecipado
  const dataQuitacao = input.data_pagamento_antecipado || input.data_primeiro_aluguel
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
    status_seguro: p.valor_seguro > 0 ? (antecipado ? 'pago' : 'pendente') : 'sem_seguro',
    ...(antecipado
      ? { status_pagamento: 'pago', data_pagamento: dataQuitacao, valor_pago: p.valor_total }
      : {}),
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

// ───────────────── Bulk actions ─────────────────

export interface BulkInput {
  parcela_ids: string[]
  acao: 'boleto_enviado' | 'boleto_desfazer'
       | 'repasse_pago' | 'repasse_desfazer'
       | 'seguro_pago'  | 'seguro_desfazer'
}

export async function bulkAcaoParcelas(input: BulkInput) {
  await exigirAcessoCRM()
  const supabase = await createClient()
  if (input.parcela_ids.length === 0) return { error: 'Nada selecionado.' }
  if (input.parcela_ids.length > 200) return { error: 'Máximo 200 parcelas por vez.' }

  let update: Record<string, unknown> = {}
  switch (input.acao) {
    case 'boleto_enviado':   update = { boleto_enviado: true }; break
    case 'boleto_desfazer':  update = { boleto_enviado: false }; break
    case 'repasse_pago':     update = { status_repasse: 'pago' }; break
    case 'repasse_desfazer': update = { status_repasse: 'pendente' }; break
    case 'seguro_pago':      update = { status_seguro: 'pago' }; break
    case 'seguro_desfazer':  update = { status_seguro: 'pendente' }; break
    default: return { error: 'Ação inválida.' }
  }

  const { error, count } = await supabase
    .from('parcelas_aluguel')
    .update(update, { count: 'exact' })
    .in('id', input.parcela_ids)
    // Para seguro, RLS já restringe ao user. Para sem_seguro, não trocamos.
    .not('status_seguro', 'eq', input.acao.startsWith('seguro') ? 'sem_seguro' : '__never__')

  if (error) return { error: error.message }
  revalidatePath('/painel/inicio')
  revalidatePath('/painel/contratos')
  revalidatePath('/painel/financeiro')
  return { ok: true, atualizadas: count ?? input.parcela_ids.length }
}

export interface BulkPagamentoInput {
  parcela_ids: string[]
  data_pagamento: string  // YYYY-MM-DD
}

export async function bulkMarcarPagamento(input: BulkPagamentoInput) {
  await exigirAcessoCRM()
  const supabase = await createClient()
  if (input.parcela_ids.length === 0) return { error: 'Nada selecionado.' }
  if (input.parcela_ids.length > 200) return { error: 'Máximo 200 parcelas por vez.' }

  // Busca valor_total de cada (sem juros/desconto — usa valor original)
  const { data: parcelas, error: errBusca } = await supabase
    .from('parcelas_aluguel')
    .select('id, valor_total, status_pagamento')
    .in('id', input.parcela_ids)
  if (errBusca) return { error: errBusca.message }

  const elegiveis = (parcelas ?? []).filter(p => p.status_pagamento !== 'pago')

  // Atualiza uma a uma (Supabase JS não tem UPDATE com valor por linha)
  for (const p of elegiveis) {
    await supabase
      .from('parcelas_aluguel')
      .update({
        status_pagamento: 'pago',
        data_pagamento: input.data_pagamento,
        valor_pago: p.valor_total,
        juros_multa: 0,
        desconto: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', p.id)
  }

  revalidatePath('/painel/inicio')
  revalidatePath('/painel/contratos')
  revalidatePath('/painel/financeiro')
  return { ok: true, atualizadas: elegiveis.length, ignoradas: (parcelas?.length ?? 0) - elegiveis.length }
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
  inquilino_mora_no_imovel?: boolean
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

  // Soft delete: marca deleted_at; pode ser restaurado em /painel/lixeira
  const { error } = await supabase
    .from('contratos_locacao')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', acesso.userId)
    .is('deleted_at', null)

  if (error) return { error: error.message }
  revalidatePath('/painel/contratos')
  revalidatePath('/painel/lixeira')
  return { ok: true }
}

export async function restaurarContrato(id: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  // Pega o código do contrato que será restaurado
  const { data: alvo } = await supabase
    .from('contratos_locacao')
    .select('codigo')
    .eq('id', id)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!alvo) return { error: 'Contrato não encontrado.' }

  // Se o código já está em uso por um contrato ATIVO, gera um novo número
  // (evita conflito do unique parcial e não bloqueia o restore)
  let novoCodigo: string | null = null
  const { data: emUso } = await supabase
    .from('contratos_locacao')
    .select('id')
    .eq('user_id', acesso.userId)
    .eq('codigo', alvo.codigo)
    .is('deleted_at', null)
    .neq('id', id)
    .maybeSingle()
  if (emUso) {
    novoCodigo = await proximoCodigo(acesso.userId, supabase)
  }

  const update: { deleted_at: null; codigo?: string } = { deleted_at: null }
  if (novoCodigo) update.codigo = novoCodigo

  const { error } = await supabase
    .from('contratos_locacao')
    .update(update)
    .eq('id', id)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath('/painel/contratos')
  revalidatePath('/painel/lixeira')
  return { ok: true, renumerado: novoCodigo }
}

export async function excluirDefinitivoContrato(id: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  // Hard delete — só se já estava soft-deleted. Cascata em parcelas/moradores/documentos.
  const { error } = await supabase
    .from('contratos_locacao')
    .delete()
    .eq('id', id)
    .eq('user_id', acesso.userId)
    .not('deleted_at', 'is', null)
  if (error) return { error: error.message }
  revalidatePath('/painel/lixeira')
  return { ok: true }
}

// ───────────────── Regerar parcelas ─────────────────

export interface RegerarParcelasInput {
  contrato_id: string
  // Parâmetros editáveis (todos opcionais — null = manter)
  dia_vencimento?: number
  data_primeiro_aluguel?: string  // YYYY-MM-DD
  valor_aluguel?: number
  valor_seguro_fianca_mensal?: number
  iptu_mensal?: number
  condominio_mensal?: number
  taxa_admin_tipo?: 'percentual' | 'fixo'
  taxa_admin_valor?: number
  primeira_parcela_cheia?: boolean
  // Limite: parcelas com numero >= a_partir_da_parcela serão regeradas
  a_partir_da_parcela?: number   // default = primeira parcela não paga
}

export async function regerarParcelas(input: RegerarParcelasInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  // 1. Busca o contrato
  const { data: contrato, error: errCtr } = await supabase
    .from('contratos_locacao')
    .select(`
      id, duracao_meses, dia_vencimento, data_primeiro_aluguel,
      valor_aluguel, valor_seguro_fianca_mensal, iptu_mensal, condominio_mensal,
      taxa_admin_tipo, taxa_admin_valor, primeira_parcela_cheia
    `)
    .eq('id', input.contrato_id)
    .eq('user_id', acesso.userId)
    .single()
  if (errCtr || !contrato) return { error: 'Contrato não encontrado.' }

  // 2. Busca parcelas existentes pra preservar pagas
  const { data: existentes } = await supabase
    .from('parcelas_aluguel')
    .select('id, numero, status_pagamento')
    .eq('contrato_id', input.contrato_id)
    .order('numero', { ascending: true })

  const todas = existentes ?? []
  const pagas = todas.filter(p => p.status_pagamento === 'pago')
  const naoPagas = todas.filter(p => p.status_pagamento !== 'pago')

  if (todas.length === 0) return { error: 'Sem parcelas pra regerar. Use o wizard de novo contrato.' }

  // 3. Determina a partir de qual número regerar (primeira não paga por default)
  const aPartir = input.a_partir_da_parcela ?? (naoPagas[0]?.numero ?? (todas.length + 1))
  if (aPartir > todas.length) return { error: 'A parcela inicial está fora do range do contrato.' }

  // Bloqueia se tentar regerar parcela já paga
  const pagasNoRange = pagas.filter(p => p.numero >= aPartir)
  if (pagasNoRange.length > 0) {
    return { error: `Não é possível regerar — a parcela #${pagasNoRange[0].numero} já está paga. Desfaça o pagamento primeiro.` }
  }

  // 4. Monta novos parâmetros (mescla input + contrato atual)
  const novos = {
    dia_vencimento: input.dia_vencimento ?? contrato.dia_vencimento,
    data_primeiro_aluguel: input.data_primeiro_aluguel ?? contrato.data_primeiro_aluguel,
    valor_aluguel: input.valor_aluguel ?? Number(contrato.valor_aluguel),
    valor_seguro_fianca_mensal: input.valor_seguro_fianca_mensal ?? Number(contrato.valor_seguro_fianca_mensal ?? 0),
    iptu_mensal: input.iptu_mensal ?? Number(contrato.iptu_mensal ?? 0),
    condominio_mensal: input.condominio_mensal ?? Number(contrato.condominio_mensal ?? 0),
    taxa_admin_tipo: (input.taxa_admin_tipo ?? contrato.taxa_admin_tipo) as 'percentual' | 'fixo',
    taxa_admin_valor: input.taxa_admin_valor ?? Number(contrato.taxa_admin_valor),
    primeira_parcela_cheia: input.primeira_parcela_cheia ?? contrato.primeira_parcela_cheia,
  }

  if (novos.dia_vencimento < 1 || novos.dia_vencimento > 31) return { error: 'Dia de vencimento inválido (1-31).' }
  if (novos.valor_aluguel <= 0) return { error: 'Valor de aluguel inválido.' }

  // 5. Gera as parcelas completas e fatia
  const novasParcelas = gerarParcelas({
    duracao_meses: contrato.duracao_meses,
    data_primeiro_aluguel: novos.data_primeiro_aluguel,
    dia_vencimento: novos.dia_vencimento,
    valor_aluguel: novos.valor_aluguel,
    valor_seguro_fianca_mensal: novos.valor_seguro_fianca_mensal,
    iptu_mensal: novos.iptu_mensal,
    condominio_mensal: novos.condominio_mensal,
    taxa_admin_tipo: novos.taxa_admin_tipo,
    taxa_admin_valor: novos.taxa_admin_valor,
    primeira_parcela_cheia: novos.primeira_parcela_cheia,
  })

  // Mantém só as parcelas a partir de aPartir
  const aGravar = novasParcelas.filter(p => p.numero >= aPartir)
  const idsRemover = naoPagas.filter(p => p.numero >= aPartir).map(p => p.id)

  // 6. Deleta as não-pagas no range
  if (idsRemover.length > 0) {
    const { error: errDel } = await supabase
      .from('parcelas_aluguel')
      .delete()
      .in('id', idsRemover)
    if (errDel) return { error: `Falha ao remover parcelas: ${errDel.message}` }
  }

  // 7. Insere as novas
  const payload = aGravar.map(p => ({
    contrato_id: input.contrato_id,
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
  const { error: errIns } = await supabase.from('parcelas_aluguel').insert(payload)
  if (errIns) return { error: `Falha ao gerar parcelas: ${errIns.message}` }

  // 8. Atualiza valores de referência do contrato
  await supabase
    .from('contratos_locacao')
    .update({
      dia_vencimento: novos.dia_vencimento,
      data_primeiro_aluguel: novos.data_primeiro_aluguel,
      valor_aluguel: novos.valor_aluguel,
      valor_seguro_fianca_mensal: novos.valor_seguro_fianca_mensal,
      iptu_mensal: novos.iptu_mensal,
      condominio_mensal: novos.condominio_mensal,
      taxa_admin_tipo: novos.taxa_admin_tipo,
      taxa_admin_valor: novos.taxa_admin_valor,
      primeira_parcela_cheia: novos.primeira_parcela_cheia,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.contrato_id)

  revalidatePath(`/painel/contratos/${input.contrato_id}`)
  revalidatePath('/painel/financeiro')
  revalidatePath('/painel/inicio')

  return {
    ok: true,
    parcelas_regeneradas: aGravar.length,
    pagas_mantidas: pagas.length,
    a_partir_de: aPartir,
  }
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

// ───────────────── Pessoas vinculadas ao contrato ─────────────────

export type ParentescoMorador =
  | 'conjuge' | 'filho' | 'pai_mae' | 'irmao' | 'socio' | 'dependente' | 'outro'

export type PapelVinculo =
  | 'morador'                      // família/dependente que mora junto, sem responsabilidade financeira
  | 'inquilino_solidario'          // co-inquilino que assina e responde solidariamente pelo aluguel
  | 'socio_signatario'             // sócio da empresa locatária (PJ), assina pela empresa
  | 'responsavel_seguro'           // passou o seguro fiança, pode não morar (interveniente anuente)
  | 'conjuge_responsavel_seguro'   // cônjuge do responsável pelo seguro, assina só se exigido
  | 'ocupante_autorizado'          // mora mas não assume obrigação principal (não assina)
  | 'caucionante'                  // terceiro que paga a caução (interveniente anuente)
  | 'interveniente_anuente'        // representante legal / terceiro anuente; assina, não mora, não recebe chaves

export interface AdicionarMoradorInput {
  contrato_id: string
  pessoa_id: string
  papel: PapelVinculo
  parentesco?: ParentescoMorador | null
  mora_no_imovel?: boolean
  assina_contrato?: boolean
  observacao?: string
}

export async function adicionarMorador(input: AdicionarMoradorInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: contrato } = await supabase
    .from('contratos_locacao')
    .select('id')
    .eq('id', input.contrato_id)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!contrato) return { error: 'Contrato não encontrado.' }

  // Defaults por papel: quem mora e quem assina
  const moraDefault =
    input.papel === 'morador' ||
    input.papel === 'inquilino_solidario' ||
    input.papel === 'ocupante_autorizado'
  // Responsável pelo seguro, cônjuge dele e caucionante geralmente NÃO moram
  const assinaDefault = input.papel !== 'ocupante_autorizado'  // ocupante não assina; demais sim

  const { error } = await supabase.from('contratos_moradores').insert({
    contrato_id: input.contrato_id,
    pessoa_id: input.pessoa_id,
    papel: input.papel,
    parentesco: input.parentesco ?? null,
    mora_no_imovel: input.mora_no_imovel ?? moraDefault,
    assina_contrato: input.assina_contrato ?? assinaDefault,
    observacao: input.observacao ?? null,
  })
  if (error) {
    if (error.code === '23505') return { error: 'Essa pessoa já está vinculada a este contrato.' }
    return { error: error.message }
  }
  revalidatePath(`/painel/contratos/${input.contrato_id}`)
  return { ok: true }
}

export async function atualizarMorador(
  moradorId: string,
  dados: { papel?: PapelVinculo; parentesco?: ParentescoMorador | null; mora_no_imovel?: boolean; observacao?: string | null }
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
  data_encerramento: string         // YYYY-MM-DD
  observacao?: string               // detalhamento livre
  chaves_entregues_em?: string | null  // YYYY-MM-DD ou null
  qtd_chaves_entregues?: number | null
  caucao_devolvida?: boolean | null
}

export async function encerrarContrato(id: string, input: EncerrarContratoInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  // fim_natural → 'encerrado'; demais motivos → 'rescindido'
  const novoStatus = input.motivo === 'fim_natural' ? 'encerrado' : 'rescindido'

  const payload: Record<string, unknown> = {
    status: novoStatus,
    motivo_encerramento: input.motivo,
    data_encerramento: input.data_encerramento,
    data_termino: input.data_encerramento,
    updated_at: new Date().toISOString(),
  }
  if (input.observacao) {
    payload.observacoes = `[${novoStatus.toUpperCase()} em ${input.data_encerramento}] ${input.observacao}`
  }
  if (input.chaves_entregues_em !== undefined) payload.chaves_entregues_em = input.chaves_entregues_em
  if (input.qtd_chaves_entregues !== undefined) payload.qtd_chaves_entregues = input.qtd_chaves_entregues
  if (input.caucao_devolvida !== undefined) payload.caucao_devolvida = input.caucao_devolvida

  const { error } = await supabase
    .from('contratos_locacao')
    .update(payload)
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
