import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarPainel } from './_components/sidebar-painel'

async function logoutAction() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/entrar')
}

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/entrar')

  const { data: perfil } = await supabase
    .from('perfis')
    .select('nome, foto_url, plano, role, banido_em')
    .eq('id', user.id)
    .single()

  // Conta suspensa: redireciona pra /banido (que faz signOut + mostra motivo).
  if (perfil?.banido_em) redirect('/banido')

  return (
    <div className="min-h-screen bg-gray-50">
      <SidebarPainel
        userNome={perfil?.nome ?? null}
        userEmail={user.email ?? ''}
        fotoUrl={perfil?.foto_url ?? null}
        plano={perfil?.plano ?? 'free'}
        isAdmin={perfil?.role === 'admin'}
        logoutAction={logoutAction}
      />
      <div className="lg:pl-60">
        {children}
      </div>
    </div>
  )
}
