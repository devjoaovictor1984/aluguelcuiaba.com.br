import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/entrar')

  // Conta suspensa: redireciona pra /banido (que faz signOut + mostra motivo).
  const { data: perfil } = await supabase
    .from('perfis')
    .select('banido_em')
    .eq('id', user.id)
    .single()
  if (perfil?.banido_em) redirect('/banido')

  return <>{children}</>
}
