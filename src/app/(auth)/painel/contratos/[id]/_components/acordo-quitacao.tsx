'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Handshake, X, Loader2, Undo2 } from 'lucide-react'
import { InputMoeda } from '@/components/inputs/input-mascarado'
import { parseMoney, formatarBRL, formatarData } from '@/lib/formatters'
import { ratearAcordo, resumirAcordo, type ParcelaParaAcordo } from '@/lib/crm/acordo'
import type { BaseComissao } from '@/lib/crm/calculos'
import { registrarAcordo, desfazerAcordo } from '../actions-acordo'

export interface AcordoRow {
  id: string
  data_pagamento: string
  valor_original: number
  valor_acordado: number
  observacao: string | null
  numeros: number[]
}

interface Props {
  contratoId: string
  parcelasAbertas: Array<ParcelaParaAcordo & { vencimento: string }>
  base: BaseComissao
  encerrado: boolean
}

const HOJE = () => new Date().toISOString().slice(0, 10)
const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm'

/**
 * Botão "Acordo de quitação": várias parcelas em aberto pagas por um valor
 * negociado (ex.: locatário saiu antes e pagou R$ 3.600 pelas duas últimas
 * de R$ 3.600). Mostra o rateio antes de gravar.
 */
export function AcordoQuitacao({ contratoId, parcelasAbertas, base, encerrado }: Props) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [valor, setValor] = useState('')
  const [data, setData] = useState(HOJE())
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [pendente, start] = useTransition()

  const escolhidas = parcelasAbertas.filter(p => marcadas.has(p.id))
  const valorNum = parseMoney(valor)
  const linhas = ratearAcordo(escolhidas, valorNum, base)
  const tot = resumirAcordo(linhas)
  const totalEscolhido = escolhidas.reduce((s, p) => s + Number(p.valor_total), 0)
  const passou = valorNum > totalEscolhido + 0.001

  const abrir = () => {
    setMarcadas(new Set(parcelasAbertas.map(p => p.id)))
    setValor(''); setData(HOJE()); setObs(''); setErro(''); setOk('')
    setAberto(true)
  }

  const confirmar = () => {
    setErro('')
    if (!escolhidas.length) { setErro('Escolha ao menos uma parcela.'); return }
    if (valorNum <= 0) { setErro('Informe quanto o locatário pagou.'); return }
    if (passou) { setErro('O valor é maior que o total das parcelas escolhidas.'); return }
    start(async () => {
      const r = await registrarAcordo({
        contrato_id: contratoId, parcela_ids: escolhidas.map(p => p.id),
        valor_acordado: valorNum, data_pagamento: data, observacao: obs || null,
      })
      if (r.error) { setErro(r.error); return }
      setOk(`Acordo registrado. Desconto de ${formatarBRL(r.desconto ?? 0)}.`)
      setTimeout(() => { setAberto(false); router.refresh() }, 1500)
    })
  }

  return (
    <>
      <button
        onClick={abrir}
        title="O locatário pagou um valor negociado por várias parcelas"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg"
      >
        <Handshake size={13} /> Acordo de quitação
      </button>

      {aberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !pendente && setAberto(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Handshake size={16} className="text-amber-600" /> Acordo de quitação
              </h3>
              <button onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              O locatário pagou um valor só por várias parcelas. O valor é dividido entre elas na proporção de cada uma,
              o desconto fica registrado, e a comissão e o repasse são recalculados sobre o que entrou.
            </p>

            <p className="text-xs font-medium text-gray-600 mb-1">Parcelas do acordo</p>
            <ul className="border border-gray-100 rounded-xl divide-y divide-gray-50 mb-3 max-h-48 overflow-y-auto">
              {parcelasAbertas.map(p => (
                <li key={p.id}>
                  <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer">
                    <input
                      type="checkbox" className="accent-amber-600" checked={marcadas.has(p.id)}
                      onChange={e => setMarcadas(s => { const n = new Set(s); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n })}
                    />
                    <span className="font-mono text-xs text-gray-400 w-6">#{p.numero}</span>
                    <span className="text-gray-700">{formatarData(p.vencimento)}</span>
                    <span className="ml-auto tabular-nums text-gray-900">{formatarBRL(p.valor_total)}</span>
                  </label>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Quanto pagou *</label>
                <InputMoeda value={valor} onChange={setValor} className={inputCls} />
                <p className="text-[11px] text-gray-400 mt-0.5">Total das escolhidas: {formatarBRL(totalEscolhido)}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Data do recebimento *</label>
                <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs font-medium text-gray-600 block mb-1">Observação</label>
              <input value={obs} onChange={e => setObs(e.target.value)} maxLength={300} className={inputCls}
                placeholder="Ex.: saída antecipada, desconto concedido pelo locador" />
            </div>

            {valorNum > 0 && escolhidas.length > 0 && !passou && (
              <div className="bg-gray-50 rounded-xl p-3 mb-3 overflow-x-auto">
                <table className="w-full text-xs tabular-nums">
                  <thead>
                    <tr className="text-gray-500 text-left">
                      <th className="py-1">#</th><th className="text-right">Era</th><th className="text-right">Pago</th>
                      <th className="text-right">Desconto</th><th className="text-right">Comissão</th><th className="text-right">Repasse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map(l => (
                      <tr key={l.id} className="border-t border-gray-100">
                        <td className="py-1 font-mono text-gray-400">{l.numero}</td>
                        <td className="text-right text-gray-400 line-through">{formatarBRL(l.valor_original)}</td>
                        <td className="text-right text-gray-900">{formatarBRL(l.valor_pago)}</td>
                        <td className="text-right text-amber-700">{formatarBRL(l.desconto)}</td>
                        <td className="text-right text-violet-700">{formatarBRL(l.valor_comissao)}</td>
                        <td className="text-right text-green-700">{formatarBRL(l.valor_repasse_proprietario)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-gray-200 font-semibold">
                      <td className="py-1">Total</td>
                      <td className="text-right text-gray-400">{formatarBRL(tot.original)}</td>
                      <td className="text-right">{formatarBRL(tot.pago)}</td>
                      <td className="text-right text-amber-700">{formatarBRL(tot.desconto)}</td>
                      <td className="text-right text-violet-700">{formatarBRL(tot.comissao)}</td>
                      <td className="text-right text-green-700">{formatarBRL(tot.repasse)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {!encerrado && (
              <p className="text-[11px] text-gray-500 mb-3">
                O acordo não encerra o contrato. Se o locatário já saiu, depois use <strong>Encerrar contrato</strong>:
                as parcelas pagas no acordo ficam como estão.
              </p>
            )}

            {erro && <p className="text-xs text-red-600 mb-2" role="alert">{erro}</p>}
            {ok && <p className="text-xs text-green-700 font-medium mb-2">{ok}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setAberto(false)} disabled={pendente}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100">Cancelar</button>
              <button onClick={confirmar} disabled={pendente || !escolhidas.length || valorNum <= 0 || passou}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
                {pendente && <Loader2 size={14} className="animate-spin" />}
                Registrar acordo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Lista dos acordos do contrato, com desfazer. */
export function AcordosFeitos({ acordos }: { acordos: AcordoRow[] }) {
  const router = useRouter()
  const [confirmar, setConfirmar] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [pendente, start] = useTransition()
  if (!acordos.length) return null

  return (
    <div className="px-5 py-3 border-b border-gray-100 bg-amber-50/40 space-y-2">
      {acordos.map(a => (
        <div key={a.id} className="flex items-start gap-2 text-xs flex-wrap">
          <Handshake size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-gray-700 flex-1 min-w-[200px]">
            <strong>Acordo em {formatarData(a.data_pagamento)}:</strong>{' '}
            {formatarBRL(a.valor_acordado)} pelas parcelas {a.numeros.map(n => `#${n}`).join(', ')}{' '}
            (eram {formatarBRL(a.valor_original)}, desconto de {formatarBRL(a.valor_original - a.valor_acordado)})
            {a.observacao && <span className="text-gray-500"> · {a.observacao}</span>}
          </p>
          {confirmar === a.id ? (
            <span className="flex items-center gap-2">
              Voltar as parcelas para em aberto?
              <button disabled={pendente} className="font-semibold text-red-700" onClick={() => start(async () => {
                setErro('')
                const r = await desfazerAcordo(a.id)
                if (r.error) setErro(r.error)
                setConfirmar(null)
                router.refresh()
              })}>{pendente ? 'Desfazendo…' : 'Desfazer'}</button>
              <button className="text-gray-500" onClick={() => setConfirmar(null)}>Não</button>
            </span>
          ) : (
            <button onClick={() => setConfirmar(a.id)} className="inline-flex items-center gap-1 text-gray-500 hover:text-red-700">
              <Undo2 size={12} /> Desfazer acordo
            </button>
          )}
        </div>
      ))}
      {erro && <p className="text-xs text-red-600" role="alert">{erro}</p>}
    </div>
  )
}
