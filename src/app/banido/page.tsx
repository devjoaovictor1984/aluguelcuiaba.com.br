import Link from 'next/link'
import { AlertOctagon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = {
  title: 'Conta suspensa',
}

export default async function BanidoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let motivo: string | null = null
  let bannedAt: string | null = null

  if (user) {
    // Lê o motivo via admin client (perfis pode ter RLS bloqueando o próprio
    // usuário banido — admin ignora RLS).
    const admin = createAdminClient()
    const { data: perfil } = await admin
      .from('perfis')
      .select('banido_em, banido_motivo')
      .eq('id', user.id)
      .single()
    motivo = perfil?.banido_motivo ?? null
    bannedAt = perfil?.banido_em ?? null

    // Encerra a sessão para não ficar logado dando voltas
    await supabase.auth.signOut()
  }

  return (
    <main className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertOctagon size={28} className="text-red-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Conta suspensa</h1>
      <p className="text-sm text-gray-500 mb-6">
        Seu acesso ao AluguelCuiabá foi suspenso pela administração. Os dados ficam preservados — entre em contato pra esclarecer ou reativar.
      </p>
      {motivo && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-6 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700 mb-1">Motivo</p>
          <p className="text-sm text-red-900">{motivo}</p>
        </div>
      )}
      {bannedAt && (
        <p className="text-xs text-gray-400 mb-6">Suspenso em {new Date(bannedAt).toLocaleDateString('pt-BR')}</p>
      )}
      <Link href="/" className="inline-block bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-6 py-3 rounded-2xl">
        Voltar ao site
      </Link>
    </main>
  )
}
