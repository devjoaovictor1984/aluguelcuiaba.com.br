import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { FormNovoAdm } from './form'

export default async function NovoContratoAdmPage() {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const [{ data: pessoas }, { data: imoveis }] = await Promise.all([
    supabase
      .from('pessoas')
      .select('id, nome, cpf_cnpj, tipo')
      .eq('user_id', acesso.userId)
      .in('tipo', ['proprietario', 'outro'])
      .order('nome', { ascending: true }),
    supabase
      .from('imoveis')
      .select('id, titulo, endereco_resumido')
      .eq('user_id', acesso.userId)
      .order('updated_at', { ascending: false })
      .limit(200),
  ])

  return (
    <main className="px-4 py-6 max-w-3xl mx-auto pb-32">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/painel/administracoes"
          className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
        >
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Novo contrato de administração</h1>
          <p className="text-xs text-gray-500">Vínculo com o proprietário pra administrar um imóvel</p>
        </div>
      </div>

      <FormNovoAdm
        pessoas={(pessoas ?? []) as Array<{ id: string; nome: string; cpf_cnpj: string | null; tipo: string }>}
        imoveis={(imoveis ?? []) as Array<{ id: string; titulo: string; endereco_resumido: string | null }>}
      />
    </main>
  )
}
