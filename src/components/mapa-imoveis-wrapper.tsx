'use client'

import dynamic from 'next/dynamic'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import type { PinImovel } from './mapa-imoveis'

// Leaflet só roda no client (window/document) → desabilita SSR
const MapaImoveis = dynamic(() => import('./mapa-imoveis'), {
  ssr: false,
  loading: () => (
    <div className="h-[360px] rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
      <Loader2 size={18} className="animate-spin mr-2" />
      Carregando mapa…
    </div>
  ),
})

interface Props {
  imoveis: PinImovel[]
  /** Se true, mover/zoom do mapa atualiza o filtro bbox na URL */
  filtraAoMover?: boolean
}

export function MapaImoveisWrapper({ imoveis, filtraAoMover = true }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [pinsAtuais] = useState<PinImovel[]>(imoveis)

  const handleBoundsChange = (bbox: [number, number, number, number]) => {
    if (!filtraAoMover) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('bbox', bbox.map(n => n.toFixed(4)).join(','))
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  if (!pinsAtuais.length) {
    return (
      <div className="h-[200px] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 text-sm">
        <MapPin size={24} className="mb-2 opacity-50" />
        Nenhum imóvel com localização cadastrada ainda.
      </div>
    )
  }

  return <MapaImoveis imoveis={pinsAtuais} onBoundsChange={filtraAoMover ? handleBoundsChange : undefined} />
}
