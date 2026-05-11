import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminShell } from './_components/admin-shell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const { data: perfil } = await supabase.from('perfis').select('nome, role').eq('id', user.id).single()
  if (perfil?.role !== 'admin') redirect('/painel')

  return (
    <AdminShell email={user.email ?? ''} nome={perfil?.nome ?? null}>
      {children}
    </AdminShell>
  )
}
