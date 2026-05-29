'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

export type TipoAditivo = 'reajuste' | 'prorrogacao' | 'garantia' | 'valor' | 'clausula' | 'outro'

export interface AditivoInput {
  contrato_id: string
  tipo: TipoAditivo
  titulo?: string | null
  data_aditivo: string  // YYYY-MM-DD
  objeto: string
}

export async function criarAditivo(input: AditivoInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (!input.objeto?.trim()) return { error: 'Descreva o que está sendo aditado.' }
  if (!input.data_aditivo) return { error: 'Informe a data do aditivo.' }

  // Confirma posse do contrato
  const { data: contrato } = await supabase
    .from('contratos_locacao')
    .select('id')
    .eq('id', input.contrato_id)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!contrato) return { error: 'Contrato não encontrado.' }

  // Próximo número (1º, 2º…) — conta os aditivos já existentes
  const { count } = await supabase
    .from('contratos_aditivos')
    .select('id', { count: 'exact', head: true })
    .eq('contrato_id', input.contrato_id)

  const { data: novo, error } = await supabase
    .from('contratos_aditivos')
    .insert({
      contrato_id: input.contrato_id,
      user_id: acesso.userId,
      numero: (count ?? 0) + 1,
      tipo: input.tipo,
      titulo: input.titulo?.trim() || null,
      data_aditivo: input.data_aditivo,
      objeto: input.objeto.trim(),
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${input.contrato_id}`)
  return { ok: true, id: novo.id }
}

export async function excluirAditivo(id: string, contratoId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { error } = await supabase
    .from('contratos_aditivos')
    .delete()
    .eq('id', id)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${contratoId}`)
  return { ok: true }
}
