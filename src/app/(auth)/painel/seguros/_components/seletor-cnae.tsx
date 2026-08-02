'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, Loader2, Check } from 'lucide-react'
import { buscarAtividadesCnae } from '../actions'

interface ItemCnae {
  id: string
  descricao: string
}

interface Props {
  valor: string
  descricao: string
  onChange: (id: string, descricao: string) => void
  inputCls: string
  disabled?: boolean
}

/**
 * Busca de atividade CNAE.
 *
 * A API devolve o catálogo inteiro — milhares de linhas — sem busca nem
 * paginação. Um `<select>` com tudo travaria o navegador e ninguém
 * escolhe entre mil opções: quem procura, digita. Daí a busca com
 * atraso, filtrando no servidor a partir do catálogo cacheado.
 */
export function SeletorCnae({ valor, descricao, onChange, inputCls, disabled }: Props) {
  const [termo, setTermo] = useState('')
  const [itens, setItens] = useState<ItemCnae[]>([])
  const [aberto, setAberto] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState('')
  const container = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora — sem isso a lista fica presa na tela.
  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (container.current && !container.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  // Espera o usuário parar de digitar antes de consultar.
  useEffect(() => {
    if (!aberto) return
    let cancelado = false
    const t = setTimeout(async () => {
      setBuscando(true)
      const r = await buscarAtividadesCnae(termo)
      if (cancelado) return
      setBuscando(false)
      if ('error' in r) { setErro(r.error!); setItens([]); return }
      setErro('')
      setItens(r.itens ?? [])
    }, 300)

    return () => { cancelado = true; clearTimeout(t) }
  }, [termo, aberto])

  const escolher = (i: ItemCnae) => {
    onChange(i.id, i.descricao)
    setAberto(false)
    setTermo('')
  }

  return (
    <div ref={container} className="relative">
      {valor ? (
        <div className="flex items-start gap-2 rounded-lg bg-violet-50 ring-1 ring-violet-100 px-3 py-2">
          <Check size={14} className="text-violet-700 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-violet-900 leading-tight">{descricao || valor}</p>
            <p className="text-[11px] text-violet-700 tabular-nums">código {valor}</p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => { onChange('', ''); setAberto(true) }}
              aria-label="Trocar atividade"
              className="shrink-0 text-violet-400 hover:text-violet-700"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={termo}
              onChange={e => { setTermo(e.target.value); setAberto(true) }}
              onFocus={() => setAberto(true)}
              disabled={disabled}
              placeholder="Digite a atividade ou o código"
              className={`${inputCls} pl-9`}
            />
            {buscando && (
              <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
            )}
          </div>

          {aberto && (
            <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl bg-white ring-1 ring-gray-200 shadow-lg">
              {erro ? (
                <p className="px-3 py-3 text-xs text-rose-700">{erro}</p>
              ) : itens.length === 0 ? (
                <p className="px-3 py-3 text-xs text-gray-500">
                  {buscando ? 'Buscando…' : termo ? 'Nenhuma atividade encontrada.' : 'Digite para buscar.'}
                </p>
              ) : (
                itens.map(i => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => escolher(i)}
                    className="w-full text-left px-3 py-2 hover:bg-violet-50 border-b border-gray-50 last:border-0"
                  >
                    <p className="text-sm text-gray-900 leading-tight">{i.descricao}</p>
                    <p className="text-[11px] text-gray-400 tabular-nums">{i.id}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
