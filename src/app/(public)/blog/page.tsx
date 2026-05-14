import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { createAdminClient } from '@/lib/supabase/admin'
import { Calendar, Clock, ChevronRight, TrendingUp, Tag } from 'lucide-react'
import { getCategorias, categoriasMap, type CategoriaStyle } from '@/lib/blog/categorias'

function CatBadge({ cat, catMap, size = 'sm' }: { cat: string; catMap: Record<string, CategoriaStyle>; size?: 'sm' | 'xs' }) {
  const c = catMap[cat] ?? { label: cat, bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300', gradient: 'from-violet-600 to-violet-900' }
  return (
    <span className={`inline-flex items-center font-semibold rounded-full ${c.bg} ${c.text} ${size === 'xs' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}>
      {c.label}
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function lerTempo(conteudo: string) {
  const palavras = conteudo?.replace(/<[^>]+>/g, '').split(/\s+/).length ?? 0
  return Math.max(1, Math.ceil(palavras / 200))
}

interface Post {
  id: string; titulo: string; slug: string; descricao: string | null
  conteudo: string | null; categoria: string; capa_url: string | null
  created_at: string; tempo_leitura: number | null
}

function GradientCover({ cat, catMap, className }: { cat: string; catMap: Record<string, CategoriaStyle>; className?: string }) {
  const c = catMap[cat]
  return <div className={`bg-gradient-to-br ${c?.gradient ?? 'from-violet-600 to-violet-900'} ${className}`} />
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>
}) {
  const { categoria } = await searchParams
  const supabase = createAdminClient()

  const cats = await getCategorias()
  const catMap = categoriasMap(cats)

  let query = supabase
    .from('posts')
    .select('id, titulo, slug, descricao, conteudo, categoria, capa_url, created_at, tempo_leitura')
    .eq('publicado', true)
    .order('created_at', { ascending: false })

  if (categoria && categoria !== 'todos') query = query.eq('categoria', categoria)

  const { data: posts } = await query.limit(30)
  const allPosts = (posts ?? []) as Post[]

  const destaque = !categoria ? allPosts[0] : null
  const lista = destaque ? allPosts.slice(1) : allPosts

  // Contagem por categoria
  const { data: contagens } = await supabase
    .from('posts')
    .select('categoria')
    .eq('publicado', true)

  const countCat: Record<string, number> = {}
  contagens?.forEach(p => { countCat[p.categoria] = (countCat[p.categoria] ?? 0) + 1 })

  return (
    <>
      <Navbar />

      {/* Hero band */}
      <div className="bg-violet-700 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">Blog AluguelCuiabá</h1>
          <p className="text-violet-200 text-sm">Dicas, mercado imobiliário, direitos do inquilino e mais.</p>
        </div>
      </div>

      {/* Category tabs */}
      <div className="sticky top-[57px] z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 overflow-x-auto scroll-hide">
          <div className="flex gap-0.5 py-2 w-max min-w-full">
            {[{ value: '', label: 'Tudo' }, ...cats.map(c => ({ value: c.id, label: c.label }))].map(tab => (
              <Link
                key={tab.value}
                href={tab.value ? `/blog?categoria=${tab.value}` : '/blog'}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  (categoria ?? '') === tab.value
                    ? 'bg-violet-700 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
                {tab.value && countCat[tab.value] ? (
                  <span className="ml-1.5 text-[10px] opacity-70">({countCat[tab.value]})</span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="lg:grid lg:grid-cols-3 lg:gap-10">

          {/* ── COLUNA PRINCIPAL ── */}
          <div className="lg:col-span-2 space-y-8">

            {/* Post destaque */}
            {destaque && (
              <Link href={`/blog/${destaque.slug}`} className="group block">
                <div className="relative rounded-3xl overflow-hidden aspect-[16/7] mb-4">
                  {destaque.capa_url
                    ? <img src={destaque.capa_url} alt={destaque.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    : <GradientCover cat={destaque.categoria} catMap={catMap} className="w-full h-full" />
                  }
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <CatBadge cat={destaque.categoria} catMap={catMap} />
                    <h2 className="text-white text-xl sm:text-2xl font-extrabold mt-2 mb-2 leading-snug group-hover:underline underline-offset-2">
                      {destaque.titulo}
                    </h2>
                    {destaque.descricao && (
                      <p className="text-white/80 text-sm line-clamp-2 hidden sm:block">{destaque.descricao}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-white/60 text-xs">
                      <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(destaque.created_at)}</span>
                      <span className="flex items-center gap-1"><Clock size={11} />{destaque.tempo_leitura ?? lerTempo(destaque.conteudo ?? '')} min</span>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* Lista de posts */}
            {lista.length === 0 && !destaque && (
              <div className="text-center py-20 text-gray-400">
                <Tag size={32} className="mx-auto mb-3 opacity-30" />
                <p>Nenhum post nesta categoria ainda.</p>
                <Link href="/blog" className="text-violet-600 text-sm font-medium hover:underline mt-2 block">Ver todos</Link>
              </div>
            )}

            <div className="space-y-5">
              {lista.length > 0 && (
                <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <TrendingUp size={16} className="text-violet-600" />
                  {categoria ? catMap[categoria]?.label ?? categoria : 'Últimas notícias'}
                </h2>
              )}

              {lista.map(post => (
                <Link key={post.id} href={`/blog/${post.slug}`} className="group flex gap-4 items-start">
                  <div className="w-24 h-20 sm:w-32 sm:h-24 rounded-2xl overflow-hidden shrink-0 bg-gray-100">
                    {post.capa_url
                      ? <img src={post.capa_url} alt={post.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      : <GradientCover cat={post.categoria} catMap={catMap} className="w-full h-full" />
                    }
                  </div>
                  <div className="flex-1 min-w-0 py-1">
                    <CatBadge cat={post.categoria} catMap={catMap} size="xs" />
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base mt-1.5 leading-snug line-clamp-2 group-hover:text-violet-700 transition-colors">
                      {post.titulo}
                    </h3>
                    {post.descricao && (
                      <p className="text-gray-500 text-xs mt-1 line-clamp-2 hidden sm:block">{post.descricao}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-gray-400 text-[11px]">
                      <span className="flex items-center gap-1"><Calendar size={10} />{formatDate(post.created_at)}</span>
                      <span className="flex items-center gap-1"><Clock size={10} />{post.tempo_leitura ?? lerTempo(post.conteudo ?? '')} min de leitura</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ── SIDEBAR ── */}
          <aside className="hidden lg:block space-y-6 mt-8 lg:mt-0">

            {/* Categorias */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
                <Tag size={14} className="text-violet-600" /> Categorias
              </h3>
              <div className="space-y-2">
                {cats.map(cat => {
                  const cfg = catMap[cat.id]
                  return (
                    <Link
                      key={cat.id}
                      href={`/blog?categoria=${cat.id}`}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-gray-50 ${
                        categoria === cat.id ? `${cfg.bg} ${cfg.text}` : 'text-gray-700'
                      }`}
                    >
                      <span>{cfg.label}</span>
                      {countCat[cat.id] ? <span className="text-xs text-gray-400 font-normal">{countCat[cat.id]}</span> : null}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Mais recentes */}
            {allPosts.length > 3 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
                  <TrendingUp size={14} className="text-violet-600" /> Mais recentes
                </h3>
                <div className="space-y-4">
                  {allPosts.slice(0, 5).map((post, i) => (
                    <Link key={post.id} href={`/blog/${post.slug}`} className="flex items-start gap-3 group">
                      <span className="text-2xl font-extrabold text-gray-200 leading-none w-7 shrink-0">{i + 1}</span>
                      <div>
                        <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2 group-hover:text-violet-700 transition-colors">
                          {post.titulo}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(post.created_at)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Anúncio/Patrocínio */}
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-5 text-center">
              <p className="text-xs text-gray-400 font-medium mb-2">PATROCÍNIO</p>
              <div className="h-32 flex items-center justify-center text-gray-300 text-xs">
                Espaço disponível para anúncio
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </>
  )
}
