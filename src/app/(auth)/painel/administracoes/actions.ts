'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

export interface ContratoAdminInput {
  imovel_id: string | null
  proprietario_id: string
  data_inicio: string
  data_termino?: string | null
  prazo_meses?: number | null
  renovacao_automatica?: boolean
  taxa_tipo: 'percentual' | 'fixo'
  taxa_valor: number
  primeira_parcela_cheia?: boolean
  dia_repasse?: number | null
  forma_repasse?: string | null
  exclusividade?: boolean
  multa_rescisao_meses?: number | null
  aviso_previo_dias?: number
  observacoes?: string | null
  recebimento_comissao?: 'mensal' | 'pagamento_unico'
  proprietario_representante_id?: string | null
  proprietario_representante_qualificacao?: string | null

  // Seguros (v75) — o que foi combinado com o proprietário.
  seguro_incendio_modo?: string | null
  seguro_incendio_pagador?: string | null
  seguro_incendio_seguradora?: string | null
  seguro_incendio_apolice?: string | null
  seguro_incendio_vencimento?: string | null
  garantias_aceitas?: string[] | null
  autoriza_cotacao_seguros?: boolean | null
  seguros_observacoes?: string | null
}

/**
 * Normaliza os campos de seguro pro banco.
 *
 * Coerções que evitam estado inconsistente:
 *  - autorização só faz sentido se a administradora for contratar;
 *  - seguradora/apólice/vencimento só quando o proprietário já tem.
 */
function normalizarSeguros(input: ContratoAdminInput): Record<string, unknown> {
  const modo = input.seguro_incendio_modo || 'a_definir'
  const proprietarioTem = modo === 'proprietario_possui'
  const administradoraContrata = modo === 'administradora_contrata'

  return {
    seguro_incendio_modo: modo,
    seguro_incendio_pagador: input.seguro_incendio_pagador || null,
    seguro_incendio_seguradora: proprietarioTem ? (input.seguro_incendio_seguradora?.trim() || null) : null,
    seguro_incendio_apolice: proprietarioTem ? (input.seguro_incendio_apolice?.trim() || null) : null,
    seguro_incendio_vencimento: proprietarioTem ? (input.seguro_incendio_vencimento || null) : null,
    garantias_aceitas: input.garantias_aceitas ?? [],
    autoriza_cotacao_seguros: administradoraContrata ? !!input.autoriza_cotacao_seguros : false,
    seguros_observacoes: input.seguros_observacoes?.trim() || null,
  }
}

// Próximo código sequencial (primeiro número livre), considerando só contratos
// ativos (não apagados) — testes excluídos liberam o número. Igual à locação.
async function proximoCodigoAdm(userId: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const ano = new Date().getFullYear()
  const prefixo = `ADM${ano}-`
  const { data } = await supabase
    .from('contratos_administracao')
    .select('codigo')
    .eq('user_id', userId)
    .like('codigo', `${prefixo}%`)
    .is('deleted_at', null)

  const usados = new Set<number>()
  for (const row of data ?? []) {
    const n = parseInt(String(row.codigo).slice(prefixo.length), 10)
    if (Number.isFinite(n)) usados.add(n)
  }
  let proximo = 1
  while (usados.has(proximo)) proximo++
  return `${prefixo}${String(proximo).padStart(3, '0')}`
}

export async function criarContratoAdmin(input: ContratoAdminInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (!input.proprietario_id) return { error: 'Selecione o proprietário.' }
  if (!input.data_inicio) return { error: 'Informe a data de início.' }
  if (input.taxa_valor == null || input.taxa_valor < 0) return { error: 'Informe a taxa.' }

  const codigo = await proximoCodigoAdm(acesso.userId, supabase)
  const { data, error } = await supabase
    .from('contratos_administracao')
    .insert({
      user_id: acesso.userId,
      codigo,
      imovel_id: input.imovel_id || null,
      proprietario_id: input.proprietario_id,
      data_inicio: input.data_inicio,
      data_termino: input.data_termino || null,
      prazo_meses: input.prazo_meses ?? null,
      renovacao_automatica: input.renovacao_automatica ?? true,
      taxa_tipo: input.taxa_tipo,
      taxa_valor: input.taxa_valor,
      primeira_parcela_cheia: input.primeira_parcela_cheia ?? false,
      dia_repasse: input.dia_repasse ?? null,
      forma_repasse: input.forma_repasse ?? null,
      exclusividade: input.exclusividade ?? true,
      multa_rescisao_meses: input.multa_rescisao_meses ?? 3,
      aviso_previo_dias: input.aviso_previo_dias ?? 30,
      observacoes: input.observacoes ?? null,
      recebimento_comissao: input.recebimento_comissao ?? 'mensal',
      proprietario_representante_id: input.proprietario_representante_id || null,
      proprietario_representante_qualificacao: input.proprietario_representante_qualificacao?.trim() || null,
      ...normalizarSeguros(input),
      status: 'ativo',
    })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'Falha ao criar.' }
  revalidatePath('/painel/administracoes')
  return { ok: true, id: data.id }
}

export async function atualizarContratoAdmin(id: string, input: Partial<ContratoAdminInput>) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  // Só normaliza os campos de seguro quando eles vieram na edição — senão
  // um update parcial de outro campo zeraria a preferência já registrada.
  const patch: Record<string, unknown> = { ...input }
  if ('seguro_incendio_modo' in input) {
    Object.assign(patch, normalizarSeguros(input as ContratoAdminInput))
  }

  const { error } = await supabase
    .from('contratos_administracao')
    .update(patch)
    .eq('id', id)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  revalidatePath('/painel/administracoes')
  revalidatePath(`/painel/administracoes/${id}`)
  return { ok: true }
}

export async function excluirContratoAdmin(id: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { error } = await supabase
    .from('contratos_administracao')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  revalidatePath('/painel/administracoes')
  return { ok: true }
}
