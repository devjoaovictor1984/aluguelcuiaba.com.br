'use client'

import { useState, KeyboardEvent } from 'react'
import { X, Tag } from 'lucide-react'

interface Props {
  value: string[]
  onChange: (tags: string[]) => void
  sugestoes?: string[]
}

function normalizar(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')
}

export function TagsInput({ value, onChange, sugestoes = [] }: Props) {
  const [texto, setTexto] = useState('')

  const adicionar = (raw: string) => {
    const t = normalizar(raw)
    if (!t || value.includes(t)) return
    onChange([...value, t])
    setTexto('')
  }

  const remover = (t: string) => onChange(value.filter(x => x !== t))

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      adicionar(texto)
    } else if (e.key === 'Backspace' && !texto && value.length) {
      remover(value[value.length - 1])
    }
  }

  const sugestoesFiltradas = sugestoes
    .filter(s => !value.includes(s) && (texto === '' || normalizar(s).includes(normalizar(texto))))
    .slice(0, 6)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 px-3 py-2 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-violet-500 min-h-[48px] bg-white">
        {value.map(t => (
          <span
            key={t}
            className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-xs font-medium px-2 py-1 rounded-full"
          >
            <Tag size={10} />
            {t}
            <button
              type="button"
              onClick={() => remover(t)}
              aria-label={`Remover ${t}`}
              className="hover:bg-violet-200 rounded-full p-0.5"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => texto && adicionar(texto)}
          placeholder={value.length === 0 ? 'Ex: aluguel, contrato, fiador (Enter ou vírgula)' : ''}
          className="flex-1 min-w-[120px] outline-none text-sm bg-transparent text-gray-900 placeholder:text-gray-400"
        />
      </div>

      {sugestoesFiltradas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11px] text-gray-400 self-center">Sugestões:</span>
          {sugestoesFiltradas.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => adicionar(s)}
              className="text-xs text-gray-500 hover:text-violet-700 bg-gray-100 hover:bg-violet-50 px-2 py-0.5 rounded-full transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Use de 3 a 8 tags relevantes. Ajudam o Google a entender o tópico e melhoram a indexação.
      </p>
    </div>
  )
}
