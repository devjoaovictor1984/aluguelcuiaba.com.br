import { Suspense } from 'react'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { ImoveisLista } from '@/components/imoveis-lista'
import { FiltrosSidebar } from '@/components/filtros-sidebar'
import { FiltrosMobileDrawer } from '@/components/filtros-mobile'
import { getBairros, getImoveis } from '@/lib/supabase/queries'
import { SlidersHorizontal, MapPin } from 'lucide-react'
import type { FiltrosBusca, Imovel, TipoImovel, TipoUsuario, OrdenarPor } from '@/types'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function Home({ searchParams }: Props) {
  const p = await searchParams

  const filtros: FiltrosBusca = {
    tipo: p.tipo as TipoImovel | undefined,
    preco_min: p.preco_min ? Number(p.preco_min) : undefined,
    preco_max: p.preco_max ? Number(p.preco_max) : undefined,
    quartos_min: p.quartos ? Number(p.quartos) : undefined,
    taxa_condo_min: p.condo_min ? Number(p.condo_min) : undefined,
    taxa_condo_max: p.condo_max ? Number(p.condo_max) : undefined,
    iptu_min: p.iptu_min ? Number(p.iptu_min) : undefined,
    iptu_max: p.iptu_max ? Number(p.iptu_max) : undefined,
    tipo_anunciante: p.anunciante as TipoUsuario | undefined,
    ordenar: p.ordenar as OrdenarPor | undefined,
  }

  const [{ data: imoveis, count }, { data: bairros }] = await Promise.all([
    getImoveis(filtros, 1, 24),
    getBairros(),
  ])

  const totalStr = count != null
    ? `${count} imóv${count === 1 ? 'el' : 'eis'} encontrado${count === 1 ? '' : 's'}`
    : 'Carregando...'

  return (
    <>
      <Navbar />

      {/* Header slim com cor brand */}
      <div className="bg-violet-700 py-5 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">
              Imóveis para alugar em Cuiabá/MT
            </h1>
            <p className="text-violet-200 text-sm mt-0.5">{totalStr}</p>
          </div>

          {/* Bairros chips — só desktop */}
          <div className="hidden sm:flex gap-1.5 flex-wrap max-w-lg">
            {bairros?.slice(0, 6).map(b => (
              <a
                key={b.id}
                href={`/bairros/${b.slug}`}
                className="flex items-center gap-1 px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-full transition-colors"
              >
                <MapPin size={10} />
                {b.nome}
              </a>
            ))}
            {(bairros?.length ?? 0) > 6 && (
              <span className="px-2.5 py-1 bg-violet-800 text-violet-300 text-xs rounded-full">
                +{(bairros?.length ?? 0) - 6} bairros
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Layout principal */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6 items-start">

          {/* Sidebar — só desktop */}
          <aside className="hidden lg:block w-[252px] shrink-0">
            <Suspense fallback={<SidebarSkeleton />}>
              <FiltrosSidebar />
            </Suspense>
          </aside>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">

            <div className="flex items-center justify-between mb-5 gap-3">
              <p className="text-sm text-gray-500 shrink-0">
                <span className="font-semibold text-gray-800">{count ?? 0}</span> imóveis
              </p>
              <FiltrosMobileDrawer count={count ?? 0} />
            </div>

            {imoveis && imoveis.length > 0 ? (
              <ImoveisLista
                initialItems={imoveis as Imovel[]}
                total={count ?? imoveis.length}
                filtros={filtros}
              />
            ) : (
              <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
                <SlidersHorizontal size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-base font-medium text-gray-700">Nenhum imóvel encontrado</p>
                <p className="mt-1 text-sm text-gray-400">Tente ajustar ou remover alguns filtros</p>
                <a
                  href="/"
                  className="inline-block mt-4 bg-violet-700 text-white px-5 py-2 rounded-lg text-sm hover:bg-violet-800 transition-colors"
                >
                  Ver todos os imóveis
                </a>
              </div>
            )}

            {/* CTA anunciar */}
            {!Object.values(filtros).some(Boolean) && (
              <div className="mt-10 bg-violet-50 border border-violet-100 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-violet-900">Tem um imóvel para alugar?</p>
                  <p className="text-sm text-violet-600 mt-0.5">Anuncie gratuitamente e receba contatos direto pelo WhatsApp</p>
                </div>
                <a
                  href="/painel/anuncios/novo"
                  className="shrink-0 bg-violet-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-violet-800 transition-colors"
                >
                  Anunciar grátis
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}

function SidebarSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-4 space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 bg-gray-100 rounded w-24 animate-pulse" />
          <div className="h-8 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}
