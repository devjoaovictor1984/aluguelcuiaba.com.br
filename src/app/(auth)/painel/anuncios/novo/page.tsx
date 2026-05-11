import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getBairros, getMeusImoveis, getPerfil } from '@/lib/supabase/queries'
import { NovoAnuncioForm } from './form'
import { PLANOS } from '@/lib/constants'
import { Lock } from 'lucide-react'

export default async function NovoAnuncioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const [{ data: bairros }, { data: imoveis }, { data: perfil }] = await Promise.all([
    getBairros(),
    getMeusImoveis(user.id),
    getPerfil(user.id),
  ])

  const isAdmin = perfil?.role === 'admin'
  const plano = (perfil?.plano ?? 'free') as keyof typeof PLANOS
  const limite = PLANOS[plano]?.imoveis ?? 1
  const total = imoveis?.length ?? 0

  if (!isAdmin && plano === 'free' && total >= limite) {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock size={28} className="text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Limite atingido</h1>
        <p className="text-gray-500 mb-1">
          O plano <strong>Gratuito</strong> permite apenas <strong>1 anúncio ativo</strong>.
        </p>
        <p className="text-gray-400 text-sm mb-8">
          Faça upgrade para publicar mais imóveis e ter acesso a fotos extras, destaque e relatórios.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/planos" className="bg-violet-700 hover:bg-violet-800 text-white font-bold py-4 rounded-2xl transition-colors">
            Ver planos de assinatura
          </Link>
          <Link href="/painel" className="text-gray-500 hover:text-gray-700 text-sm py-2">
            Voltar ao painel
          </Link>
        </div>
      </main>
    )
  }

  return <NovoAnuncioForm bairros={bairros ?? []} userId={user.id} telefoneInicial={perfil?.telefone ?? ''} />
}
