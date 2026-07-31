'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { STATUS_RESUMO_LABEL } from '@/lib/seguros/status-ui'

interface Props {
  q?: string
  status?: string
  base: string
}

const FILTROS = ['analisando', 'aprovado', 'recusado'] as const

export function BuscaSeguros({ q, status, base }: Props) {
  const router = useRouter()
  const [termo, setTermo] = useState(q ?? '')

  const navegar = (novoQ: string, novoStatus?: string) => {
    const sp = new URLSearchParams()
    if (novoQ.trim()) sp.set('q', novoQ.trim())
    if (novoStatus) sp.set('status', novoStatus)
    const qs = sp.toString()
    router.push(qs ? `${base}?${qs}` : base)
  }

  return (
    <div className="space-y-2">
      <form
        onSubmit={e => { e.preventDefault(); navegar(termo, status) }}
        className="relative"
      >
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={termo}
          onChange={e => setTermo(e.target.value)}
          placeholder="Buscar por inquilino, CPF, contrato ou nº da cotação"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
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
        <Chip ativo={!status} onClick={() => navegar(termo)}>Todas</Chip>
        {FILTROS.map(f => (
          <Chip key={f} ativo={status === f} onClick={() => navegar(termo, f)}>
            {STATUS_RESUMO_LABEL[f]}
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
          ? 'bg-violet-700 border-violet-700 text-white'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}
