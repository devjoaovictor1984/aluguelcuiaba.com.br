import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { ImovelCard } from '@/components/imovel-card'
import { getBairroPorSlug, getImoveisPorBairro } from '@/lib/supabase/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Imovel, BairroFAQ, BairroInfraestrutura } from '@/types'
import type { Metadata } from 'next'
import { MapPin, Home, Bus, School, HeartPulse, ShoppingCart, Pill, ChevronRight } from 'lucide-react'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aluguelcuiaba.com.br'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const { data: bairro } = await getBairroPorSlug(slug)
  if (!bairro) return { title: 'Bairro não encontrado' }

  const { data: imoveis } = await getImoveisPorBairro(bairro.id)
  const count = imoveis?.length ?? 0
  const titulo = `Aluguel no ${bairro.nome}, Cuiabá/MT — ${count} imóvel${count !== 1 ? 'is' : ''} | AluguelCuiabá`
  const descricao = bairro.descricao
    ? `${bairro.descricao} Veja ${count} imóvel${count !== 1 ? 'is' : ''} para alugar no ${bairro.nome} em Cuiabá/MT.`
    : `Encontre ${count} imóvel${count !== 1 ? 'is' : ''} para alugar no bairro ${bairro.nome} em Cuiabá/MT. Apartamentos, casas e kitnets disponíveis.`
  const url = `${BASE_URL}/bairros/${slug}`

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: `Aluguel no ${bairro.nome} — Cuiabá/MT`,
      description: descricao,
      url,
      images: bairro.foto_url ? [{ url: bairro.foto_url, alt: `Bairro ${bairro.nome}` }] : [],
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descricao },
    alternates: { canonical: url },
  }
}

const INFRA_ICONES: Record<keyof BairroInfraestrutura, { icon: React.ElementType; label: string; cor: string }> = {
  escolas:      { icon: School,        label: 'Escolas',       cor: 'bg-blue-50 text-blue-700' },
  hospitais:    { icon: HeartPulse,    label: 'Saúde',         cor: 'bg-red-50 text-red-700' },
  onibus:       { icon: Bus,           label: 'Ônibus',        cor: 'bg-green-50 text-green-700' },
  supermercados:{ icon: ShoppingCart,  label: 'Supermercados', cor: 'bg-orange-50 text-orange-700' },
  farmacias:    { icon: Pill,          label: 'Farmácias',     cor: 'bg-purple-50 text-purple-700' },
}

export default async function BairroPage({ params }: Props) {
  const { slug } = await params
  const { data: bairro } = await getBairroPorSlug(slug)
  if (!bairro) notFound()

  const { data: imoveis } = await getImoveisPorBairro(bairro.id)
  const lista = (imoveis ?? []) as Imovel[]
  const count = lista.length

  const infra = bairro.infraestrutura as BairroInfraestrutura | null
  const faq = bairro.faq as BairroFAQ[] | null
  const temInfra = infra && Object.values(infra).some(v => v && v.length > 0)

  // Mapa: coords ou busca pelo nome
  const mapQuery = bairro.lat && bairro.lng
    ? `${bairro.lat},${bairro.lng}`
    : encodeURIComponent(`${bairro.nome}, Cuiabá, MT, Brasil`)
  const mapSrc = `https://maps.google.com/maps?q=${mapQuery}&z=15&output=embed`

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Bairros', item: `${BASE_URL}/bairros` },
          { '@type': 'ListItem', position: 3, name: bairro.nome, item: `${BASE_URL}/bairros/${slug}` },
        ],
      },
      {
        '@type': 'Place',
        name: `${bairro.nome} — Cuiabá, MT`,
        description: bairro.descricao ?? undefined,
        ...(bairro.lat && bairro.lng ? { geo: { '@type': 'GeoCoordinates', latitude: bairro.lat, longitude: bairro.lng } } : {}),
        containedInPlace: { '@type': 'City', name: 'Cuiabá', containedInPlace: { '@type': 'State', name: 'Mato Grosso' } },
      },
      ...(faq && faq.length > 0 ? [{
        '@type': 'FAQPage',
        mainEntity: faq.map(f => ({
          '@type': 'Question',
          name: f.pergunta,
          acceptedAnswer: { '@type': 'Answer', text: f.resposta },
        })),
      }] : []),
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />

      {/* Hero */}
      <div className="relative h-52 sm:h-72 bg-gray-900 overflow-hidden">
        {bairro.foto_url ? (
          <Image src={bairro.foto_url} alt={`Bairro ${bairro.nome}`} fill className="object-cover opacity-60" priority />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-800 via-violet-700 to-violet-500" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-6 max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-white/60 text-xs mb-3">
            <Link href="/" className="hover:text-white transition-colors">Início</Link>
            <ChevronRight size={12} />
            <span className="text-white/80">Bairros</span>
            <ChevronRight size={12} />
            <span className="text-white font-medium">{bairro.nome}</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
            Aluguel no {bairro.nome}
          </h1>
          <div className="flex items-center gap-3 text-white/80 text-sm">
            <span className="flex items-center gap-1"><MapPin size={13} />{bairro.regiao ? `${bairro.regiao} · ` : ''}Cuiabá, MT</span>
            <span className="flex items-center gap-1"><Home size={13} />{count} imóvel{count !== 1 ? 'is' : ''} disponíve{count !== 1 ? 'is' : 'l'}</span>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-12">

        {/* Descrição curta */}
        {bairro.descricao && (
          <p className="text-gray-600 text-lg leading-relaxed max-w-3xl">{bairro.descricao}</p>
        )}

        {/* Imóveis disponíveis */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            Imóveis para alugar no {bairro.nome}
          </h2>
          <p className="text-gray-500 text-sm mb-5">{count} resultado{count !== 1 ? 's' : ''} encontrado{count !== 1 ? 's' : ''}</p>

          {lista.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-2xl">
              <p className="text-gray-500 mb-2">Nenhum imóvel disponível no momento.</p>
              <Link href="/" className="text-violet-700 font-medium text-sm hover:underline">
                Ver todos os imóveis em Cuiabá →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {lista.slice(0, 6).map(imovel => <ImovelCard key={imovel.id} imovel={imovel} />)}
            </div>
          )}

          {lista.length > 6 && (
            <div className="text-center mt-6">
              <Link
                href={`/?bairro=${slug}`}
                className="inline-flex items-center gap-2 bg-violet-700 hover:bg-violet-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                Ver todos os {count} imóveis <ChevronRight size={16} />
              </Link>
            </div>
          )}
        </section>

        {/* Infraestrutura */}
        {temInfra && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-5">
              Infraestrutura do {bairro.nome}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Object.entries(infra!) as [keyof BairroInfraestrutura, string[]][])
                .filter(([, items]) => items && items.length > 0)
                .map(([key, items]) => {
                  const { icon: Icon, label, cor } = INFRA_ICONES[key]
                  return (
                    <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cor.split(' ')[0]}`}>
                          <Icon size={16} className={cor.split(' ')[1]} />
                        </div>
                        <h3 className="font-semibold text-gray-900 text-sm">{label}</h3>
                      </div>
                      <ul className="space-y-1">
                        {items.map((item, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                            <span className="text-gray-300 mt-1">•</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })
              }
            </div>
          </section>
        )}

        {/* Mapa */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Localização do {bairro.nome}
          </h2>
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
            <iframe
              src={mapSrc}
              width="100%"
              height="360"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              title={`Mapa do bairro ${bairro.nome}, Cuiabá/MT`}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            {bairro.nome} · Cuiabá, Mato Grosso
          </p>
        </section>

        {/* Descrição longa (SEO) */}
        {bairro.descricao_longa && (
          <section className="prose prose-gray max-w-3xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Sobre o bairro {bairro.nome}
            </h2>
            <div className="text-gray-600 leading-relaxed whitespace-pre-line">
              {bairro.descricao_longa}
            </div>
          </section>
        )}

        {/* FAQ */}
        {faq && faq.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-5">
              Perguntas frequentes sobre o {bairro.nome}
            </h2>
            <div className="space-y-3 max-w-3xl">
              {faq.map((item, i) => (
                <details
                  key={i}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm group"
                >
                  <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none font-semibold text-gray-900 text-sm">
                    {item.pergunta}
                    <ChevronRight size={16} className="text-gray-400 shrink-0 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-3">
                    {item.resposta}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* CTA final */}
        <section className="bg-violet-700 rounded-2xl px-6 py-8 text-center text-white">
          <h2 className="text-xl font-bold mb-2">Procurando imóvel no {bairro.nome}?</h2>
          <p className="text-violet-200 text-sm mb-5">
            Receba alertas de novos anúncios no bairro assim que forem publicados.
          </p>
          <Link
            href="/cadastrar"
            className="inline-flex items-center gap-2 bg-white text-violet-700 font-bold px-6 py-3 rounded-xl hover:bg-violet-50 transition-colors"
          >
            Criar conta grátis
          </Link>
        </section>
      </main>

      <Footer />
    </>
  )
}
