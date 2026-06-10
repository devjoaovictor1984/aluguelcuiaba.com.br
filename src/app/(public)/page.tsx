import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { ImoveisLista } from '@/components/imoveis-lista'
import { FiltrosSidebar } from '@/components/filtros-sidebar'
import { FiltrosMobileDrawer } from '@/components/filtros-mobile'
import { BannerSidebar } from '@/components/banner-sidebar'
import { MapaImoveisWrapper } from '@/components/mapa-imoveis-wrapper'
import { SomenteDesktop } from '@/components/somente-desktop'
import { BuscaBar } from '@/components/busca-bar'
import { getBairros, getImoveis, getBannersSidebar, getImoveisParaMapa } from '@/lib/supabase/queries'
import { parseBusca } from '@/lib/parse-busca'
import { SlidersHorizontal } from 'lucide-react'
import type { FiltrosBusca, Imovel, TipoImovel, TipoUsuario, OrdenarPor } from '@/types'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

// Canonical aponta sempre pra raiz — filtros (?tipo=apartamento, ?bbox=...)
// não devem virar URLs canônicas separadas, pra não diluir signal.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default async function Home({ searchParams }: Props) {
  const p = await searchParams

  // bbox=minLng,minLat,maxLng,maxLat — vem do mapa ao mover/dar zoom
  const bbox = p.bbox?.split(',').map(Number)
  const bboxValido = bbox?.length === 4 && bbox.every(n => Number.isFinite(n))
    ? bbox as [number, number, number, number]
    : undefined

  // Carrega bairros primeiro porque o parser precisa deles
  const { data: bairrosData } = await getBairros()
  const bairros = bairrosData ?? []

  // Busca inteligente — parser extrai tipo/bairro/quartos da frase
  const buscaInteligente = p.busca ? parseBusca(p.busca, bairros) : {}

  const filtros: FiltrosBusca = {
    tipo: (p.tipo as TipoImovel | undefined) ?? buscaInteligente.tipo,
    preco_min: p.preco_min ? Number(p.preco_min) : undefined,
    preco_max: p.preco_max ? Number(p.preco_max) : undefined,
    quartos_min: p.quartos ? Number(p.quartos) : buscaInteligente.quartos_min,
    taxa_condo_min: p.condo_min ? Number(p.condo_min) : undefined,
    taxa_condo_max: p.condo_max ? Number(p.condo_max) : undefined,
    iptu_min: p.iptu_min ? Number(p.iptu_min) : undefined,
    iptu_max: p.iptu_max ? Number(p.iptu_max) : undefined,
    tipo_anunciante: p.anunciante as TipoUsuario | undefined,
    bairro_slug: p.bairro ?? buscaInteligente.bairro_slug,
    ordenar: p.ordenar as OrdenarPor | undefined,
    bbox: bboxValido,
    aceita_pets: buscaInteligente.aceita_pets,
    mobiliado: buscaInteligente.mobiliado,
    q: buscaInteligente.q,
  }

  // Filtros que vão para o mapa (sem bbox — o mapa busca todos da região)
  const filtrosMapa: FiltrosBusca = { ...filtros, bbox: undefined }

  const [{ data: imoveis, count }, { data: banners }, { data: pinsMapa }] = await Promise.all([
    getImoveis(filtros, 1, 24),
    getBannersSidebar(),
    getImoveisParaMapa(filtrosMapa),
  ])

  // Centro focal do mapa: bairro selecionado (do filtro ou da busca)
  const bairroSelecionado = filtros.bairro_slug
    ? bairros.find(b => b.slug === filtros.bairro_slug)
    : null
  const focusCenter = bairroSelecionado?.lat != null && bairroSelecionado?.lng != null
    ? { lat: bairroSelecionado.lat, lng: bairroSelecionado.lng, zoom: 15 }
    : null

  // Desktop: mapa hero centrado em Cuiabá com aproximação um pouco maior
  // quando nenhum bairro está selecionado. (Mobile mantém o fit-to-pins.)
  const focusCenterDesktop = focusCenter ?? { lat: -15.5989, lng: -56.0949, zoom: 13 }

  const totalStr = count != null
    ? `${count} imóv${count === 1 ? 'el' : 'eis'} encontrado${count === 1 ? '' : 's'}`
    : 'Carregando...'

  const pinsMobile = (pinsMapa ?? []) as unknown as Parameters<typeof MapaImoveisWrapper>[0]['imoveis']

  return (
    <>
      <Navbar />

      {/* MOBILE: hero mapa edge-to-edge (60vh) */}
      {(pinsMobile.length > 0 || focusCenter) && (
        <section className="md:hidden">
          <MapaImoveisWrapper
            key={`mobile-${filtros.bairro_slug ?? 'todos'}`}
            imoveis={pinsMobile}
            focusCenter={focusCenter}
            containerClassName="h-[60vh] w-full relative z-0"
          />
        </section>
      )}

      {/* MOBILE: título + busca (abaixo do mapa) */}
      <div className="md:hidden bg-white px-4 py-4 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900 leading-tight">
          Imóveis para alugar em Cuiabá/MT
        </h1>
        <p className="text-xs text-gray-500 mt-0.5 mb-3">{totalStr}</p>
        <BuscaBar inicial={p.busca ?? ''} />
      </div>

      {/* DESKTOP: mapa hero edge-to-edge (substitui a antiga faixa de busca).
          A busca por palavras foi removida do desktop por enquanto.
          SEO: o H1 semântico segue no bloco mobile acima (mobile-first). */}
      {/* SomenteDesktop: monta o Leaflet só em viewport desktop. No mobile
          o componente NÃO monta (evita Leaflet em container display:none,
          que estourava "Invalid LatLng NaN" e derrubava a página). */}
      <SomenteDesktop>
        <section className="hidden md:block">
          <MapaImoveisWrapper
            key={`desktop-${filtros.bairro_slug ?? 'todos'}`}
            imoveis={pinsMobile}
            focusCenter={focusCenterDesktop}
            containerClassName="h-[55vh] w-full relative z-0"
          />
          <div className="max-w-[1800px] mx-auto px-6 flex items-center justify-between mt-1.5 text-[11px] text-gray-400">
            <span>Arraste e dê zoom no mapa para filtrar os imóveis pela área visível.</span>
            {count != null && (pinsMapa?.length ?? 0) < count && (
              <span className="text-amber-600">
                {count - (pinsMapa?.length ?? 0)} sem localização (só na lista)
              </span>
            )}
          </div>
        </section>
      </SomenteDesktop>

      {/* Layout principal (padding do bottom-nav já vem do layout do grupo) */}
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
        <div className="flex gap-6 items-start">

          {/* Sidebar — só desktop */}
          <aside className="hidden lg:block w-[252px] shrink-0 space-y-6">
            <Suspense fallback={<SidebarSkeleton />}>
              <FiltrosSidebar bairros={bairros ?? []} />
            </Suspense>
            {banners && banners.length > 0 && (
              <BannerSidebar banners={banners} />
            )}
          </aside>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">

            <div className="flex items-center justify-between mb-5 gap-3">
              <p className="text-sm text-gray-500 shrink-0">
                <span className="font-semibold text-gray-800">{count ?? 0}</span> imóveis
              </p>
              <FiltrosMobileDrawer count={count ?? 0} bairros={bairros ?? []} />
            </div>

            {imoveis && imoveis.length > 0 ? (
              <ImoveisLista
                key={JSON.stringify(filtros)}
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
