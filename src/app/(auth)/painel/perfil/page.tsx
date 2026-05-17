import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PerfilForm } from './form'

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const { data: perfil } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', user.id)
    .single()

  const { novo } = await searchParams

  return (
    <PerfilForm
      userId={user.id}
      email={user.email ?? ''}
      perfilInicial={perfil}
      isNovo={novo === '1'}
    />
  )
}
