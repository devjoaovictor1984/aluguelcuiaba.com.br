'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet'
import Link from 'next/link'
import L from 'leaflet'
import { Locate, LocateOff, Loader2, X } from 'lucide-react'
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
  /** Sobrescreve className do container externo (útil pra h-[60vh] mobile sem bordas). */
  containerClassName?: string
  onBoundsChange?: (bbox: [number, number, number, number]) => void
  /** Centro forçado (ex: ao filtrar por bairro) */
  focusCenter?: { lat: number; lng: number; zoom?: number } | null
}

function formatarPreco(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1).replace('.', ',')}k`
  return `R$ ${v.toFixed(0)}`
}

// Distância Haversine em km
function distanciaKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
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

// Pin azul pulsante pra posição do usuário
function criarIconeUsuario(): L.DivIcon {
  const html = `
    <div style="position:relative;width:24px;height:24px;">
      <div style="
        position:absolute;inset:0;border-radius:9999px;
        background:#3b82f6;opacity:0.25;
        animation: pulse 2s infinite;
      "></div>
      <div style="
        position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        width:14px;height:14px;border-radius:9999px;
        background:#3b82f6;border:3px solid #ffffff;
        box-shadow:0 1px 3px rgba(0,0,0,0.4);
      "></div>
    </div>
    <style>
      @keyframes pulse {
        0% { transform: scale(0.6); opacity: 0.6; }
        70% { transform: scale(2.4); opacity: 0; }
        100% { transform: scale(2.4); opacity: 0; }
      }
    </style>
  `
  return L.divIcon({
    html,
    className: 'user-pin',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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

// Ajusta o zoom inicial: prioriza focusCenter, senão fitBounds nos pins
function FitBounds({ imoveis, focusCenter }: { imoveis: PinImovel[]; focusCenter?: Props['focusCenter'] }) {
  const map = useMap()
  useEffect(() => {
    if (focusCenter) {
      map.flyTo([focusCenter.lat, focusCenter.lng], focusCenter.zoom ?? 15, { duration: 0.8 })
      return
    }
    if (!imoveis.length) return
    const points = imoveis.map(i => [i.lat, i.lng] as [number, number])
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCenter?.lat, focusCenter?.lng, focusCenter?.zoom])
  return null
}

// Centraliza no usuário com zoom EXATO pro raio caber na viewport.
// Usa os bounds do círculo (raio em metros) → flyToBounds: zoom e raio
// ficam sincronizados matematicamente, sem buckets fixos.
function FlyToUser({ pos, raio }: { pos: [number, number] | null; raio: number }) {
  const map = useMap()
  useEffect(() => {
    if (!pos) return
    const bounds = L.latLng(pos[0], pos[1]).toBounds(raio * 1000 * 2) // raio×2 = diâmetro
    map.flyToBounds(bounds, { padding: [24, 24], duration: 0.6, maxZoom: 16 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos?.[0], pos?.[1], raio])
  return null
}

export default function MapaImoveis({ imoveis, height = 360, containerClassName, onBoundsChange, focusCenter }: Props) {
  const [userPos, setUserPos] = useState<[number, number] | null>(null)
  const [raioKm, setRaioKm] = useState<number>(3)
  const [filtrarPorRaio, setFiltrarPorRaio] = useState<boolean>(true)
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const validos = useMemo(
    () => imoveis.filter(i => Number.isFinite(i.lat) && Number.isFinite(i.lng)),
    [imoveis]
  )

  const pinsExibidos = useMemo(() => {
    if (!userPos || !filtrarPorRaio) return validos
    return validos.filter(i => distanciaKm(userPos, [i.lat, i.lng]) <= raioKm)
  }, [validos, userPos, raioKm, filtrarPorRaio])

  const obterLocalizacao = () => {
    if (!('geolocation' in navigator)) {
      setErro('Seu navegador não suporta geolocalização.')
      return
    }
    setErro(null)
    setBuscando(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserPos([pos.coords.latitude, pos.coords.longitude])
        setBuscando(false)
      },
      err => {
        setBuscando(false)
        if (err.code === err.PERMISSION_DENIED) setErro('Permissão de localização negada.')
        else if (err.code === err.POSITION_UNAVAILABLE) setErro('Localização indisponível.')
        else if (err.code === err.TIMEOUT) setErro('Tempo esgotado. Tente de novo.')
        else setErro('Falha ao obter localização.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  const limparLocalizacao = () => {
    setUserPos(null)
    setErro(null)
  }

  const center: [number, number] = userPos ?? (focusCenter
    ? [focusCenter.lat, focusCenter.lng]
    : validos.length
      ? [validos[0].lat, validos[0].lng]
      : CUIABA)

  return (
    <div
      style={containerClassName ? undefined : { height }}
      className={containerClassName ?? 'rounded-2xl overflow-hidden border border-gray-200 relative z-0'}
    >
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        {/* CartoDB Positron — base clara/limpa, gratuita, atribuição obrigatória. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={20}
        />

        <FitBounds imoveis={pinsExibidos} focusCenter={focusCenter} />
        <FlyToUser pos={userPos} raio={raioKm} />
        <MapEventsHandler onBoundsChange={onBoundsChange} />

        {/* Círculo do raio */}
        {userPos && filtrarPorRaio && (
          <Circle
            center={userPos}
            radius={raioKm * 1000}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.08,
              weight: 1.5,
            }}
          />
        )}

        {/* Pin do usuário */}
        {userPos && (
          <Marker position={userPos} icon={criarIconeUsuario()}>
            <Popup closeButton={false}>
              <div className="text-xs font-sans">
                <p className="font-bold text-blue-700">Você está aqui</p>
                <p className="text-gray-500 mt-0.5">
                  Mostrando imóveis até {raioKm < 1 ? `${(raioKm * 1000).toFixed(0)} m` : `${raioKm} km`} de distância.
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {pinsExibidos.map(im => {
          const bairroObj = Array.isArray(im.bairro) ? im.bairro[0] : im.bairro
          const foto = fotoDestaque(im.fotos)
          const url = im.slug && bairroObj?.slug
            ? buildImovelUrl({ id: im.id, slug: im.slug, bairro: bairroObj } as unknown as Parameters<typeof buildImovelUrl>[0])
            : `/imoveis/${im.id}`
          const dist = userPos ? distanciaKm(userPos, [im.lat, im.lng]) : null
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
                  <p className="text-gray-700 text-xs line-clamp-2 mb-1">{im.titulo}</p>
                  {dist !== null && (
                    <p className="text-[10px] text-blue-700 mb-2">
                      📍 a {dist < 1 ? `${(dist * 1000).toFixed(0)} m` : `${dist.toFixed(1)} km`} de você
                    </p>
                  )}
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

      {/* Controles de localização — flutuam sobre o mapa */}
      <ControlesLocalizacao
        ativo={!!userPos}
        buscando={buscando}
        erro={erro}
        raio={raioKm}
        onRaio={setRaioKm}
        onAtivar={obterLocalizacao}
        onDesativar={limparLocalizacao}
        filtrar={filtrarPorRaio}
        onToggleFiltrar={() => setFiltrarPorRaio(v => !v)}
        totalNoRaio={pinsExibidos.length}
        totalGeral={validos.length}
      />
    </div>
  )
}

function ControlesLocalizacao({
  ativo, buscando, erro, raio, onRaio, onAtivar, onDesativar,
  filtrar, onToggleFiltrar, totalNoRaio, totalGeral,
}: {
  ativo: boolean
  buscando: boolean
  erro: string | null
  raio: number
  onRaio: (v: number) => void
  onAtivar: () => void
  onDesativar: () => void
  filtrar: boolean
  onToggleFiltrar: () => void
  totalNoRaio: number
  totalGeral: number
}) {
  if (!ativo && !buscando && !erro) {
    return (
      <button
        type="button"
        onClick={onAtivar}
        className="absolute top-3 right-3 z-[400] flex items-center gap-1.5 bg-white hover:bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-2 rounded-xl shadow-lg border border-gray-200 transition-colors"
        title="Mostrar imóveis perto de mim"
      >
        <Locate size={13} /> Minha localização
      </button>
    )
  }

  if (buscando) {
    return (
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-1.5 bg-white text-blue-700 text-xs font-medium px-3 py-2 rounded-xl shadow-lg border border-gray-200">
        <Loader2 size={13} className="animate-spin" /> Buscando localização…
      </div>
    )
  }

  if (erro && !ativo) {
    return (
      <div className="absolute top-3 right-3 z-[400] bg-red-50 text-red-700 text-xs font-medium px-3 py-2 rounded-xl shadow-lg border border-red-200 max-w-[260px]">
        <div className="flex items-start gap-2">
          <LocateOff size={13} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">{erro}</p>
            <button onClick={onAtivar} className="underline text-red-700 hover:text-red-900">
              tentar de novo
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute top-3 right-3 z-[400] bg-white rounded-xl shadow-lg border border-gray-200 p-3 w-64">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
          <Locate size={12} /> Sua localização
        </span>
        <button onClick={onDesativar} title="Limpar" className="text-gray-300 hover:text-gray-600">
          <X size={13} />
        </button>
      </div>

      <label className="flex items-center justify-between text-[11px] text-gray-700 cursor-pointer mb-2">
        <span>Filtrar pelo raio</span>
        <input
          type="checkbox"
          checked={filtrar}
          onChange={onToggleFiltrar}
          className="w-3.5 h-3.5 accent-blue-600"
        />
      </label>

      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-gray-500">Raio</span>
          <span className="font-semibold text-blue-700">
            {raio < 1 ? `${(raio * 1000).toFixed(0)} m` : `${raio} km`}
          </span>
        </div>
        <input
          type="range"
          min={0.5}
          max={20}
          step={0.5}
          value={raio}
          onChange={e => onRaio(parseFloat(e.target.value))}
          disabled={!filtrar}
          className="w-full accent-blue-600 disabled:opacity-40"
        />
        <div className="flex justify-between text-[9px] text-gray-300 mt-0.5">
          <span>500 m</span>
          <span>5 km</span>
          <span>10 km</span>
          <span>20 km</span>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-gray-100">
        {filtrar
          ? <><strong className="text-blue-700">{totalNoRaio}</strong> de {totalGeral} imóvel{totalGeral === 1 ? '' : 'is'} no raio</>
          : <>Filtro desativado · mostrando todos ({totalGeral})</>
        }
      </p>
    </div>
  )
}
