import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBairros, getPerfil } from '@/lib/supabase/queries'
import { EditarAnuncioForm } from './form'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarAnuncioPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const [{ data: imovel }, { data: bairros }, { data: perfil }] = await Promise.all([
    supabase.from('imoveis').select('*, fotos(*)').eq('id', id).single(),
    getBairros(),
    getPerfil(user.id),
  ])

  if (!imovel) notFound()

  const isAdmin = perfil?.role === 'admin'
  if (imovel.user_id !== user.id && !isAdmin) redirect('/painel')

  return (
    <EditarAnuncioForm
      imovel={imovel}
      bairros={bairros ?? []}
      userId={user.id}
      telefoneInicial={perfil?.telefone ?? ''}
    />
  )
}
