'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function salvarTemplate(chave: string, assunto: string, corpo: string) {
  const supabase = createAdminClient()
  const agora = new Date().toISOString()

  await Promise.all([
    supabase.from('site_config').upsert(
      { chave: `email_${chave}_assunto`, valor: assunto, updated_at: agora },
      { onConflict: 'chave' }
    ),
    supabase.from('site_config').upsert(
      { chave: `email_${chave}_corpo`, valor: corpo, updated_at: agora },
      { onConflict: 'chave' }
    ),
  ])

  revalidatePath('/admin/emails')
}
