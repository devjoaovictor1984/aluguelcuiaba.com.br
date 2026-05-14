'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Check, Loader2, ExternalLink, AlertCircle } from 'lucide-react'
import { salvarCoords } from '../actions'

interface Props {
  imovel: {
    id: string
    titulo: string
    endereco_resumido: string | null
    bairro_nome: string | null
  }
}

export function LinhaCoords({ imovel }: Props) {
  const router = useRouter()
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState('')
  const [salvo, setSalvo] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Aceita "lat, lng" ou "lat,lng" ou "lat lng"
  function parseCoords(s: string): { lat: number; lng: number } | null {
    const partes = s.trim().split(/[,\s]+/).filter(Boolean)
    if (partes.length !== 2) return null
    const lat = parseFloat(partes[0].replace(',', '.'))
    const lng = parseFloat(partes[1].replace(',', '.'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  }

  const buscaGoogle = encodeURIComponent(
    [imovel.endereco_resumido, imovel.bairro_nome, 'Cuiabá MT'].filter(Boolean).join(', ')
  )

  const handleSalvar = () => {
    setErro('')
    const c = parseCoords(valor)
    if (!c) {
      setErro('Cole no formato "lat, lng". Ex: -15.5989, -56.0949')
      return
    }
    startTransition(async () => {
      const r = await salvarCoords(imovel.id, c.lat, c.lng)
      if (r.error) {
        setErro(r.error)
        return
      }
      setSalvo(true)
      setTimeout(() => router.refresh(), 800)
    })
  }

  if (salvo) {
    return (
      <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center gap-2 text-sm text-green-700">
        <Check size={16} />
        Salvo! Atualizando…
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900 line-clamp-1">{imovel.titulo}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {imovel.endereco_resumido ?? <span className="italic text-gray-400">sem endereço</span>}
          {imovel.bairro_nome && <span className="text-gray-400"> · {imovel.bairro_nome}</span>}
        </p>
      </div>

      <a
        href={`https://www.google.com/maps/search/?api=1&query=${buscaGoogle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium"
      >
        <ExternalLink size={11} />
        Abrir no Google Maps
      </a>

      <div className="flex gap-2">
        <input
          type="text"
          value={valor}
          onChange={e => setValor(e.target.value)}
          placeholder="-15.5989, -56.0949"
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-mono"
        />
        <button
          onClick={handleSalvar}
          disabled={isPending || !valor.trim()}
          className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-xs font-semibold px-4 rounded-lg transition-colors"
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
          Salvar
        </button>
      </div>

      {erro && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle size={12} />
          {erro}
        </div>
      )}
    </div>
  )
}
