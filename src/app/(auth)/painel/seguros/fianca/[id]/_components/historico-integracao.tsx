'use client'

import { useState } from 'react'
import { ChevronDown, Copy, Check, ArrowUpRight, ArrowDownLeft } from 'lucide-react'

/**
 * O que foi dito à corretora e o que ela respondeu, nesta análise.
 *
 * Existe para dar argumento. Quando a corretora diz "não recebemos" ou
 * "o problema é do lado de vocês", esta tela mostra o corpo exato da
 * requisição, o corpo exato da resposta, o código HTTP e o tempo — e o
 * botão de copiar entrega isso num bloco pronto para colar no e-mail.
 *
 * Os dados já vêm sanitizados de `seguro_eventos`: senha, token e PDF em
 * base64 nunca são gravados.
 */

export interface EventoIntegracao {
  id: string
  criadoEm: string
  endpoint: string
  direcao: string
  httpStatus: number | null
  duracaoMs: number | null
  erro: string | null
  request: unknown
  response: unknown
}

function corDoStatus(e: EventoIntegracao): string {
  if (e.erro) return 'bg-rose-50 text-rose-700 ring-rose-200'
  const s = e.httpStatus ?? 0
  if (s >= 200 && s < 300) return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (s >= 500) return 'bg-rose-50 text-rose-700 ring-rose-200'
  if (s >= 400) return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-gray-100 text-gray-600 ring-gray-200'
}

const hora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

/** O nome curto do endpoint — o caminho inteiro não cabe e não informa. */
const curto = (endpoint: string) => endpoint.split('/').filter(Boolean).pop() ?? endpoint

const json = (v: unknown) => {
  if (v == null) return null
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

function Bloco({ titulo, conteudo }: { titulo: string; conteudo: string | null }) {
  if (!conteudo) return null
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{titulo}</p>
      <pre className="text-[11px] leading-relaxed bg-gray-50 border border-gray-100 rounded-lg p-2.5 overflow-x-auto whitespace-pre text-gray-700">
        {conteudo}
      </pre>
    </div>
  )
}

export function HistoricoIntegracao({ eventos }: { eventos: EventoIntegracao[] }) {
  const [aberto, setAberto] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  if (!eventos.length) return null

  const copiar = async (e: EventoIntegracao) => {
    const texto = [
      `Data: ${hora(e.criadoEm)}`,
      `Endpoint: ${e.endpoint}`,
      `HTTP: ${e.httpStatus ?? '(sem resposta)'}${e.duracaoMs != null ? ` · ${e.duracaoMs}ms` : ''}`,
      e.erro ? `Erro: ${e.erro}` : null,
      '',
      'REQUISIÇÃO:',
      json(e.request) ?? '(vazia)',
      '',
      'RESPOSTA:',
      json(e.response) ?? '(vazia)',
    ].filter(l => l !== null).join('\n')

    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(e.id)
      setTimeout(() => setCopiado(null), 2000)
    } catch {/* sem clipboard: o texto continua visível na tela */}
  }

  const comFalha = eventos.filter(e => e.erro || (e.httpStatus ?? 0) >= 400).length

  return (
    <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        aria-expanded={aberto}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50"
      >
        <span className="text-left">
          <span className="block text-sm font-bold text-gray-900">Conversa com a corretora</span>
          <span className="block text-[11px] text-gray-500">
            {eventos.length} {eventos.length === 1 ? 'chamada' : 'chamadas'}
            {comFalha > 0 && <> · <span className="text-rose-600 font-semibold">{comFalha} com falha</span></>}
            {' '}· o que foi enviado e o que voltou
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`}
        />
      </button>

      {aberto && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {eventos.map(e => {
            const isAberto = expandido === e.id
            const Seta = e.direcao === 'entrada' ? ArrowDownLeft : ArrowUpRight
            return (
              <div key={e.id}>
                <button
                  type="button"
                  onClick={() => setExpandido(isAberto ? null : e.id)}
                  aria-expanded={isAberto}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 text-left"
                >
                  <Seta size={13} className="shrink-0 text-gray-400" />
                  <span className="font-mono text-[11px] text-gray-900 truncate flex-1">
                    {curto(e.endpoint)}
                  </span>
                  <span className={`shrink-0 text-[10px] font-bold tabular-nums rounded px-1.5 py-0.5 ring-1 ${corDoStatus(e)}`}>
                    {e.erro && e.httpStatus == null ? 'falhou' : e.httpStatus ?? '—'}
                  </span>
                  <span className="shrink-0 text-[10px] text-gray-400 tabular-nums w-14 text-right">
                    {e.duracaoMs != null ? `${(e.duracaoMs / 1000).toFixed(1)}s` : ''}
                  </span>
                  <span className="shrink-0 text-[10px] text-gray-400 tabular-nums hidden sm:block">
                    {hora(e.criadoEm)}
                  </span>
                </button>

                {isAberto && (
                  <div className="px-4 pb-3.5 space-y-2.5">
                    {e.erro && (
                      <p className="text-[11px] text-rose-800 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-2">
                        {e.erro}
                      </p>
                    )}
                    <Bloco titulo="Enviamos" conteudo={json(e.request)} />
                    <Bloco titulo="Responderam" conteudo={json(e.response)} />
                    <button
                      type="button"
                      onClick={() => copiar(e)}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 hover:text-violet-900"
                    >
                      {copiado === e.id ? <Check size={12} /> : <Copy size={12} />}
                      {copiado === e.id ? 'Copiado' : 'Copiar tudo para enviar à corretora'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
