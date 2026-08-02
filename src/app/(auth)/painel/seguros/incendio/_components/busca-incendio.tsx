'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search, X } from 'lucide-react'

interface Props {
  q?: string
  status?: string
}

const FILTROS: [string, string][] = [
  ['calculada', 'Cotados'],
  ['contratada', 'Contratados'],
  ['cancelada', 'Cancelados'],
]

const BASE = '/painel/seguros/incendio'

export function BuscaIncendio({ q, status }: Props) {
  const router = useRouter()
  const [termo, setTermo] = useState(q ?? '')

  const navegar = (novoQ: string, novoStatus?: string) => {
    const sp = new URLSearchParams()
    if (novoQ.trim()) sp.set('q', novoQ.trim())
    if (novoStatus) sp.set('status', novoStatus)
    const qs = sp.toString()
    router.push(qs ? `${BASE}?${qs}` : BASE)
  }

  return (
    <div className="space-y-2">
      <form onSubmit={e => { e.preventDefault(); navegar(termo, status) }} className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={termo}
          onChange={e => setTermo(e.target.value)}
          placeholder="Buscar por inquilino, endereço, contrato ou nº"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        {termo && (
          <button
            type="button"
            onClick={() => { setTermo(''); navegar('', status) }}
            aria-label="Limpar busca"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
          >
            <X size={15} />
          </button>
        )}
      </form>

      <div className="flex gap-1.5 flex-wrap">
        <Chip ativo={!status} onClick={() => navegar(termo)}>Todos</Chip>
        {FILTROS.map(([valor, rotulo]) => (
          <Chip key={valor} ativo={status === valor} onClick={() => navegar(termo, valor)}>
            {rotulo}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({ ativo, onClick, children }: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
        ativo
          ? 'bg-orange-600 border-orange-600 text-white'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}
