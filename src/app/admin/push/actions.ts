'use server'

import { createClient } from '@/lib/supabase/server'
import { enviarPushBroadcast, type PushPayload } from '@/lib/push/sender'

async function exigirAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: perfil } = await supabase.from('perfis').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'admin') throw new Error('Apenas admin')
}

export interface EnviarTesteInput {
  title: string
  body: string
  url: string
}

export async function enviarPushTeste(input: EnviarTesteInput) {
  await exigirAdmin()

  const payload: PushPayload = {
    title: (input.title || '').trim() || 'AluguelCuiabá',
    body: (input.body || '').trim() || 'Notificação de teste 🔔',
    url: (input.url || '/').trim() || '/',
    tag: 'admin-teste',
    canal: 'admin_teste',
  }

  try {
    const r = await enviarPushBroadcast(payload)
    return { ok: true, ...r }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg }
  }
}
