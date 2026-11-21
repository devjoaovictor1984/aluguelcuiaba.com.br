'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X, Loader2, Users, User } from 'lucide-react'

/**
 * Busca + ordenação + (só admin) escopo "meus / todos".
 * Escreve na URL com `replace` e `scroll: false`: digitar não empilha
 * histórico nem joga a página pro topo. A busca volta pra página 1.
 */
export function BarraAnuncios({ q, ordem, isAdmin, verTodos }: {
  q: string; ordem: string; isAdmin: boolean; verTodos: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [texto, setTexto] = useState(q)
  const [pendente, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const aplicar = (mudar: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(mudar)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    p.delete('pagina')
    // Avisos de "salvo/excluído" não devem voltar a cada busca.
    p.delete('atualizado'); p.delete('publicado'); p.delete('excluido')
    const s = p.toString()
    startTransition(() => router.replace(`${pathname}${s ? `?${s}` : ''}`, { scroll: false }))
  }

  // Debounce de 350ms: busca enquanto digita sem uma consulta por tecla.
  useEffect(() => {
    if (texto.trim() === q) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => aplicar({ q: texto.trim() || null }), 350)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto])

  return (
    <div className="flex flex-col sm:flex-row gap-2 mb-4">
      <label className="relative flex-1">
        <span className="sr-only">Buscar anúncios</span>
        {pendente
          ? <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-500 animate-spin" />
          : <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
        <input
          type="search"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Buscar por título, bairro, condomínio ou endereço"
          className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
        />
        {texto && (
          <button
            type="button"
            onClick={() => { setTexto(''); aplicar({ q: null }) }}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
          >
            <X size={14} />
          </button>
        )}
      </label>

      <div className="flex gap-2">
        <select
          value={ordem}
          onChange={e => aplicar({ ordem: e.target.value === 'recentes' ? null : e.target.value })}
          aria-label="Ordenar"
          className="flex-1 sm:flex-none bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        >
          <option value="recentes">Mais recentes</option>
          <option value="atualizados">Atualizados por último</option>
          <option value="antigos">Mais antigos</option>
          <option value="preco_maior">Maior preço</option>
          <option value="preco_menor">Menor preço</option>
          <option value="visitas">Mais visitados</option>
          <option value="expira">Expiram primeiro</option>
        </select>

        {/* Só o admin vê — e o servidor ignora ?escopo=todos para os demais. */}
        {isAdmin && (
          <div className="flex bg-gray-100 rounded-xl p-1" role="group" aria-label="Escopo">
            <button
              type="button"
              onClick={() => aplicar({ escopo: null })}
              aria-pressed={!verTodos}
              className={`flex items-center gap-1 px-2.5 text-xs font-semibold rounded-lg ${!verTodos ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >
              <User size={13} /> Meus
            </button>
            <button
              type="button"
              onClick={() => aplicar({ escopo: 'todos' })}
              aria-pressed={verTodos}
              className={`flex items-center gap-1 px-2.5 text-xs font-semibold rounded-lg ${verTodos ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >
              <Users size={13} /> Todos
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
