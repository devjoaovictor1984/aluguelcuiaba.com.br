import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { createAdminClient } from '@/lib/supabase/admin'
import { Calendar, Clock, ChevronLeft, Tag, TrendingUp } from 'lucide-react'
import { getCategorias, categoriasMap } from '@/lib/blog/categorias'
import { getBannersSidebar } from '@/lib/supabase/queries'
import { BannerSidebar } from '@/components/banner-sidebar'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!slug) return {}

  const supabase = createAdminClient()
  const { data: post } = await supabase
    .from('posts')
    .select('titulo, slug, descricao, capa_url, created_at')
    .eq('slug', slug)
    .eq('publicado', true)
    .single()

  if (!post) return {}

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aluguelcuiaba.com.br'
  const url = `${appUrl}/blog/${post.slug}`
  const titulo = post.titulo
  const descricao = post.descricao ?? `Leia o artigo "${post.titulo}" no blog do AluguelCuiabá.`
  // Remove cache-buster (?t=...) que o upload adiciona — alguns crawlers rejeitam
  const imagem = post.capa_url
    ? post.capa_url.split('?')[0]
    : `${appUrl}/og-default.jpg`

  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: titulo,
      description: descricao,
      siteName: 'AluguelCuiabá',
      locale: 'pt_BR',
      publishedTime: post.created_at,
      images: [{ url: imagem, width: 1200, height: 630, alt: titulo }],
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: descricao,
      images: [imagem],
    },
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
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

interface Props {
  params: Promise<{ slug: string }>
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  if (!slug) notFound()

  const supabase = createAdminClient()

  const { data: post } = await supabase
    .from('posts')
    .select('id, titulo, slug, descricao, conteudo, categoria, capa_url, created_at, tempo_leitura')
    .eq('slug', slug)
    .eq('publicado', true)
    .single()

  if (!post) notFound()

  const p = post as Post
  const cats = await getCategorias()
  const catMap = categoriasMap(cats)
  const { data: banners } = await getBannersSidebar()
  const cat = catMap[p.categoria] ?? { label: p.categoria, bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300', gradient: 'from-violet-600 to-violet-900' }
  const minLeitura = p.tempo_leitura ?? lerTempo(p.conteudo ?? '')

  // Related posts (same category, exclude current)
  const { data: relacionados } = await supabase
    .from('posts')
    .select('id, titulo, slug, capa_url, created_at, categoria')
    .eq('publicado', true)
    .eq('categoria', p.categoria)
    .neq('slug', slug)
    .order('created_at', { ascending: false })
    .limit(4)

  // Sidebar: recent posts
  const { data: recentes } = await supabase
    .from('posts')
    .select('id, titulo, slug, created_at, categoria')
    .eq('publicado', true)
    .neq('slug', slug)
    .order('created_at', { ascending: false })
    .limit(5)

  // Category counts for sidebar
  const { data: contagens } = await supabase.from('posts').select('categoria').eq('publicado', true)
  const countCat: Record<string, number> = {}
  contagens?.forEach(row => { countCat[row.categoria] = (countCat[row.categoria] ?? 0) + 1 })

  const shareUrl = `https://alugasecuiaba.com.br/blog/${p.slug}`
  const shareTitle = encodeURIComponent(p.titulo)

  return (
    <>
      <Navbar />

      {/* Hero */}
      <div className="relative w-full aspect-[16/9] sm:aspect-[16/7] max-h-[560px] overflow-hidden bg-gray-900">
        {p.capa_url
          ? <img src={p.capa_url} alt={p.titulo} className="w-full h-full object-cover opacity-80" />
          : <div className={`w-full h-full bg-gradient-to-br ${cat.gradient}`} />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 max-w-4xl mx-auto px-4 pb-8 pt-4">
          <Link href="/blog" className="inline-flex items-center gap-1 text-white/70 text-xs mb-3 hover:text-white transition-colors">
            <ChevronLeft size={14} /> Blog
          </Link>
          <span className={`inline-flex items-center font-semibold rounded-full text-xs px-2.5 py-1 ${cat.bg} ${cat.text} mb-3`}>
            {cat.label}
          </span>
          <h1 className="text-white text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight">
            {p.titulo}
          </h1>
          {p.descricao && (
            <p className="text-white/75 text-sm mt-2 max-w-2xl hidden sm:block">{p.descricao}</p>
          )}
          <div className="flex items-center gap-4 mt-4 text-white/60 text-xs">
            <span className="flex items-center gap-1.5"><Calendar size={12} />{formatDate(p.created_at)}</span>
            <span className="flex items-center gap-1.5"><Clock size={12} />{minLeitura} min de leitura</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="lg:grid lg:grid-cols-3 lg:gap-12">

          {/* ── CONTEÚDO ── */}
          <article className="lg:col-span-2">

            {/* Share bar */}
            <div className="flex items-center gap-2 mb-8 pb-6 border-b border-gray-100">
              <span className="text-xs text-gray-400 font-medium mr-1">Compartilhar:</span>
              <a
                href={`https://wa.me/?text=${shareTitle}%20${encodeURIComponent(shareUrl)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.556 4.118 1.528 5.848L.057 23.57l5.921-1.549A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.005-1.373l-.36-.213-3.716.972.991-3.621-.235-.375A9.818 9.818 0 012.182 12C2.182 6.573 6.573 2.182 12 2.182S21.818 6.573 21.818 12 17.427 21.818 12 21.818z"/>
                </svg>
                WhatsApp
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${shareTitle}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                X
              </a>
            </div>

            {/* Article body */}
            <div
              className="post-content prose prose-gray prose-sm sm:prose-base max-w-none overflow-hidden
                prose-headings:font-extrabold prose-headings:text-gray-900
                prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
                prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2
                prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
                prose-a:text-violet-600 prose-a:underline prose-a:underline-offset-2
                prose-strong:text-gray-900
                prose-blockquote:border-l-4 prose-blockquote:border-violet-400 prose-blockquote:bg-violet-50 prose-blockquote:rounded-r-xl prose-blockquote:py-1 prose-blockquote:px-5 prose-blockquote:italic prose-blockquote:text-violet-900
                prose-ul:list-disc prose-ul:pl-5 prose-li:text-gray-700 prose-li:mb-1
                prose-ol:list-decimal prose-ol:pl-5
                prose-img:rounded-xl prose-img:max-w-full prose-img:h-auto
                prose-pre:overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: p.conteudo ?? '' }}
            />

            {/* Author / credit strip */}
            <div className="mt-10 pt-6 border-t border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0">
                AC
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Equipe AluguelCuiabá</p>
                <p className="text-xs text-gray-400">Publicado em {formatDate(p.created_at)}</p>
              </div>
            </div>

            {/* Related posts */}
            {relacionados && relacionados.length > 0 && (
              <section className="mt-12">
                <h2 className="font-bold text-gray-900 text-base mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-violet-600" />
                  Leia também
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {relacionados.map(rel => {
                    const rc = catMap[rel.categoria] ?? cat
                    return (
                      <Link key={rel.id} href={`/blog/${rel.slug}`}
                        className="group flex gap-3 rounded-2xl border border-gray-100 hover:border-violet-200 hover:shadow-sm p-3 transition-all">
                        <div className="w-20 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                          {rel.capa_url
                            ? <img src={rel.capa_url} alt={rel.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            : <div className={`w-full h-full bg-gradient-to-br ${rc.gradient}`} />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${rc.bg} ${rc.text}`}>{rc.label}</span>
                          <p className="text-xs font-semibold text-gray-900 mt-1 line-clamp-2 group-hover:text-violet-700 transition-colors leading-snug">
                            {rel.titulo}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">{formatDate(rel.created_at)}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}
          </article>

          {/* ── SIDEBAR ── */}
          <aside className="hidden lg:block space-y-6 mt-0">

            {/* Categorias */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
                <Tag size={14} className="text-violet-600" /> Categorias
              </h3>
              <div className="space-y-1.5">
                {cats.map(c => {
                  const cfg = catMap[c.id]
                  return (
                    <Link key={c.id} href={`/blog?categoria=${c.id}`}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-gray-50 ${
                        p.categoria === c.id ? `${cfg.bg} ${cfg.text}` : 'text-gray-700'
                      }`}>
                      <span>{cfg.label}</span>
                      {countCat[c.id] ? <span className="text-xs text-gray-400 font-normal">{countCat[c.id]}</span> : null}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Mais recentes */}
            {recentes && recentes.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
                  <TrendingUp size={14} className="text-violet-600" /> Mais recentes
                </h3>
                <div className="space-y-4">
                  {recentes.map((rec, i) => (
                    <Link key={rec.id} href={`/blog/${rec.slug}`} className="flex items-start gap-3 group">
                      <span className="text-2xl font-extrabold text-gray-200 leading-none w-7 shrink-0">{i + 1}</span>
                      <div>
                        <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2 group-hover:text-violet-700 transition-colors">
                          {rec.titulo}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(rec.created_at)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link href="/blog" className="mt-4 block text-center text-xs text-violet-600 font-semibold hover:underline">
                  Ver todos os posts →
                </Link>
              </div>
            )}

            {/* Patrocínio */}
            {banners && banners.length > 0 && <BannerSidebar banners={banners} />}

            {/* CTA anunciar */}
            <div className="bg-violet-700 rounded-2xl p-5 text-center">
              <p className="text-white font-bold text-sm mb-1">Quer anunciar seu imóvel?</p>
              <p className="text-violet-200 text-xs mb-4">Cadastre-se grátis e alcance milhares de interessados.</p>
              <Link href="/painel/anuncios/novo"
                className="block bg-white text-violet-700 font-semibold text-sm py-2.5 rounded-xl hover:bg-violet-50 transition-colors">
                Anunciar agora
              </Link>
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </>
  )
}
