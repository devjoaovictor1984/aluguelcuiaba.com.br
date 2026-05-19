'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function silenciarAvisosImovel(imovelId: string, dias: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const d = Math.max(1, Math.min(365, dias))
  const ate = new Date(Date.now() + d * 86400000).toISOString()

  const { error } = await supabase
    .from('imoveis')
    .update({ avisos_silenciados_ate: ate })
    .eq('id', imovelId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/painel')
  revalidatePath(`/painel/anuncios/${imovelId}/editar`)
  return { ok: true, ate }
}

export async function reativarAvisosImovel(imovelId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { error } = await supabase
    .from('imoveis')
    .update({ avisos_silenciados_ate: null })
    .eq('id', imovelId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/painel')
  revalidatePath(`/painel/anuncios/${imovelId}/editar`)
  return { ok: true }
}
