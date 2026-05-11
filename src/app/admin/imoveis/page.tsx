import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { formatarPreco } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'
import { ConfirmDeleteButton } from '../_components/confirm-delete-button'

const POR_PAGINA = 20

const STATUS_COR: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  pausado: 'bg-yellow-100 text-yellow-700',
  expirado: 'bg-red-100 text-red-600',
  rascunho: 'bg-gray-100 text-gray-600',
}

const TIPO_LABEL: Record<string, string> = {
  apartamento: 'Apartamento', casa: 'Casa', kitnet: 'Kitnet',
  comercial: 'Comercial', terreno: 'Terreno',
}

async function alterarStatus(id: string, status: string) {
  'use server'
  const supabase = createAdminClient()
  await supabase.from('imoveis').update({ status }).eq('id', id)
  revalidatePath('/admin/imoveis')
}

async function excluirImovel(id: string) {
  'use server'
  const supabase = createAdminClient()
  await supabase.from('fotos').delete().eq('imovel_id', id)
  await supabase.from('imoveis').delete().eq('id', id)
  revalidatePath('/admin/imoveis')
}

export default async function AdminImoveisPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; pagina?: string }>
}) {
  const { status: filtroStatus, pagina: paginaStr } = await searchParams
  const pagina = Math.max(1, parseInt(paginaStr ?? '1'))
  const offset = (pagina - 1) * POR_PAGINA

  const supabase = createAdminClient()
  let query = supabase
    .from('imoveis')
    .select('id, slug, titulo, tipo, preco, status, created_at, fotos(url), bairro:bairros(nome, slug), perfil:perfis(nome)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + POR_PAGINA - 1)

  if (filtroStatus && filtroStatus !== 'todos') query = query.eq('status', filtroStatus)

  const { data: imoveis, count } = await query
  const totalPaginas = Math.ceil((count ?? 0) / POR_PAGINA)

  const TABS = ['todos', 'ativo', 'pausado', 'expirado', 'rascunho']

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Imóveis</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
        {TABS.map(s => (
          <Link
            key={s}
            href={`/admin/imoveis?status=${s}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors whitespace-nowrap ${
              (filtroStatus ?? 'todos') === s
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s === 'todos' ? 'Todos' : s}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Imóvel</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Anunciante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Preço</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {imoveis?.map(im => {
                const foto = (im.fotos as Array<{url:string}>)?.[0]?.url
                const perfil = im.perfil as unknown as {nome: string|null} | null
                const bairro = im.bairro as unknown as {nome: string; slug: string} | null
                return (
                  <tr key={im.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                          {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">🏠</div>}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 truncate max-w-[200px]">{im.titulo}</p>
                          <p className="text-xs text-gray-400">{bairro?.nome ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{perfil?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{TIPO_LABEL[im.tipo] ?? im.tipo}</td>
                    <td className="px-4 py-3 font-semibold text-orange-500">{formatarPreco(im.preco)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COR[im.status] ?? ''}`}>
                        {im.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(im.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={bairro?.slug && im.slug ? `/imoveis/${bairro.slug}/${im.slug}` : `/imoveis/${im.slug ?? im.id}`} target="_blank"
                          className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors">
                          <ExternalLink size={14} />
                        </Link>
                        <form action={async () => {
                          'use server'
                          const novoStatus = im.status === 'ativo' ? 'pausado' : 'ativo'
                          await alterarStatus(im.id, novoStatus)
                        }}>
                          <button type="submit" className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                            im.status === 'ativo'
                              ? 'text-yellow-700 bg-yellow-50 hover:bg-yellow-100'
                              : 'text-green-700 bg-green-50 hover:bg-green-100'
                          }`}>
                            {im.status === 'ativo' ? 'Pausar' : 'Ativar'}
                          </button>
                        </form>
                        <ConfirmDeleteButton
                          action={async () => { 'use server'; await excluirImovel(im.id) }}
                          mensagem="Excluir este imóvel permanentemente?"
                          className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          Excluir
                        </ConfirmDeleteButton>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {(!imoveis || imoveis.length === 0) && (
            <p className="text-center text-gray-400 py-12">Nenhum imóvel encontrado.</p>
          )}
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden divide-y divide-gray-100">
          {imoveis?.map(im => {
            const foto = (im.fotos as Array<{url:string}>)?.[0]?.url
            const perfil = im.perfil as unknown as {nome: string|null} | null
            return (
              <div key={im.id} className="p-4 flex gap-3">
                <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                  {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">🏠</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">{im.titulo}</p>
                  <p className="text-xs text-gray-400 mb-1">{perfil?.nome ?? '—'} · {formatarPreco(im.preco)}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COR[im.status] ?? ''}`}>{im.status}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <form action={async () => {
                    'use server'
                    await alterarStatus(im.id, im.status === 'ativo' ? 'pausado' : 'ativo')
                  }}>
                    <button type="submit" className="text-xs text-gray-500 hover:text-violet-700">{im.status === 'ativo' ? 'Pausar' : 'Ativar'}</button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPaginas > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(p => (
            <Link
              key={p}
              href={`/admin/imoveis?status=${filtroStatus ?? 'todos'}&pagina=${p}`}
              className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                p === pagina ? 'bg-violet-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-violet-300'
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
