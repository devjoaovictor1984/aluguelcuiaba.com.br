'use client'

import dynamic from 'next/dynamic'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition, useState, useEffect, useRef } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import type { PinImovel } from './mapa-imoveis'

// Leaflet só roda no client (window/document) → desabilita SSR.
// Sem `loading` aqui: o esqueleto fica no container de altura reservada abaixo.
const MapaImoveis = dynamic(() => import('./mapa-imoveis'), { ssr: false })

interface Props {
  imoveis: PinImovel[]
  /** Se true, mover/zoom do mapa atualiza o filtro bbox na URL */
  filtraAoMover?: boolean
  /** Centro forçado — usado quando um bairro é selecionado */
  focusCenter?: { lat: number; lng: number; zoom?: number } | null
  /** Sobrescreve o container externo (altura/bordas) */
  containerClassName?: string
}

const DEFAULT_CONTAINER = 'rounded-2xl overflow-hidden border border-gray-200 relative z-0 h-[360px]'

export function MapaImoveisWrapper({ imoveis, filtraAoMover = true, focusCenter, containerClassName }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [pinsAtuais] = useState<PinImovel[]>(imoveis)

  // Monta o Leaflet só quando o container entra (ou está perto de entrar) na
  // viewport. Benefícios:
  //  - CLS: a altura é reservada pelo container desde o 1º paint (não "pula").
  //  - TBT: o init pesado do Leaflet sai do caminho crítico (roda pós-paint).
  //  - Mobile: um container display:none (mapa do desktop no mobile, e vice-
  //    versa) nunca intersecta → o mapa não monta → sem o crash do Leaflet
  //    em container de tamanho zero.
  const ref = useRef<HTMLDivElement>(null)
  const [montar, setMontar] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (montar) return
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setMontar(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [montar])

  const handleBoundsChange = (bbox: [number, number, number, number]) => {
    if (!filtraAoMover) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('bbox', bbox.map(n => n.toFixed(4)).join(','))
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  if (!pinsAtuais.length && !focusCenter) {
    return (
      <div className={containerClassName ?? DEFAULT_CONTAINER}>
        <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center text-gray-400 text-sm">
          <MapPin size={24} className="mb-2 opacity-50" />
          Nenhum imóvel com localização cadastrada ainda.
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} className={containerClassName ?? DEFAULT_CONTAINER}>
      {montar ? (
        <MapaImoveis
          imoveis={pinsAtuais}
          onBoundsChange={filtraAoMover ? handleBoundsChange : undefined}
          focusCenter={focusCenter}
          containerClassName="w-full h-full relative z-0"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
          <Loader2 size={18} className="animate-spin mr-2" />
          Carregando mapa…
        </div>
      )}
    </div>
  )
}
