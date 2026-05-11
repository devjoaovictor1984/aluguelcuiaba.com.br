import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { GaleriaFotos } from '@/components/galeria-fotos'
import { BarraAcoesImovel } from '@/components/barra-acoes-imovel'
import { ImovelCard } from '@/components/imovel-card'
import { getImovelPorId, getImoveisSimilares } from '@/lib/supabase/queries'
import { formatarPreco, gerarLinkWhatsApp, gerarMensagemWhatsApp, buildImovelUrl } from '@/lib/utils'
import {
  MapPin, BedDouble, Bath, Car, Maximize2,
  PawPrint, Sofa, ChevronRight, CalendarClock, Eye,
} from 'lucide-react'
import type { Imovel } from '@/types'
import { AvisarAlugado } from '@/components/avisar-alugado'
import { RegistrarView } from '@/components/registrar-view'

interface Props {
  params: Promise<{ bairro: string; slug: string }>
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aluguelcuiaba.com.br'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const { data } = await getImovelPorId(slug)
  if (!data) return {}
  const fotoUrl = data.fotos?.find((f: { principal: boolean }) => f.principal)?.url || data.fotos?.[0]?.url
  const pageUrl = `${APP_URL}${buildImovelUrl(data as Imovel)}`
  const desc = `${data.tipo} para alugar em ${data.bairro?.nome ?? 'Cuiabá'} por ${formatarPreco(data.preco)}/mês.${data.descricao ? ' ' + data.descricao.replace(/<[^>]+>/g, '').slice(0, 120) : ''}`
  return {
    title: data.titulo,
    description: desc,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: data.titulo,
      description: desc,
      url: pageUrl,
      type: 'website',
      images: fotoUrl ? [{ url: fotoUrl, width: 1200, height: 630, alt: data.titulo }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: data.titulo,
      description: desc,
      images: fotoUrl ? [fotoUrl] : [],
    },
  }
}

export default async function ImovelPage({ params }: Props) {
  const { slug } = await params
  const { data: imovel } = await getImovelPorId(slug)
  if (!imovel) notFound()

  const similares = imovel.bairro_id
    ? (await getImoveisSimilares(imovel.bairro_id, imovel.id)).data ?? []
    : []

  const tipoLabel: Record<string, string> = {
    apartamento: 'Apartamento', casa: 'Casa', kitnet: 'Kitnet/Studio',
    comercial: 'Comercial', terreno: 'Terreno',
  }

  const tipoAnunciante: Record<string, string> = {
    proprietario: 'Particular', corretor: 'Corretor', imobiliaria: 'Imobiliária',
  }

  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(
    [imovel.endereco_resumido, imovel.bairro?.nome, 'Cuiabá', 'MT'].filter(Boolean).join(', ')
  )}`

  const pageUrl = `${APP_URL}${buildImovelUrl(imovel as Imovel)}`
  const partesDetalhes: string[] = []
  if (imovel.quartos > 0) partesDetalhes.push(`${imovel.quartos} quarto${imovel.quartos > 1 ? 's' : ''}`)
  if (imovel.banheiros > 0) partesDetalhes.push(`${imovel.banheiros} banheiro${imovel.banheiros > 1 ? 's' : ''}`)
  if (imovel.vagas > 0) partesDetalhes.push(`${imovel.vagas} vaga${imovel.vagas > 1 ? 's' : ''}`)
  if (imovel.area_m2) partesDetalhes.push(`${imovel.area_m2}m²`)
  const linkWpp = gerarLinkWhatsApp(
    imovel.whatsapp,
    gerarMensagemWhatsApp(imovel.titulo, imovel.bairro?.nome, {
      preco: imovel.preco,
      partes: partesDetalhes,
      link: pageUrl,
    })
  )
  const msgCompartilhar = [
    `*${imovel.titulo}*`,
    `\u{1F4CD} ${imovel.bairro?.nome ?? 'Cuiabá'}${imovel.bairro?.nome ? ', Cuiabá' : ''}`,
    `\u{1F4B0} ${formatarPreco(imovel.preco)}/mês`,
    partesDetalhes.length > 0 ? `\u{1F3E0} ${partesDetalhes.join(' · ')}` : '',
    '',
    'Encontrei no AluguelCuiabá:',
    pageUrl,
  ].filter(Boolean).join('\n')
  const linkCompartilhar = `https://wa.me/?text=${encodeURIComponent(msgCompartilhar)}`

  const diasExpira = Math.ceil(
    (new Date(imovel.expira_em).getTime() - Date.now()) / 86_400_000
  )

  return (
    <>
      <Navbar />

      <GaleriaFotos fotos={imovel.fotos ?? []} titulo={imovel.titulo} />

      <div className="max-w-5xl mx-auto px-4 pb-32 lg:pb-16">
        <div className="lg:grid lg:grid-cols-5 lg:gap-10 lg:mt-8">

          <article className="lg:col-span-3 min-w-0">

            <nav aria-label="Navegação" className="flex items-center gap-1 text-xs text-gray-400 mt-4 mb-4 flex-wrap">
              <Link href="/" className="hover:text-violet-600 transition-colors">Imóveis</Link>
              <ChevronRight size={12} />
              {imovel.bairro && (
                <>
                  <Link href={`/bairros/${imovel.bairro.slug}`} className="hover:text-violet-600 transition-colors">
                    {imovel.bairro.nome}
                  </Link>
                  <ChevronRight size={12} />
                </>
              )}
              <span className="text-gray-500 truncate max-w-[180px]">{imovel.titulo}</span>
            </nav>

            <header>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl font-extrabold text-orange-500 leading-none">
                  {formatarPreco(imovel.preco)}
                </span>
                <span className="text-gray-400 text-sm">/mês</span>
                {imovel.taxa_condominio && (
                  <span className="text-xs text-gray-400">
                    + {formatarPreco(imovel.taxa_condominio)} cond.
                  </span>
                )}
              </div>

              <h1 className="text-xl font-bold text-gray-900 mt-2 leading-snug">
                {imovel.titulo}
              </h1>

              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600 mt-2 transition-colors"
              >
                <MapPin size={13} className="shrink-0" />
                {[imovel.bairro?.nome, imovel.condominio?.nome, imovel.endereco_resumido]
                  .filter(Boolean).join(' · ')}
              </a>

              {imovel.visualizacoes > 0 && (
                <p className="flex items-center gap-1 text-xs text-gray-400 mt-1.5">
                  <Eye size={12} />
                  {imovel.visualizacoes.toLocaleString('pt-BR')} visualização{imovel.visualizacoes !== 1 ? 'ões' : ''}
                </p>
              )}
            </header>

            <div className="flex flex-wrap gap-2 mt-5">
              {imovel.quartos > 0 && (
                <Chip icon={<BedDouble size={15} />} label={`${imovel.quartos} quarto${imovel.quartos > 1 ? 's' : ''}`} />
              )}
              {imovel.banheiros > 0 && (
                <Chip icon={<Bath size={15} />} label={`${imovel.banheiros} banheiro${imovel.banheiros > 1 ? 's' : ''}`} />
              )}
              {imovel.vagas > 0 && (
                <Chip icon={<Car size={15} />} label={`${imovel.vagas} vaga${imovel.vagas > 1 ? 's' : ''}`} />
              )}
              {imovel.area_m2 && (
                <Chip icon={<Maximize2 size={15} />} label={`${imovel.area_m2} m²`} />
              )}
            </div>

            {(imovel.aceita_pets || imovel.mobiliado || imovel.semimobiliado) && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {imovel.aceita_pets && (
                  <Badge color="green" icon={<PawPrint size={12} />} label="Aceita pets" />
                )}
                {imovel.mobiliado && (
                  <Badge color="violet" icon={<Sofa size={12} />} label="Mobiliado" />
                )}
                {imovel.semimobiliado && !imovel.mobiliado && (
                  <Badge color="violet" icon={<Sofa size={12} />} label="Semi-mobiliado" />
                )}
              </div>
            )}

            <Divider />

            {imovel.descricao && (
              <>
                <section aria-label="Descrição">
                  <h2 className="font-semibold text-gray-900 mb-2">Descrição</h2>
                  {imovel.descricao.trimStart().startsWith('<') ? (
                    <div
                      className="text-gray-600 text-sm leading-relaxed ProseMirror"
                      dangerouslySetInnerHTML={{ __html: imovel.descricao }}
                    />
                  ) : (
                    <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                      {imovel.descricao}
                    </p>
                  )}
                </section>
                <Divider />
              </>
            )}

            <section aria-label="Detalhes do imóvel">
              <h2 className="font-semibold text-gray-900 mb-3">Detalhes</h2>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <DetalheItem label="Tipo" value={tipoLabel[imovel.tipo] ?? imovel.tipo} />
                {imovel.area_m2 && <DetalheItem label="Área" value={`${imovel.area_m2} m²`} />}
                {imovel.quartos > 0 && <DetalheItem label="Quartos" value={String(imovel.quartos)} />}
                {imovel.banheiros > 0 && <DetalheItem label="Banheiros" value={String(imovel.banheiros)} />}
                {imovel.vagas > 0 && <DetalheItem label="Vagas" value={String(imovel.vagas)} />}
                {imovel.taxa_condominio && (
                  <DetalheItem label="Condomínio" value={`${formatarPreco(imovel.taxa_condominio)}/mês`} />
                )}
                {imovel.iptu && (
                  <DetalheItem label="IPTU" value={`${formatarPreco(imovel.iptu)}/ano`} />
                )}
                <DetalheItem label="Pets" value={imovel.aceita_pets ? 'Sim ✓' : 'Não'} />
                <DetalheItem
                  label="Mobiliado"
                  value={imovel.mobiliado ? 'Sim ✓' : imovel.semimobiliado ? 'Semi ✓' : 'Não'}
                />
              </dl>
            </section>

            <Divider />

            <section aria-label="Localização">
              <h2 className="font-semibold text-gray-900 mb-3">Localização</h2>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full bg-gray-50 hover:bg-violet-50 border border-gray-200 hover:border-violet-200 rounded-2xl p-4 transition-colors group active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-violet-100 group-hover:bg-violet-200 rounded-full flex items-center justify-center transition-colors shrink-0">
                    <MapPin size={20} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">
                      {imovel.bairro?.nome ?? 'Cuiabá'}, MT
                    </p>
                    {imovel.endereco_resumido && (
                      <p className="text-xs text-gray-400 mt-0.5">{imovel.endereco_resumido}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-violet-600 font-semibold group-hover:underline shrink-0">
                  Ver no mapa →
                </span>
              </a>
            </section>

            <div className="lg:hidden mt-6">
              <AnuncianteCard imovel={imovel as Imovel} tipoAnunciante={tipoAnunciante} linkWpp={linkWpp} linkCompartilhar={linkCompartilhar} />
            </div>

            {similares.length > 0 && (
              <>
                <Divider />
                <section aria-label="Imóveis similares">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900">Mais no bairro</h2>
                    {imovel.bairro && (
                      <Link
                        href={`/bairros/${imovel.bairro.slug}`}
                        className="text-xs text-violet-600 hover:underline font-medium"
                      >
                        Ver todos →
                      </Link>
                    )}
                  </div>
                  <div className="flex gap-3 overflow-x-auto scroll-hide pb-1 -mx-4 px-4 snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:overflow-visible sm:mx-0 sm:px-0">
                    {similares.slice(0, 4).map(s => (
                      <div key={s.id} className="snap-start shrink-0 w-[265px] sm:w-auto">
                        <ImovelCard imovel={s as Imovel} />
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {(imovel as unknown as Record<string, unknown>).observacoes && (
              <>
                <Divider />
                <section aria-label="Observações">
                  <h2 className="font-semibold text-gray-900 mb-2">Observações</h2>
                  <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                    {(imovel as unknown as Record<string, unknown>).observacoes as string}
                  </p>
                </section>
              </>
            )}

            {diasExpira > 0 && diasExpira <= 15 && (
              <div className="mt-6 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                <CalendarClock size={14} className="shrink-0" />
                Este anúncio expira em {diasExpira} dia{diasExpira > 1 ? 's' : ''}.
              </div>
            )}

            <div className="mt-8 text-center">
              <AvisarAlugado imovelId={imovel.id} />
            </div>
          </article>

          <aside className="hidden lg:block lg:col-span-2">
            <div className="sticky top-[68px] space-y-4">
              <AnuncianteCard imovel={imovel as Imovel} tipoAnunciante={tipoAnunciante} linkWpp={linkWpp} linkCompartilhar={linkCompartilhar} showPrice />
            </div>
          </aside>

        </div>
      </div>

      <RegistrarView imovelId={imovel.id} />
      <BarraAcoesImovel imovel={imovel as Imovel} />

      <Footer />
    </>
  )
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-2 text-sm text-gray-700 font-medium">
      <span className="text-gray-400">{icon}</span>
      {label}
    </div>
  )
}

function Badge({ color, icon, label }: { color: 'green' | 'violet'; icon: React.ReactNode; label: string }) {
  const cls = color === 'green'
    ? 'bg-green-50 text-green-700 border-green-100'
    : 'bg-violet-50 text-violet-700 border-violet-100'
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${cls}`}>
      {icon}{label}
    </span>
  )
}

function DetalheItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-3 border border-gray-100">
      <dt className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm font-semibold text-gray-800">{value}</dd>
    </div>
  )
}

function Divider() {
  return <div className="border-t border-gray-100 my-6" />
}

function AnuncianteCard({
  imovel, tipoAnunciante, linkWpp, linkCompartilhar, showPrice = false,
}: {
  imovel: Imovel
  tipoAnunciante: Record<string, string>
  linkWpp: string
  linkCompartilhar: string
  showPrice?: boolean
}) {
  const WPP_ICON = (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.507 3.936 1.395 5.617L0 24l6.545-1.371A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.651-.498-5.178-1.367l-.371-.221-3.882.813.827-3.796-.242-.392A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      {showPrice && (
        <div className="pb-4 mb-4 border-b border-gray-100">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-3xl font-extrabold text-orange-500">{formatarPreco(imovel.preco)}</span>
            <span className="text-gray-400 text-sm">/mês</span>
          </div>
          {imovel.taxa_condominio && (
            <p className="text-xs text-gray-400 mt-1">
              + {formatarPreco(imovel.taxa_condominio)}/mês de condomínio
            </p>
          )}
          {imovel.iptu && (
            <p className="text-xs text-gray-400">
              + {formatarPreco(imovel.iptu)}/ano de IPTU
            </p>
          )}
        </div>
      )}

      <a
        href={linkWpp}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center justify-center gap-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold py-4 rounded-xl text-base transition-colors"
      >
        {WPP_ICON}
        Falar pelo WhatsApp
      </a>

      <a
        href={linkCompartilhar}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 w-full flex items-center justify-center gap-2 border border-gray-200 hover:border-green-400 hover:bg-green-50 text-gray-500 hover:text-green-700 font-medium py-2.5 rounded-xl text-sm transition-colors"
      >
        {WPP_ICON}
        Compartilhar este imóvel
      </a>

      {imovel.perfil && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
          <div className="w-11 h-11 bg-violet-100 rounded-full flex items-center justify-center text-violet-700 font-bold text-lg shrink-0">
            {imovel.perfil.nome?.charAt(0).toUpperCase() ?? 'A'}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">
              {imovel.perfil.nome ?? 'Anunciante'}
            </p>
            <p className="text-xs text-gray-400">
              {tipoAnunciante[imovel.perfil.tipo] ?? 'Anunciante'}
            </p>
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center mt-4 leading-tight">
        Ao entrar em contato, mencione que viu no AluguelCuiabá.
      </p>
    </div>
  )
}
