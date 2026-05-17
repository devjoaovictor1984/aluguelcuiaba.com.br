'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, Clock, AlertTriangle, X, Loader2, Send, Shield, DollarSign,
} from 'lucide-react'
import { InputMoeda } from '@/components/inputs/input-mascarado'
import { parseMoney, formatarBRL, formatarData } from '@/lib/formatters'
import {
  marcarPagamento, desfazerPagamento, alternarRepasse, alternarSeguro, alternarBoletoEnviado,
} from '../../actions'

export interface Parcela {
  id: string
  numero: number
  mes_referencia: string
  vencimento: string
  valor_aluguel: number
  valor_seguro: number
  valor_total: number
  valor_comissao: number
  valor_repasse_proprietario: number
  status_pagamento: 'pendente' | 'pago' | 'atrasado' | 'isento' | 'renegociado'
  status_repasse: 'pendente' | 'pago'
  status_seguro: 'pendente' | 'pago' | 'sem_seguro'
  boleto_enviado: boolean | null
  data_pagamento: string | null
  valor_pago: number | null
  juros_multa: number | null
  desconto: number | null
  observacoes: string | null
}

interface Props {
  parcela: Parcela
}

const HOJE = (): string => new Date().toISOString().slice(0, 10)

export function ParcelaRow({ parcela }: Props) {
  const router = useRouter()
  const [modalAberto, setModalAberto] = useState(false)
  const [isPending, startTransition] = useTransition()

  const atrasada = parcela.status_pagamento !== 'pago' && new Date(parcela.vencimento) < new Date()

  const togglePagamento = () => {
    if (parcela.status_pagamento === 'pago') {
      if (!confirm('Desfazer este pagamento?')) return
      startTransition(async () => {
        await desfazerPagamento(parcela.id)
        router.refresh()
      })
    } else {
      // Abre modal pra confirmar com data e valor
      setModalAberto(true)
    }
  }

  const toggleRepasse = () => {
    if (parcela.status_repasse === 'pago' && !confirm('Desfazer o repasse?')) return
    startTransition(async () => {
      await alternarRepasse(parcela.id, parcela.status_repasse === 'pago' ? 'pendente' : 'pago')
      router.refresh()
    })
  }

  const toggleSeguro = () => {
    if (parcela.status_seguro === 'sem_seguro') return
    const novo = parcela.status_seguro === 'pago' ? 'pendente' : 'pago'
    startTransition(async () => {
      await alternarSeguro(parcela.id, novo)
      router.refresh()
    })
  }

  const toggleBoleto = () => {
    startTransition(async () => {
      await alternarBoletoEnviado(parcela.id, !parcela.boleto_enviado)
      router.refresh()
    })
  }

  return (
    <>
      <tr className="border-t border-gray-50 hover:bg-gray-50">
        <td className="px-3 py-2 text-gray-500 font-mono text-xs">{parcela.numero}</td>
        <td className={`px-3 py-2 text-xs ${atrasada ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
          {formatarData(parcela.vencimento)}
        </td>
        <td className="px-3 py-2 text-right text-xs font-medium">{formatarBRL(parcela.valor_total)}</td>
        <td className="px-3 py-2 text-right text-xs text-violet-700">{formatarBRL(parcela.valor_comissao)}</td>
        <td className="px-3 py-2 text-right text-xs text-green-700">{formatarBRL(parcela.valor_repasse_proprietario)}</td>

        {/* Pgto */}
        <td className="px-2 py-2 text-center">
          <button
            type="button"
            onClick={togglePagamento}
            disabled={isPending}
            title={parcela.status_pagamento === 'pago'
              ? `Pago em ${formatarData(parcela.data_pagamento)} · clique p/ desfazer`
              : atrasada ? 'Atrasada · clique p/ marcar como paga' : 'Marcar como paga'}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              parcela.status_pagamento === 'pago' ? 'bg-green-100 hover:bg-green-200 text-green-700' :
              atrasada ? 'bg-red-100 hover:bg-red-200 text-red-600' :
              'bg-gray-100 hover:bg-gray-200 text-gray-400'
            }`}
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> :
              parcela.status_pagamento === 'pago' ? <CheckCircle2 size={14} /> :
              atrasada ? <AlertTriangle size={14} /> :
              <Clock size={14} />}
          </button>
        </td>

        {/* Repasse */}
        <td className="px-2 py-2 text-center">
          <button
            type="button"
            onClick={toggleRepasse}
            disabled={isPending}
            title={parcela.status_repasse === 'pago' ? 'Repasse feito · clique p/ desfazer' : 'Marcar repasse como feito'}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              parcela.status_repasse === 'pago' ? 'bg-green-100 hover:bg-green-200 text-green-700' :
              'bg-gray-100 hover:bg-gray-200 text-gray-400'
            }`}
          >
            {parcela.status_repasse === 'pago' ? <CheckCircle2 size={14} /> : <DollarSign size={14} />}
          </button>
        </td>

        {/* Seguro */}
        <td className="px-2 py-2 text-center">
          {parcela.status_seguro === 'sem_seguro' ? (
            <span className="text-[10px] text-gray-300">—</span>
          ) : (
            <button
              type="button"
              onClick={toggleSeguro}
              disabled={isPending}
              title={parcela.status_seguro === 'pago' ? 'Seguradora paga · clique p/ desfazer' : 'Marcar seguro como pago'}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                parcela.status_seguro === 'pago' ? 'bg-blue-100 hover:bg-blue-200 text-blue-700' :
                'bg-gray-100 hover:bg-gray-200 text-gray-400'
              }`}
            >
              {parcela.status_seguro === 'pago' ? <CheckCircle2 size={14} /> : <Shield size={14} />}
            </button>
          )}
        </td>

        {/* Boleto enviado */}
        <td className="px-2 py-2 text-center">
          <button
            type="button"
            onClick={toggleBoleto}
            disabled={isPending}
            title={parcela.boleto_enviado ? 'Boleto enviado · clique p/ desfazer' : 'Marcar boleto como enviado'}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              parcela.boleto_enviado ? 'bg-violet-100 hover:bg-violet-200 text-violet-700' :
              'bg-gray-100 hover:bg-gray-200 text-gray-400'
            }`}
          >
            <Send size={13} />
          </button>
        </td>
      </tr>

      {modalAberto && (
        <ModalPagamento
          parcela={parcela}
          onFechar={() => setModalAberto(false)}
          onConfirmou={() => { setModalAberto(false); router.refresh() }}
        />
      )}
    </>
  )
}

function ModalPagamento({
  parcela, onFechar, onConfirmou,
}: {
  parcela: Parcela
  onFechar: () => void
  onConfirmou: () => void
}) {
  const [data, setData] = useState(HOJE())
  const [valorPago, setValorPago] = useState(
    parcela.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
  const [juros, setJuros] = useState('')
  const [desconto, setDesconto] = useState('')
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const confirmar = () => {
    setErro('')
    if (!data) { setErro('Informe a data do pagamento.'); return }
    const valor = parseMoney(valorPago)
    if (!valor) { setErro('Valor pago inválido.'); return }

    startTransition(async () => {
      const r = await marcarPagamento({
        parcela_id: parcela.id,
        data_pagamento: data,
        valor_pago: valor,
        juros_multa: parseMoney(juros),
        desconto: parseMoney(desconto),
        observacoes: obs || undefined,
      })
      if (r.error) { setErro(r.error); return }
      onConfirmou()
    })
  }

  return (
    <tr>
      <td colSpan={9} className="p-0">
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={onFechar}>
          <div className="bg-white rounded-2xl shadow-xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900">Confirmar pagamento</h3>
                <p className="text-xs text-gray-500">Parcela #{parcela.numero} · vencimento {formatarData(parcela.vencimento)}</p>
              </div>
              <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Data do pagamento *</label>
                <input type="date" value={data} onChange={e => setData(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Valor pago *</label>
                <InputMoeda value={valorPago} onChange={setValorPago}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" />
                <p className="text-[11px] text-gray-400 mt-0.5">Valor do boleto: {formatarBRL(parcela.valor_total)}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Juros/Multa</label>
                  <InputMoeda value={juros} onChange={setJuros}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Desconto</label>
                  <InputMoeda value={desconto} onChange={setDesconto}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Observações</label>
                <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" />
              </div>

              {erro && <p className="text-xs text-red-600">{erro}</p>}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={onFechar} disabled={isPending}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100">
                Cancelar
              </button>
              <button onClick={confirmar} disabled={isPending}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
                {isPending && <Loader2 size={14} className="animate-spin" />}
                Confirmar pagamento
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}
