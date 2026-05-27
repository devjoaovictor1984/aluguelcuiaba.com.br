'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bug, Lightbulb, HelpCircle, MessageSquare, Check, X, Clock, Inbox } from 'lucide-react'
import { atualizarStatusSugestao, type StatusSugestao } from '../../../_actions/sugestoes'

interface Sugestao {
  id: string
  user_id: string
  user_email: string | null
  user_nome: string | null
  pagina_url: string | null
  pagina_titulo: string | null
  user_agent: string | null
  categoria: 'bug' | 'sugestao' | 'duvida' | 'outro'
  mensagem: string
  status: StatusSugestao
  resposta_admin: string | null
  respondido_em: string | null
  created_at: string
}

const categoriaInfo = {
  bug:      { label: 'Bug',      icone: Bug,           cor: 'bg-rose-100 text-rose-700 border-rose-200' },
  sugestao: { label: 'Sugestão', icone: Lightbulb,     cor: 'bg-violet-100 text-violet-700 border-violet-200' },
  duvida:   { label: 'Dúvida',   icone: HelpCircle,    cor: 'bg-amber-100 text-amber-700 border-amber-200' },
  outro:    { label: 'Outro',    icone: MessageSquare, cor: 'bg-gray-100 text-gray-700 border-gray-200' },
}

const statusInfo: Record<StatusSugestao, { label: string; cor: string; icone: typeof Check }> = {
  nova:           { label: 'Nova',          cor: 'bg-blue-100 text-blue-700',    icone: Inbox },
  em_analise:     { label: 'Em análise',    cor: 'bg-amber-100 text-amber-700',  icone: Clock },
  implementada:   { label: 'Implementada',  cor: 'bg-emerald-100 text-emerald-700', icone: Check },
  descartada:     { label: 'Descartada',    cor: 'bg-gray-100 text-gray-600',    icone: X },
}

function fmtData(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function SugestoesAdminCliente({ sugestoes }: { sugestoes: Sugestao[] }) {
  const router = useRouter()
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusSugestao>('nova')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [resposta, setResposta] = useState('')
  const [isPending, startTransition] = useTransition()

  const filtradas = useMemo(() => {
    if (filtroStatus === 'todos') return sugestoes
    return sugestoes.filter(s => s.status === filtroStatus)
  }, [sugestoes, filtroStatus])

  const contagem = useMemo(() => {
    const out: Record<string, number> = { todos: sugestoes.length, nova: 0, em_analise: 0, implementada: 0, descartada: 0 }
    for (const s of sugestoes) out[s.status]++
    return out
  }, [sugestoes])

  const onAtualizar = (id: string, status: StatusSugestao, comResposta: boolean) => {
    startTransition(async () => {
      const r = await atualizarStatusSugestao(id, status, comResposta ? resposta : null)
      if (r.error) { alert(r.error); return }
      setEditandoId(null)
      setResposta('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['todos', 'nova', 'em_analise', 'implementada', 'descartada'] as const).map(s => {
          const ativo = filtroStatus === s
          const label = s === 'todos' ? 'Todos' : statusInfo[s].label
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFiltroStatus(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                ativo ? 'bg-violet-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label} <span className="opacity-70">({contagem[s] ?? 0})</span>
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
          Nada por aqui.
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map(s => {
            const cat = categoriaInfo[s.categoria]
            const st = statusInfo[s.status]
            const IconeCat = cat.icone
            const IconeSt = st.icone
            const editando = editandoId === s.id

            return (
              <article key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <header className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-medium ${cat.cor}`}>
                      <IconeCat size={12} /> {cat.label}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium ${st.cor}`}>
                      <IconeSt size={12} /> {st.label}
                    </span>
                    <span className="text-xs text-gray-400">{fmtData(s.created_at)}</span>
                  </div>
                </header>

                <div className="space-y-2 mb-3">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{s.mensagem}</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-2 text-[11px] text-gray-500 bg-gray-50 rounded-lg p-2.5">
                  <p>
                    <strong className="text-gray-600">De:</strong>{' '}
                    {s.user_nome ?? '—'} {s.user_email && <span className="text-gray-400">· {s.user_email}</span>}
                  </p>
                  {s.pagina_url && (
                    <p>
                      <strong className="text-gray-600">Página:</strong>{' '}
                      <span className="font-mono">{s.pagina_url}</span>
                    </p>
                  )}
                </div>

                {s.resposta_admin && (
                  <div className="mt-3 bg-violet-50 border border-violet-100 rounded-lg p-3">
                    <p className="text-[11px] font-semibold text-violet-700 mb-1">Resposta do admin</p>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{s.resposta_admin}</p>
                  </div>
                )}

                {editando ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={resposta}
                      onChange={e => setResposta(e.target.value)}
                      rows={3}
                      placeholder="Resposta opcional pro usuário ver futuramente..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900 resize-none"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onAtualizar(s.id, 'em_analise', true)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                      >
                        Marcar em análise
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onAtualizar(s.id, 'implementada', true)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                      >
                        Implementada
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onAtualizar(s.id, 'descartada', true)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                      >
                        Descartar
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditandoId(null); setResposta('') }}
                        className="text-xs text-gray-500 hover:underline ml-auto"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => { setEditandoId(s.id); setResposta(s.resposta_admin ?? '') }}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      Triar
                    </button>
                    {s.status !== 'em_analise' && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onAtualizar(s.id, 'em_analise', false)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                      >
                        → Em análise
                      </button>
                    )}
                    {s.status !== 'implementada' && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onAtualizar(s.id, 'implementada', false)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        ✓ Implementada
                      </button>
                    )}
                    {s.status !== 'descartada' && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onAtualizar(s.id, 'descartada', false)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                      >
                        ✗ Descartar
                      </button>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
