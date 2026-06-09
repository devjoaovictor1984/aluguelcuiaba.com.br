import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Guard pra usar no topo de TODA server action de admin.
 *
 * IMPORTANTE: Server Actions são endpoints POST públicos. O redirect no
 * layout de /admin protege só a renderização da página — NÃO a action.
 * Sem este check, qualquer um (até deslogado) poderia invocar a action
 * direto, e como elas usam o service-role (createAdminClient), a RLS é
 * ignorada. Sempre chamar `await exigirAdmin()` antes de qualquer escrita.
 *
 * Lança erro se o chamador não for admin autenticado.
 */
export async function exigirAdmin(): Promise<{ id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: perfil } = await supabase.from('perfis').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'admin') throw new Error('Acesso negado: apenas administradores.')
  return { id: user.id }
}
