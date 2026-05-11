'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { StatusImovel } from '@/types'

export async function renovarAnuncio(imovelId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const expira_em = new Date()
  expira_em.setDate(expira_em.getDate() + 30)

  const { error } = await supabase
    .from('imoveis')
    .update({ expira_em: expira_em.toISOString(), status: 'ativo' })
    .eq('id', imovelId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/painel')
  revalidatePath('/')
  return { success: true }
}

export async function mudarStatusImovel(imovelId: string, status: StatusImovel) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('imoveis')
    .update({ status })
    .eq('id', imovelId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/painel')
  revalidatePath('/')
  return { success: true }
}
