import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Receipt, ChevronRight } from 'lucide-react'
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
    <>
      <PerfilForm
        userId={user.id}
        email={user.email ?? ''}
        perfilInicial={perfil}
        isNovo={novo === '1'}
      />

      {perfil?.crm_ativo && (
        <div className="max-w-3xl mx-auto px-4 pb-10">
          <Link
            href="/painel/perfil/recibo"
            className="flex items-center justify-between gap-3 bg-white border border-gray-100 hover:border-violet-300 rounded-2xl p-4 shadow-sm transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center group-hover:bg-violet-100">
                <Receipt size={18} />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Personalizar recibo</p>
                <p className="text-xs text-gray-500">Logo, nome e assinatura nos recibos do CRM</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-violet-700" />
          </Link>
        </div>
      )}
    </>
  )
}
