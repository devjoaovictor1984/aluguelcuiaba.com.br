'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Loader2, CheckCircle2, XCircle, MapPin } from 'lucide-react'

interface Props {
  totalSem: number
}

interface ResultadoItem {
  id: string
  status: 'ok' | 'nao_encontrado' | 'erro'
  lat?: number
  lng?: number
  erro?: string
}

const DELAY_MS = 1100 // Nominatim: 1 req/s + folga

export function BackfillButton({ totalSem }: Props) {
  const router = useRouter()
  const [rodando, setRodando] = useState(false)
  const [processados, setProcessados] = useState(0)
  const [total, setTotal] = useState(0)
  const [resultados, setResultados] = useState<ResultadoItem[]>([])

  const okCount = resultados.filter(r => r.status === 'ok').length
  const erroCount = resultados.filter(r => r.status !== 'ok').length

  async function rodar() {
    setRodando(true)
    setResultados([])
    setProcessados(0)

    try {
      // 1. Busca IDs sem coords
      const listRes = await fetch('/api/admin/imoveis-sem-coords')
      if (!listRes.ok) {
        alert('Erro ao listar imóveis. Você está logado como admin?')
        setRodando(false)
        return
      }
      const { ids } = await listRes.json() as { ids: string[] }
      setTotal(ids.length)

      if (!ids.length) {
        alert('Nenhum imóvel para processar.')
        setRodando(false)
        return
      }

      // 2. Itera com delay
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]
        try {
          const res = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imovel_id: id }),
          })
          const data = await res.json() as { ok: boolean; lat?: number; lng?: number; error?: string }

          if (data.ok && data.lat && data.lng) {
            setResultados(prev => [...prev, { id, status: 'ok', lat: data.lat, lng: data.lng }])
          } else {
            setResultados(prev => [...prev, { id, status: data.error === 'Endereço não encontrado' ? 'nao_encontrado' : 'erro', erro: data.error }])
          }
        } catch (err) {
          setResultados(prev => [...prev, { id, status: 'erro', erro: err instanceof Error ? err.message : String(err) }])
        }

        setProcessados(i + 1)

        if (i < ids.length - 1) {
          await new Promise(r => setTimeout(r, DELAY_MS))
        }
      }

      // 3. Refresca contadores no servidor
      router.refresh()
    } finally {
      setRodando(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={rodar}
        disabled={rodando || totalSem === 0}
        className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-5 rounded-xl transition-colors text-sm"
      >
        {rodando ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
        {rodando
          ? `Geocodando ${processados}/${total}... (~${Math.ceil(((total - processados) * DELAY_MS) / 1000)}s restantes)`
          : totalSem === 0
            ? 'Nada a fazer — todos os imóveis já têm coordenadas'
            : `Geocodar ${totalSem} imóv${totalSem === 1 ? 'el' : 'eis'}`
        }
      </button>

      {resultados.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-700">Progresso</span>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-green-600 font-medium">
                <CheckCircle2 size={13} /> {okCount}
              </span>
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <XCircle size={13} /> {erroCount}
              </span>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {resultados.map((r, i) => (
              <div key={i} className="px-5 py-2 flex items-center gap-2 text-xs">
                {r.status === 'ok' ? (
                  <>
                    <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                    <span className="text-gray-500 font-mono truncate">{r.id.slice(0, 8)}</span>
                    <span className="text-gray-700 ml-auto flex items-center gap-1">
                      <MapPin size={11} />
                      {r.lat?.toFixed(4)}, {r.lng?.toFixed(4)}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle size={13} className="text-amber-500 shrink-0" />
                    <span className="text-gray-500 font-mono truncate">{r.id.slice(0, 8)}</span>
                    <span className="text-amber-600 ml-auto">{r.erro ?? r.status}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
