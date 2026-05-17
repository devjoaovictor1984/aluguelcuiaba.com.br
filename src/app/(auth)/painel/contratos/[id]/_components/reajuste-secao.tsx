'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, Calendar, X, Loader2, AlertCircle, Sparkles, ArrowUpRight,
} from 'lucide-react'
import { InputMoeda, InputPercentual } from '@/components/inputs/input-mascarado'
import { parseMoney, parsePercentual, formatarBRL, formatarData } from '@/lib/formatters'
import { aplicarReajuste, type AplicarReajusteInput } from '../../actions'

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"

export interface ReajusteRow {
  id: string
  data_efetiva: string
  valor_antigo: number
  valor_novo: number
  percentual: number
  indice_usado: string | null
  parcelas_afetadas: number
  observacao: string | null
  created_at: string
}

interface Props {
  contratoId: string
  contratoCodigo: string
  valorAluguelAtual: number
  dataProximoReajuste: string | null
  jaEncerrado: boolean
  parcelasFuturas: number
  proximaParcelaMesRef: string | null
  reajustes: ReajusteRow[]
}

function diasAte(iso: string): number {
  const alvo = new Date(iso + 'T00:00:00').getTime()
  const hoje = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00').getTime()
  return Math.round((alvo - hoje) / (24 * 60 * 60 * 1000))
}

export function ReajusteSecao(props: Props) {
  const [modalAberto, setModalAberto] = useState(false)

  const dias = props.dataProximoReajuste ? diasAte(props.dataProximoReajuste) : null
  const corBadge = dias == null ? 'bg-gray-100 text-gray-500'
    : dias < 0 ? 'bg-red-100 text-red-700'
    : dias <= 30 ? 'bg-amber-100 text-amber-700'
    : 'bg-gray-100 text-gray-600'
  const txtBadge = dias == null ? 'Sem data definida'
    : dias < 0 ? `Atrasado há ${-dias} dias`
    : dias === 0 ? 'Hoje'
    : `em ${dias} dias`

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <TrendingUp size={14} className="text-violet-600" />
          Reajuste
          {props.reajustes.length > 0 && (
            <span className="text-xs font-normal text-gray-400">({props.reajustes.length} aplicado{props.reajustes.length === 1 ? '' : 's'})</span>
          )}
        </h2>
        {!props.jaEncerrado && (
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            disabled={props.parcelasFuturas === 0}
            className="flex items-center gap-1.5 text-xs text-white bg-violet-700 hover:bg-violet-800 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors"
            title={props.parcelasFuturas === 0 ? 'Nenhuma parcela futura pra reajustar' : 'Aplicar reajuste'}
          >
            <Sparkles size={12} /> Aplicar reajuste
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">Aluguel atual</p>
          <p className="text-base font-bold text-gray-900">{formatarBRL(props.valorAluguelAtual)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <Calendar size={9} /> Próximo reajuste
          </p>
          <p className="text-base font-bold text-gray-900">{formatarData(props.dataProximoReajuste)}</p>
          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-0.5 ${corBadge}`}>
            {txtBadge}
          </span>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">Parcelas futuras</p>
          <p className="text-base font-bold text-gray-900">{props.parcelasFuturas}</p>
          <p className="text-[10px] text-gray-400">elegíveis pra reajuste</p>
        </div>
      </div>

      {props.reajustes.length > 0 && (
        <div className="border-t border-gray-50 pt-3">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Histórico</p>
          <ul className="space-y-1.5">
            {props.reajustes.map(r => (
              <li key={r.id} className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">{formatarData(r.data_efetiva)}</span>
                <ArrowUpRight size={11} className="text-green-600" />
                <span className="text-gray-700">
                  {formatarBRL(r.valor_antigo)} → <strong>{formatarBRL(r.valor_novo)}</strong>
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${r.percentual >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {r.percentual >= 0 ? '+' : ''}{r.percentual.toFixed(2).replace('.', ',')}%
                </span>
                {r.indice_usado && (
                  <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full uppercase">{r.indice_usado}</span>
                )}
                <span className="text-gray-400">· {r.parcelas_afetadas} parcela{r.parcelas_afetadas === 1 ? '' : 's'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {modalAberto && (
        <ModalReajuste
          {...props}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </section>
  )
}

function ModalReajuste({
  contratoId, contratoCodigo, valorAluguelAtual, dataProximoReajuste,
  parcelasFuturas, proximaParcelaMesRef, onFechar,
}: Props & { onFechar: () => void }) {
  const router = useRouter()
  const defaultData = proximaParcelaMesRef ?? dataProximoReajuste ?? new Date().toISOString().slice(0, 10)

  const [valorNovo, setValorNovo] = useState(
    valorAluguelAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
  const [percentual, setPercentual] = useState('')
  const [dataEfetiva, setDataEfetiva] = useState(defaultData)
  const [indice, setIndice] = useState('IGPM')
  const [observacao, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [isPending, startTransition] = useTransition()

  // Bidirecional: % ↔ valor
  const aplicarPercentual = (pct: string) => {
    setPercentual(pct)
    const p = parsePercentual(pct)
    if (p > 0) {
      const novo = valorAluguelAtual * (1 + p / 100)
      setValorNovo(novo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    }
  }

  const aplicarValor = (val: string) => {
    setValorNovo(val)
    const v = parseMoney(val)
    if (v > 0 && valorAluguelAtual > 0) {
      const pct = ((v / valorAluguelAtual) - 1) * 100
      setPercentual(pct.toFixed(2).replace('.', ','))
    }
  }

  const valor = parseMoney(valorNovo)
  const diferenca = valor - valorAluguelAtual
  const pctReal = valorAluguelAtual ? (diferenca / valorAluguelAtual) * 100 : 0

  const confirmar = () => {
    setErro('')
    if (!valor) { setErro('Valor novo inválido.'); return }
    if (valor === valorAluguelAtual) { setErro('Novo valor é igual ao atual.'); return }

    const payload: AplicarReajusteInput = {
      contrato_id: contratoId,
      novo_valor_aluguel: valor,
      data_efetiva: dataEfetiva,
      indice_usado: indice || undefined,
      observacao: observacao || undefined,
    }
    startTransition(async () => {
      const r = await aplicarReajuste(payload)
      if (r.error) { setErro(r.error); return }
      setOk(`Reajuste aplicado em ${r.parcelas_afetadas} parcela${r.parcelas_afetadas === 1 ? '' : 's'} (+${r.percentual?.toFixed(2).replace('.', ',')}%)`)
      setTimeout(() => { onFechar(); router.refresh() }, 1200)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl shadow-xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900">Aplicar reajuste</h3>
            <p className="text-xs text-gray-500 font-mono">{contratoCodigo}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div className="bg-violet-50 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-600">Aluguel atual</span>
            <span className="font-bold text-violet-700">{formatarBRL(valorAluguelAtual)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Novo valor *</label>
              <InputMoeda value={valorNovo} onChange={aplicarValor} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Ou percentual</label>
              <InputPercentual value={percentual} onChange={aplicarPercentual} className={inputCls} />
            </div>
          </div>

          {diferenca !== 0 && (
            <div className={`text-xs px-3 py-2 rounded-lg ${diferenca > 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
              {diferenca > 0 ? '+' : ''}{formatarBRL(diferenca)} ({pctReal.toFixed(2).replace('.', ',')}%) por mês ·
              afeta até <strong>{parcelasFuturas}</strong> parcela{parcelasFuturas === 1 ? '' : 's'} não paga{parcelasFuturas === 1 ? '' : 's'}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">A partir de *</label>
              <input type="date" value={dataEfetiva} onChange={e => setDataEfetiva(e.target.value)} className={inputCls} />
              <p className="text-[11px] text-gray-400 mt-0.5">primeira parcela afetada (mês de referência)</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Índice usado</label>
              <select value={indice} onChange={e => setIndice(e.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="IGPM">IGP-M</option>
                <option value="IPCA">IPCA</option>
                <option value="INPC">INPC</option>
                <option value="manual">Manual / Acordo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Observação</label>
            <textarea value={observacao} onChange={e => setObs(e.target.value)} rows={2}
              className={`${inputCls} resize-y`}
              placeholder="Ex: IGP-M acumulado em 12 meses (5,32%)" />
          </div>

          <div className="bg-amber-50 border border-amber-100 text-amber-800 text-xs rounded-lg px-3 py-2 flex gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>Só parcelas <strong>não pagas</strong> serão reescritas. O valor de referência do contrato e a próxima data de reajuste (+12 meses) também são atualizados.</span>
          </div>

          {erro && <p className="text-xs text-red-600">{erro}</p>}
          {ok && <p className="text-xs text-green-700 font-medium">✓ {ok}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-gray-100">
          <button onClick={onFechar} disabled={isPending}
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={isPending || !valor || valor === valorAluguelAtual}
            className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Confirmar reajuste
          </button>
        </div>
      </div>
    </div>
  )
}
