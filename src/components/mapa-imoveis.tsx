'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import Link from 'next/link'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { buildImovelUrl } from '@/lib/utils'

// Centro padrão: Cuiabá-MT (Praça da República)
const CUIABA: [number, number] = [-15.5989, -56.0949]

export interface PinImovel {
  id: string
  slug: string | null
  titulo: string
  preco: number
  lat: number
  lng: number
  bairro?: { slug: string; nome: string } | { slug: string; nome: string }[] | null
  fotos?: Array<{ url: string; principal?: boolean | null; ordem?: number | null }> | null
}

function fotoDestaque(fotos: PinImovel['fotos']): string | null {
  if (!fotos?.length) return null
  const principal = fotos.find(f => f.principal)
  if (principal) return principal.url
  const ordenadas = [...fotos].sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999))
  return ordenadas[0]?.url ?? null
}

interface Props {
  imoveis: PinImovel[]
  height?: number | string
  onBoundsChange?: (bbox: [number, number, number, number]) => void
}

function formatarPreco(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1).replace('.', ',')}k`
  return `R$ ${v.toFixed(0)}`
}

// Pin: foto circular do imóvel + balão de preço abaixo
function criarIconeFoto(preco: number, fotoUrl: string | null): L.DivIcon {
  const label = formatarPreco(preco)
  const bgImg = fotoUrl
    ? `background-image:url('${fotoUrl}');background-size:cover;background-position:center;`
    : `background:#ddd6fe;`
  const inicial = fotoUrl ? '' : `
    <div style="
      width:100%;height:100%;display:flex;align-items:center;justify-content:center;
      color:#7c3aed;font-weight:800;font-size:14px;
    ">🏠</div>`
  const html = `
    <div style="
      display:inline-flex;flex-direction:column;align-items:center;
      font-family:system-ui,-apple-system,sans-serif;
      filter:drop-shadow(0 2px 4px rgba(0,0,0,0.25));
    ">
      <div style="
        width:44px;height:44px;border-radius:9999px;
        border:3px solid #ffffff;${bgImg}
        background-color:#f3f4f6;overflow:hidden;
      ">${inicial}</div>
      <div style="
        background:#ffffff;color:#111827;
        border-radius:9999px;
        padding:2px 8px;
        font-size:11px;font-weight:700;
        margin-top:-6px;
        white-space:nowrap;
        border:1px solid #e5e7eb;
      ">${label}</div>
    </div>
  `
  return L.divIcon({
    html,
    className: 'foto-pin',
    iconSize: [50, 66],
    iconAnchor: [25, 33],
  })
}

// Componente filho que observa movimento do mapa e dispara onBoundsChange
function MapEventsHandler({ onBoundsChange }: { onBoundsChange?: (bbox: [number, number, number, number]) => void }) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const map = useMapEvents({
    moveend: () => {
      if (!onBoundsChange) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const b = map.getBounds()
        onBoundsChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
      }, 600)
    },
  })
  return null
}

// Ajusta o zoom inicial para caber todos os pins
function FitBounds({ imoveis }: { imoveis: PinImovel[] }) {
  const map = useMap()
  useEffect(() => {
    if (!imoveis.length) return
    const points = imoveis.map(i => [i.lat, i.lng] as [number, number])
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

export default function MapaImoveis({ imoveis, height = 360, onBoundsChange }: Props) {
  const validos = useMemo(
    () => imoveis.filter(i => Number.isFinite(i.lat) && Number.isFinite(i.lng)),
    [imoveis]
  )

  const center: [number, number] = validos.length
    ? [validos[0].lat, validos[0].lng]
    : CUIABA

  return (
    <div style={{ height }} className="rounded-2xl overflow-hidden border border-gray-200 relative z-0">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds imoveis={validos} />
        <MapEventsHandler onBoundsChange={onBoundsChange} />

        {validos.map(im => {
          const bairroObj = Array.isArray(im.bairro) ? im.bairro[0] : im.bairro
          const foto = fotoDestaque(im.fotos)
          const url = im.slug && bairroObj?.slug
            ? buildImovelUrl({ id: im.id, slug: im.slug, bairro: bairroObj } as unknown as Parameters<typeof buildImovelUrl>[0])
            : `/imoveis/${im.id}`
          return (
            <Marker key={im.id} position={[im.lat, im.lng]} icon={criarIconeFoto(im.preco, foto)}>
              <Popup closeButton={false}>
                <div className="text-sm font-sans w-44">
                  {foto && (
                    <div className="w-full aspect-[4/3] rounded-lg overflow-hidden mb-2 bg-gray-100">
                      <img src={foto} alt={im.titulo} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <p className="font-bold text-gray-900 mb-0.5">{formatarPreco(im.preco)}<span className="font-normal text-gray-500 text-xs">/mês</span></p>
                  <p className="text-gray-700 text-xs line-clamp-2 mb-2">{im.titulo}</p>
                  <Link
                    href={url}
                    style={{ color: '#ffffff', textDecoration: 'none' }}
                    className="inline-block bg-violet-700 hover:bg-violet-800 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Ver imóvel
                  </Link>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
