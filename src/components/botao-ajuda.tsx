'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { HelpCircle, X, Loader2, ExternalLink } from 'lucide-react'

interface Props {
  slug: string
  // Pequeno '?' inline ao lado de um label. Tamanho default = 14px.
  size?: number
  className?: string
  // Texto alternativo no tooltip
  titulo?: string
}

interface Conteudo {
  titulo: string
  resumo: string | null
  conteudo_html: string
  atualizado_em: string
}

// Cache em memória — evita refetch ao reabrir o mesmo modal
const cache = new Map<string, Conteudo>()

export function BotaoAjuda({ slug, size = 14, className = '', titulo = 'Ajuda' }: Props) {
  const [aberto, setAberto] = useState(false)
  const [conteudo, setConteudo] = useState<Conteudo | null>(cache.get(slug) ?? null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Fecha com Escape
  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [aberto])

  // Trava scroll do body enquanto aberto
  useEffect(() => {
    if (!aberto) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [aberto])

  const abrir = async () => {
    setAberto(true)
    if (conteudo || carregando) return
    setCarregando(true)
    setErro(null)
    abortRef.current?.abort()
    const ctl = new AbortController()
    abortRef.current = ctl
    try {
      const r = await fetch(`/api/ajuda/${encodeURIComponent(slug)}`, { signal: ctl.signal })
      if (r.status === 404) { setErro('Esta seção de ajuda ainda não foi criada.'); return }
      if (r.status === 503) { setErro('Sistema de ajuda em configuração. Tente novamente em instantes.'); return }
      if (!r.ok) { setErro('Não consegui carregar a ajuda.'); return }
      const data = await r.json() as Conteudo
      cache.set(slug, data)
      setConteudo(data)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setErro('Erro de rede.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        title={titulo}
        aria-label={titulo}
        className={`inline-flex items-center justify-center text-gray-400 hover:text-violet-700 transition-colors ${className}`}
      >
        <HelpCircle size={size} />
      </button>

      {aberto && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
          onClick={() => setAberto(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <header className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2 min-w-0">
                <HelpCircle size={16} className="text-violet-600 shrink-0" />
                <h2 className="font-bold text-gray-900 truncate">
                  {conteudo?.titulo ?? 'Ajuda'}
                </h2>
              </div>
              <button
                onClick={() => setAberto(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {carregando && !conteudo && (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              )}
              {erro && (
                <p className="text-sm text-red-600 py-4">{erro}</p>
              )}
              {conteudo && (
                <>
                  {conteudo.resumo && (
                    <p className="text-sm text-gray-500 mb-3 italic">{conteudo.resumo}</p>
                  )}
                  <div
                    className="prose prose-sm prose-violet max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-a:text-violet-700"
                    dangerouslySetInnerHTML={{ __html: conteudo.conteudo_html || '<p class="text-gray-400">Sem conteúdo ainda.</p>' }}
                  />
                </>
              )}
            </div>

            <footer className="flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50">
              <Link
                href={`/painel/ajuda/${slug}`}
                className="text-xs text-violet-700 hover:text-violet-800 inline-flex items-center gap-1"
                onClick={() => setAberto(false)}
              >
                Abrir página completa <ExternalLink size={11} />
              </Link>
              <button
                onClick={() => setAberto(false)}
                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded"
              >
                Fechar
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
