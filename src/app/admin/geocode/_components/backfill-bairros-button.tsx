'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Loader2, CheckCircle2 } from 'lucide-react'

interface Props {
  total: number
}

export function BackfillBairrosButton({ total }: Props) {
  const router = useRouter()
  const [rodando, setRodando] = useState(false)
  const [resultado, setResultado] = useState<{ encontrados: number; processados: number; erros?: string[] } | null>(null)

  async function rodar() {
    setRodando(true)
    setResultado(null)
    try {
      const res = await fetch('/api/admin/geocode-bairros', { method: 'POST' })
      if (!res.ok) {
        alert('Erro ao geocodar bairros. Você está logado como admin?')
        return
      }
      const data = await res.json()
      setResultado(data)
      router.refresh()
    } finally {
      setRodando(false)
    }
  }

  if (total === 0 && !resultado) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
        <CheckCircle2 size={14} />
        Todos os bairros já têm coordenadas.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button
        onClick={rodar}
        disabled={rodando || total === 0}
        className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors"
      >
        {rodando ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
        {rodando
          ? `Geocodando bairros... (~${Math.ceil((total * 1.1))}s)`
          : `Geocodar ${total} bairro${total === 1 ? '' : 's'}`
        }
      </button>

      {resultado && (
        <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
          <p className="text-gray-700">
            <strong>{resultado.encontrados}</strong> de {resultado.processados} bairros geocodados.
          </p>
          {resultado.erros && resultado.erros.length > 0 && (
            <p className="text-amber-700">
              Não encontrados: {resultado.erros.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
