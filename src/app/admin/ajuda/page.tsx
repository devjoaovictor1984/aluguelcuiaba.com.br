import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { HelpCircle, Plus, Eye, EyeOff } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminAjudaPage() {
  const supabase = createAdminClient()
  const { data: secoes, error } = await supabase
    .from('ajuda_secoes')
    .select('id, slug, titulo, resumo, icone, ordem, publicado, atualizado_em')
    .order('ordem', { ascending: true })

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <h1 className="text-lg font-bold text-red-900 mb-2">Tabela ajuda_secoes ausente</h1>
          <p className="text-sm text-red-800">
            Rode a migration <code className="bg-white px-1 rounded">crm_v23_ajuda.sql</code> no Supabase e recarregue.
          </p>
          <p className="text-xs text-red-700 mt-2 font-mono">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <HelpCircle size={22} className="text-violet-600" />
            Ajuda
          </h1>
          <p className="text-sm text-gray-500">Conteúdo exibido no <code className="bg-gray-100 px-1 rounded">/painel/ajuda</code> e nos botões <strong>?</strong> do CRM.</p>
        </div>
        <Link
          href="/admin/ajuda/novo"
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-violet-700 hover:bg-violet-800 px-3 py-2 rounded-lg"
        >
          <Plus size={14} /> Nova seção
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {(secoes ?? []).length === 0 ? (
          <p className="p-6 text-sm text-gray-400 text-center">Nenhuma seção. Crie a primeira.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {secoes!.map(s => (
              <li key={s.id}>
                <Link
                  href={`/admin/ajuda/${s.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs font-mono text-gray-400 w-10 text-right">{s.ordem}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{s.titulo}</p>
                    <p className="text-xs text-gray-400 truncate">
                      <code className="font-mono">{s.slug}</code>
                      {s.resumo && <span> · {s.resumo}</span>}
                    </p>
                  </div>
                  <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.publicado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.publicado ? <Eye size={10} /> : <EyeOff size={10} />}
                    {s.publicado ? 'publicado' : 'rascunho'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Use no código: <code className="bg-gray-100 px-1 rounded">{'<BotaoAjuda slug="contratos" />'}</code>
      </p>
    </div>
  )
}
