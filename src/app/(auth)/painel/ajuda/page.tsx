import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { HelpCircle, ArrowLeft, ChevronRight } from 'lucide-react'
import { iconePorNome } from './_icone'

export const dynamic = 'force-dynamic'

export default async function PainelAjudaPage() {
  const supabase = await createClient()
  const { data: secoes, error } = await supabase
    .from('ajuda_secoes')
    .select('slug, titulo, resumo, icone')
    .eq('publicado', true)
    .order('ordem', { ascending: true })

  // Resiliente: se a migration v23 ainda não rodou, mostra mensagem amigável
  const tabelaAusente = error?.message?.includes('relation') || error?.message?.includes('does not exist')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <Link href="/painel" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Painel
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HelpCircle size={22} className="text-violet-600" />
          Ajuda
        </h1>
        <p className="text-sm text-gray-500">Guias rápidos pra usar o CRM.</p>
      </div>

      {tabelaAusente ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-sm text-amber-900">
            A seção de ajuda ainda não está disponível. Rode a migration <code className="bg-white px-1 rounded">crm_v23_ajuda.sql</code>.
          </p>
        </div>
      ) : (secoes ?? []).length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-sm text-gray-400">Nenhum conteúdo de ajuda publicado ainda.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {secoes!.map(s => {
              const Icon = iconePorNome(s.icone)
              return (
                <li key={s.slug}>
                  <Link
                    href={`/painel/ajuda/${s.slug}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{s.titulo}</p>
                      {s.resumo && <p className="text-xs text-gray-500 truncate">{s.resumo}</p>}
                    </div>
                    <ChevronRight size={14} className="text-gray-300 shrink-0" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
