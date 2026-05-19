import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBairros, getPerfil } from '@/lib/supabase/queries'
import { EditarAnuncioForm } from './form'
import { SilenciarAvisos } from './_components/silenciar-avisos'

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

  const silenciadoAte = (imovel as { avisos_silenciados_ate?: string | null }).avisos_silenciados_ate ?? null

  return (
    <>
      <EditarAnuncioForm
        imovel={imovel}
        bairros={bairros ?? []}
        userId={user.id}
        telefoneInicial={perfil?.telefone ?? ''}
      />
      <div className="max-w-2xl mx-auto px-4 pb-32">
        <SilenciarAvisos imovelId={id} silenciadoAte={silenciadoAte} />
      </div>
    </>
  )
}
