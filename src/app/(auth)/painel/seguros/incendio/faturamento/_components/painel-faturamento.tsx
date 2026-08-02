'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw, Wallet, AlertCircle, ChevronDown } from 'lucide-react'
import { formatarBRL } from '@/lib/formatters'
import { estimarProLabore, PRO_LABORE_PADRAO } from '@/lib/seguros/incendio/sugestoes'
import { sincronizarFaturamento } from '../../../actions-incendio'

interface ItemView {
  id: string
  vigencia: 'mensalizado' | 'anual'
  ramo: 'residencial' | 'comercial'
  codigo: string | null
  numeroProposta: string | null
  dataCobertura: string | null
  inquilino: string | null
  proprietario: string | null
  localRisco: string | null
  parcelas: number | null
  valorParcela: number | null
  premioTotal: number | null
}

interface Props {
  itens: ItemView[]
  competencia: { mes: number; ano: number } | null
  sincronizadoEm: string | null
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const BASE = '/painel/seguros/incendio/faturamento'

/**
 * Conferência do faturamento.
 *
 * Este é o único endpoint da integração — fiança inclusive — que devolve
 * dinheiro. É por aqui que o corretor confere se o pró-labore que recebeu
 * bate com as apólices que emitiu.
 */
export function PainelFaturamento({ itens, competencia, sincronizadoEm }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState('')
  const [seguradora, setSeguradora] = useState('Alfa')

  const agora = new Date()
  const [mes, setMes] = useState(competencia?.mes ?? agora.getMonth() + 1)
  const [ano, setAno] = useState(competencia?.ano ?? agora.getFullYear())
  const [fechada, setFechada] = useState(!!competencia)

  const sincronizar = () => {
    setErro('')
    startTransition(async () => {
      const r = await sincronizarFaturamento(seguradora, fechada ? { mes, ano } : undefined)
      if (r.error) { setErro(r.error); return }
      const sp = new URLSearchParams()
      if (fechada) { sp.set('mes', String(mes)); sp.set('ano', String(ano)) }
      const qs = sp.toString()
      router.push(qs ? `${BASE}?${qs}` : BASE)
      router.refresh()
    })
  }

  const total = itens.reduce((s, i) => s + (i.premioTotal ?? 0), 0)
  const proLabore = estimarProLabore(total)

  // Agrupa como a corretora agrupa: vigência e ramo.
  const grupos = itens.reduce<Record<string, ItemView[]>>((acc, i) => {
    const k = `${i.vigencia}|${i.ramo}`
    ;(acc[k] ??= []).push(i)
    return acc
  }, {})

  const select = 'px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500'

  return (
    <div className="space-y-4">
      {/* Filtro */}
      <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Seguradora</label>
            <div className="relative">
              <select value={seguradora} onChange={e => setSeguradora(e.target.value)} className={`${select} appearance-none pr-8`}>
                <option value="Alfa">Alfa</option>
                <option value="Porto">Porto</option>
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pb-2.5">
            <input
              type="checkbox"
              checked={fechada}
              onChange={e => setFechada(e.target.checked)}
              className="accent-orange-600"
            />
            <span className="text-sm text-gray-700">Fatura fechada</span>
          </label>

          {fechada && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Mês</label>
                <div className="relative">
                  <select value={mes} onChange={e => setMes(Number(e.target.value))} className={`${select} appearance-none pr-8`}>
                    {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Ano</label>
                <input
                  value={ano}
                  onChange={e => setAno(Number(e.target.value.replace(/\D/g, '')) || agora.getFullYear())}
                  className={`${select} w-24`}
                  inputMode="numeric"
                />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={sincronizar}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Buscar
          </button>
        </div>

        <p className="text-[11px] text-gray-400">
          Sem marcar &ldquo;fatura fechada&rdquo;, traz a fatura em aberto.
          {sincronizadoEm && <> Última consulta em {new Date(sincronizadoEm).toLocaleString('pt-BR')}.</>}
        </p>
      </section>

      {erro && (
        <p className="text-xs text-rose-800 bg-rose-50 ring-1 ring-rose-100 rounded-xl px-3 py-2.5 flex items-start gap-2">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {erro}
        </p>
      )}

      {itens.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white ring-1 ring-gray-100 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Prêmio total
            </p>
            <p className="text-xl font-black text-gray-900 tabular-nums">{formatarBRL(total)}</p>
            <p className="text-[11px] text-gray-400">{itens.length} apólice(s)</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
              <Wallet size={11} /> Pró-labore
            </p>
            <p className="text-xl font-black text-emerald-900 tabular-nums">{formatarBRL(proLabore)}</p>
            <p className="text-[11px] text-emerald-800">
              estimado a {Math.round(PRO_LABORE_PADRAO * 100)}%
            </p>
          </div>
        </div>
      )}

      {itens.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-gray-100 p-10 text-center">
          <Receipt />
          <p className="text-sm text-gray-500">
            Nenhuma fatura carregada. Escolha a seguradora e toque em buscar.
          </p>
        </div>
      ) : (
        Object.entries(grupos).map(([chave, lista]) => {
          const [vigencia, ramo] = chave.split('|')
          const soma = lista.reduce((s, i) => s + (i.premioTotal ?? 0), 0)
          return (
            <section key={chave} className="space-y-2">
              <div className="flex items-baseline justify-between px-0.5">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {vigencia} · {ramo} ({lista.length})
                </h2>
                <span className="text-sm font-bold text-gray-900 tabular-nums">
                  {formatarBRL(soma)}
                </span>
              </div>

              <div className="rounded-2xl bg-white ring-1 ring-gray-100 divide-y divide-gray-50 overflow-hidden">
                {lista.map(i => (
                  <div key={i.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {i.inquilino ?? '—'}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {i.localRisco ?? '—'}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {i.proprietario && <>prop. {i.proprietario} · </>}
                          {i.numeroProposta && <>nº {i.numeroProposta}</>}
                          {i.dataCobertura && <> · {i.dataCobertura}</>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900 tabular-nums">
                          {formatarBRL(i.premioTotal ?? 0)}
                        </p>
                        {i.parcelas && i.valorParcela != null && (
                          <p className="text-[11px] text-gray-400 tabular-nums">
                            {i.parcelas}× {formatarBRL(i.valorParcela)}
                          </p>
                        )}
                        <p className="text-[11px] text-emerald-700 tabular-nums font-semibold">
                          +{formatarBRL(estimarProLabore(i.premioTotal ?? 0))}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}

function Receipt() {
  return (
    <svg className="mx-auto text-gray-300 mb-2" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  )
}
