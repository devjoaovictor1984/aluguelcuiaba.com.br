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
}

function gerarCodigo(): string {
  const ano = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 9000 + 1000)
  return `ADM${ano}-${rand}`
}

export async function criarContratoAdmin(input: ContratoAdminInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (!input.proprietario_id) return { error: 'Selecione o proprietário.' }
  if (!input.data_inicio) return { error: 'Informe a data de início.' }
  if (input.taxa_valor == null || input.taxa_valor < 0) return { error: 'Informe a taxa.' }

  const codigo = gerarCodigo()
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

  const { error } = await supabase
    .from('contratos_administracao')
    .update({ ...input })
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
