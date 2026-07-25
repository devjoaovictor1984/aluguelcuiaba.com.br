import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, ArrowLeft, Home } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getMeusImoveis } from '@/lib/supabase/queries'
import { PainelImovelCard } from '../imovel-card'

export const dynamic = 'force-dynamic'

const FILTROS: Array<{ key: string; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'ativo', label: 'Ativos' },
  { key: 'alugado', label: 'Alugados' },
  { key: 'pausado', label: 'Pausados' },
  { key: 'expirado', label: 'Expirados' },
]

interface ImovelLista {
  id: string
  status: string
  expira_em: string
  [k: string]: unknown
}

export default async function ListarAnunciosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: statusFiltro = 'todos' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const { data: imoveis } = await getMeusImoveis(user.id)
  const lista = (imoveis ?? []) as unknown as ImovelLista[]

  const agora = Date.now()
  const isExpirado = (i: ImovelLista) =>
    i.status === 'expirado' || (i.status === 'ativo' && new Date(i.expira_em).getTime() < agora)
  const efetivo = (i: ImovelLista) => (isExpirado(i) ? 'expirado' : i.status)

  const contagem: Record<string, number> = {
    todos: lista.length,
    ativo: lista.filter(i => efetivo(i) === 'ativo').length,
    alugado: lista.filter(i => i.status === 'alugado').length,
    pausado: lista.filter(i => i.status === 'pausado').length,
    expirado: lista.filter(i => isExpirado(i)).length,
  }

  const filtrada = statusFiltro === 'todos'
    ? lista
    : lista.filter(i => efetivo(i) === statusFiltro)

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <Link href="/painel" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-violet-700 mb-1">
            <ArrowLeft size={12} /> Meu painel
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Listar anúncios</h1>
          <p className="text-xs text-gray-500 mt-0.5">{lista.length} anúncio{lista.length === 1 ? '' : 's'} no total</p>
        </div>
        <Link
          href="/painel/anuncios/novo"
          className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0"
        >
          <Plus size={15} /> Novo anúncio
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        {FILTROS.map(f => {
          const ativo = statusFiltro === f.key
          return (
            <Link
              key={f.key}
              href={f.key === 'todos' ? '/painel/anuncios' : `/painel/anuncios?status=${f.key}`}
              className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                ativo
                  ? 'bg-violet-700 text-white border-violet-700'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-700'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 ${ativo ? 'text-violet-200' : 'text-gray-400'}`}>{contagem[f.key] ?? 0}</span>
            </Link>
          )
        })}
      </div>

      {/* Lista */}
      {filtrada.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Home size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-600 mb-1">
            {lista.length === 0 ? 'Nenhum anúncio ainda' : 'Nenhum anúncio neste filtro'}
          </p>
          {lista.length === 0 && (
            <p className="text-sm">Publique seu primeiro imóvel e comece a receber contatos.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtrada.map(imovel => (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <PainelImovelCard key={imovel.id} imovel={imovel as any} />
          ))}
        </div>
      )}
    </main>
  )
}
