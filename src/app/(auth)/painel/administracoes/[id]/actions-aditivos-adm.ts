'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

export type TipoAditivoAdm = 'taxa' | 'prorrogacao' | 'exclusividade' | 'repasse' | 'clausula' | 'outro'

export interface AditivoAdmInput {
  contrato_id: string
  tipo: TipoAditivoAdm
  titulo?: string | null
  data_aditivo: string // YYYY-MM-DD
  objeto: string
  /** Até 2 IDs em pessoas. Aparecem com nome e CPF na folha de assinatura. */
  testemunha_ids?: string[]
}

function validar(input: AditivoAdmInput): string | null {
  if (!input.objeto?.trim()) return 'Descreva o que está sendo aditado.'
  if (!input.data_aditivo) return 'Informe a data do aditivo.'
  if ((input.testemunha_ids?.length ?? 0) > 2) return 'Máximo 2 testemunhas.'
  return null
}

export async function criarAditivoAdm(input: AditivoAdmInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const invalido = validar(input)
  if (invalido) return { error: invalido }

  // Confirma posse do contrato de administração
  const { data: contrato } = await supabase
    .from('contratos_administracao')
    .select('id')
    .eq('id', input.contrato_id)
    .eq('user_id', acesso.userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!contrato) return { error: 'Contrato de administração não encontrado.' }

  const { count } = await supabase
    .from('contratos_administracao_aditivos')
    .select('id', { count: 'exact', head: true })
    .eq('contrato_id', input.contrato_id)

  const { data: novo, error } = await supabase
    .from('contratos_administracao_aditivos')
    .insert({
      contrato_id: input.contrato_id,
      user_id: acesso.userId,
      numero: (count ?? 0) + 1,
      tipo: input.tipo,
      titulo: input.titulo?.trim() || null,
      data_aditivo: input.data_aditivo,
      objeto: input.objeto.trim(),
      testemunha_ids: input.testemunha_ids ?? [],
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  revalidatePath(`/painel/administracoes/${input.contrato_id}`)
  return { ok: true, id: novo.id }
}

/**
 * Edita um aditivo já criado. Mesma regra do aditivo de locação: não passa
 * pela assinatura eletrônica, então não há trava — vale o PDF assinado.
 */
export async function atualizarAditivoAdm(id: string, input: AditivoAdmInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const invalido = validar(input)
  if (invalido) return { error: invalido }

  const { data, error } = await supabase
    .from('contratos_administracao_aditivos')
    .update({
      tipo: input.tipo,
      titulo: input.titulo?.trim() || null,
      data_aditivo: input.data_aditivo,
      objeto: input.objeto.trim(),
      testemunha_ids: input.testemunha_ids ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('contrato_id', input.contrato_id)
    .eq('user_id', acesso.userId)
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Aditivo não encontrado.' }

  revalidatePath(`/painel/administracoes/${input.contrato_id}`)
  return { ok: true, id: data.id }
}

export async function excluirAditivoAdm(id: string, contratoId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { error } = await supabase
    .from('contratos_administracao_aditivos')
    .delete()
    .eq('id', id)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/administracoes/${contratoId}`)
  return { ok: true }
}
