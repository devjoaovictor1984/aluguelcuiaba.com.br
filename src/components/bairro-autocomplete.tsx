'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type { Bairro } from '@/types'

interface Props {
  bairros: Bairro[]
  value: string // slug do bairro selecionado
  onChange: (slug: string) => void
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function BairroAutocomplete({ bairros, value, onChange }: Props) {
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selecionado = bairros.find(b => b.slug === value)

  // Quando muda a seleção externa (filtro limpo, navegação), reseta busca
  useEffect(() => {
    if (!value) setBusca('')
  }, [value])

  // Click fora fecha o dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim())
    if (!termo) return bairros.slice(0, 100)
    return bairros
      .filter(b => normalizar(b.nome).includes(termo))
      .slice(0, 30)
  }, [busca, bairros])

  const handleSelect = (slug: string) => {
    onChange(slug)
    setAberto(false)
    setBusca('')
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!aberto) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setAberto(true)
        return
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(i => Math.min(i + 1, filtrados.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted === 0) {
        handleSelect('')
      } else {
        const b = filtrados[highlighted - 1]
        if (b) handleSelect(b.slug)
      }
    } else if (e.key === 'Escape') {
      setAberto(false)
    }
  }

  const displayValue = aberto ? busca : (selecionado?.nome ?? busca)

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={e => { setBusca(e.target.value); setAberto(true); setHighlighted(0) }}
          onFocus={() => { setAberto(true); setBusca('') }}
          onKeyDown={handleKeyDown}
          placeholder="Digite o nome do bairro..."
          className="w-full pl-3 pr-16 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:ring-2 focus:ring-violet-200 bg-white"
        />
        {selecionado && !aberto && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Limpar bairro"
            className="absolute right-7 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
          >
            <X size={13} />
          </button>
        )}
        <ChevronDown
          size={14}
          className={`absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`}
        />
      </div>

      {aberto && (
        <ul
          ref={listRef}
          className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1"
        >
          <li>
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                highlighted === 0 ? 'bg-violet-50 text-violet-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Todos os bairros
            </button>
          </li>
          {filtrados.length === 0 ? (
            <li className="px-3 py-2 text-xs text-gray-400 italic">Nenhum bairro encontrado</li>
          ) : (
            filtrados.map((b, i) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(b.slug)}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                    highlighted === i + 1
                      ? 'bg-violet-50 text-violet-700'
                      : value === b.slug
                        ? 'bg-gray-50 text-violet-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {b.nome}
                  {b.regiao && <span className="text-xs text-gray-400 ml-2">{b.regiao}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
