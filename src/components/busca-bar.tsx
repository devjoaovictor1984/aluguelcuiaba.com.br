'use client'

import { FormEvent, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

interface Props {
  inicial?: string
}

export function BuscaBar({ inicial = '' }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [valor, setValor] = useState(inicial)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    const q = valor.trim()
    if (q) {
      params.set('busca', q)
    } else {
      params.delete('busca')
    }
    // Limpa filtros que o parser vai redefinir, evitando "duplo filtro"
    params.delete('tipo')
    params.delete('bairro')
    params.delete('quartos')
    params.delete('bbox')
    router.push(`/?${params.toString()}`)
  }

  const limpar = () => {
    setValor('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('busca')
    router.push(`/?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-xl">
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={valor}
        onChange={e => setValor(e.target.value)}
        placeholder="Ex: apartamento 2 quartos no centro"
        className="w-full pl-10 pr-20 py-2.5 rounded-full bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400 shadow-sm"
      />
      {valor && (
        <button
          type="button"
          onClick={limpar}
          aria-label="Limpar busca"
          className="absolute right-20 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      )}
      <button
        type="submit"
        className="absolute right-1 top-1/2 -translate-y-1/2 bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors"
      >
        Buscar
      </button>
    </form>
  )
}
