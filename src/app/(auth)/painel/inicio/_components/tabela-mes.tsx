'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckSquare, Square, MinusSquare, Loader2, Send, DollarSign, Shield, X, Check,
  CheckCircle2, Clock, AlertTriangle, MessageCircle,
} from 'lucide-react'
import { formatarBRL } from '@/lib/formatters'
import { codigoBoleto } from '@/lib/crm/calculos'
import { CodigoBoletoCopia } from '@/components/codigo-boleto-copia'
import { ParcelaAcoesInline, type ParcelaInline } from './parcela-acoes-inline'
import { bulkAcaoParcelas, bulkMarcarPagamento, type BulkInput } from '../../contratos/actions'

export interface LinhaParcela {
  id: string
  numero: number
  contratoId: string
  contratoCodigo: string
  inquilino: string
  inquilinoTelefone: string | null
  imovel: string
  bairro: string | null
  vencimento: string
  valor: number
  repasse: number
  status: string
  statusRepasse: string
  statusSeguro: string
  boletoEnviado: boolean | null
  diasAteVenc: number
  pago: boolean
  dataPagamento: string | null
  valorPago: number | null
}

interface Props {
  parcelas: LinhaParcela[]
  anuncianteNome: string
  atrasadasMes: number
}

export function TabelaMes({ parcelas, anuncianteNome, atrasadasMes }: Props) {
  const router = useRouter()
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [modalPgto, setModalPgto] = useState(false)
  const [isPending, startTransition] = useTransition()

  const todasIds = useMemo(() => parcelas.map(p => p.id), [parcelas])
  const totalSelecionado = selecionadas.size
  const ehTodasSelecionadas = totalSelecionado > 0 && totalSelecionado === parcelas.length
  const ehAlgumas = totalSelecionado > 0 && !ehTodasSelecionadas

  const toggleTodas = () => {
    if (totalSelecionado > 0) setSelecionadas(new Set())
    else setSelecionadas(new Set(todasIds))
  }

  const toggle = (id: string) => {
    setSelecionadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const executar = (acao: BulkInput['acao']) => {
    const ids = Array.from(selecionadas)
    if (ids.length === 0) return
    startTransition(async () => {
      const r = await bulkAcaoParcelas({ parcela_ids: ids, acao })
      if (r.error) { alert(r.error); return }
      setSelecionadas(new Set())
      router.refresh()
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          Aluguéis do mês por cliente
          {atrasadasMes > 0 && (
            <span className="text-xs text-red-600 font-medium">
              · {atrasadasMes} já atrasado{atrasadasMes === 1 ? '' : 's'}
            </span>
          )}
        </h2>
        {totalSelecionado > 0 && (
          <BarraBulk
            total={totalSelecionado}
            isPending={isPending}
            onLimpar={() => setSelecionadas(new Set())}
            onAcao={executar}
            onPagamento={() => setModalPgto(true)}
          />
        )}
      </div>
      {parcelas.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          Sem aluguéis previstos neste mês.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-3 py-2 w-8">
                  <button onClick={toggleTodas} className="p-0.5 hover:bg-gray-200 rounded">
                    {ehTodasSelecionadas
                      ? <CheckSquare size={14} className="text-violet-700" />
                      : ehAlgumas
                        ? <MinusSquare size={14} className="text-violet-700" />
                        : <Square size={14} className="text-gray-400" />
                    }
                  </button>
                </th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Imóvel</th>
                <th className="px-3 py-2">Boleto</th>
                <th className="px-3 py-2 text-center">Venc.</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 text-right">Repasse</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {parcelas.map(p => {
                const venc = new Date(p.vencimento + 'T00:00:00')
                const diaVenc = venc.getDate()
                const selecionada = selecionadas.has(p.id)
                const inline: ParcelaInline = {
                  id: p.id,
                  numero: p.numero,
                  contrato_id: p.contratoId,
                  contrato_codigo: p.contratoCodigo,
                  inquilino_nome: p.inquilino,
                  inquilino_telefone: p.inquilinoTelefone,
                  imovel_titulo: p.imovel,
                  vencimento: p.vencimento,
                  valor_total: p.valor,
                  status_pagamento: p.status,
                  status_repasse: p.statusRepasse,
                  status_seguro: p.statusSeguro,
                  boleto_enviado: p.boletoEnviado,
                  data_pagamento: p.dataPagamento,
                }
                return (
                  <tr
                    key={p.id}
                    className={`border-t border-gray-50 hover:bg-gray-50/60 ${selecionada ? 'bg-violet-50/60' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <button onClick={() => toggle(p.id)} className="p-0.5 hover:bg-gray-200 rounded">
                        {selecionada
                          ? <CheckSquare size={14} className="text-violet-700" />
                          : <Square size={14} className="text-gray-400" />}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/painel/contratos/${p.contratoId}`} className="font-medium text-gray-900 hover:text-violet-700">
                        {p.inquilino}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs">
                      {p.imovel}
                      {p.bairro && <span className="text-gray-400"> · {p.bairro}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <CodigoBoletoCopia codigo={codigoBoleto(p.contratoCodigo, p.numero)} />
                    </td>
                    <td className="px-3 py-2 text-center text-gray-700 text-xs">
                      dia <strong className="text-gray-900">{diaVenc}</strong>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">{formatarBRL(p.valor)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="font-bold text-blue-700" title="Repasse ao proprietário (aluguel − comissão, sem o seguro)">
                        {formatarBRL(p.repasse)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge p={p} />
                    </td>
                    <td className="px-3 py-2">
                      <ParcelaAcoesInline parcela={inline} anuncianteNome={anuncianteNome} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalPgto && (
        <ModalBulkPgto
          totalSelecionadas={totalSelecionado}
          onFechar={() => setModalPgto(false)}
          onSucesso={() => { setModalPgto(false); setSelecionadas(new Set()); router.refresh() }}
          parcelaIds={Array.from(selecionadas)}
        />
      )}
    </section>
  )
}

function BarraBulk({
  total, isPending, onLimpar, onAcao, onPagamento,
}: {
  total: number; isPending: boolean
  onLimpar: () => void
  onAcao: (acao: BulkInput['acao']) => void
  onPagamento: () => void
}) {
  return (
    <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-xl px-3 py-1.5">
      <span className="text-xs font-bold text-violet-800">{total} selecionada{total === 1 ? '' : 's'}</span>
      <span className="text-violet-300">|</span>
      <button
        onClick={onPagamento}
        disabled={isPending}
        title="Marcar selecionadas como pagas hoje"
        className="flex items-center gap-1 text-xs font-medium text-green-700 hover:bg-green-100 px-2 py-1 rounded-lg disabled:opacity-50"
      >
        <CheckCircle2 size={12} /> Pagar
      </button>
      <button
        onClick={() => onAcao('boleto_enviado')}
        disabled={isPending}
        title="Marcar boletos como enviados"
        className="flex items-center gap-1 text-xs font-medium text-violet-700 hover:bg-violet-100 px-2 py-1 rounded-lg disabled:opacity-50"
      >
        <Send size={12} /> Boletos
      </button>
      <button
        onClick={() => onAcao('repasse_pago')}
        disabled={isPending}
        title="Marcar repasses como pagos"
        className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:bg-blue-100 px-2 py-1 rounded-lg disabled:opacity-50"
      >
        <DollarSign size={12} /> Repasses
      </button>
      <button
        onClick={() => onAcao('seguro_pago')}
        disabled={isPending}
        title="Marcar seguros como pagos"
        className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:bg-amber-100 px-2 py-1 rounded-lg disabled:opacity-50"
      >
        <Shield size={12} /> Seguros
      </button>
      <span className="text-violet-300">|</span>
      <button
        onClick={onLimpar}
        disabled={isPending}
        title="Limpar seleção"
        className="text-gray-400 hover:text-gray-600 p-1"
      >
        {isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
      </button>
    </div>
  )
}

function ModalBulkPgto({
  parcelaIds, totalSelecionadas, onFechar, onSucesso,
}: {
  parcelaIds: string[]; totalSelecionadas: number
  onFechar: () => void; onSucesso: () => void
}) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [isPending, startTransition] = useTransition()

  const confirmar = () => {
    setErro(''); setOk('')
    if (!data) { setErro('Informe a data.'); return }
    startTransition(async () => {
      const r = await bulkMarcarPagamento({ parcela_ids: parcelaIds, data_pagamento: data })
      if (r.error) { setErro(r.error); return }
      setOk(`✓ ${r.atualizadas} parcela${r.atualizadas === 1 ? '' : 's'} marcada${r.atualizadas === 1 ? '' : 's'} como paga${r.atualizadas === 1 ? '' : 's'}${r.ignoradas ? ` · ${r.ignoradas} já estava${r.ignoradas === 1 ? '' : 'm'} paga${r.ignoradas === 1 ? '' : 's'}` : ''}.`)
      setTimeout(onSucesso, 1200)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl shadow-xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-bold text-gray-900">Marcar {totalSelecionadas} pagamento{totalSelecionadas === 1 ? '' : 's'}</h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Cada parcela será marcada como paga pelo valor total, sem juros nem desconto.
            Pra registrar juros ou desconto individual, use o botão de pagamento na linha da parcela.
          </p>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Data do pagamento *</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" />
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          {ok && <p className="text-xs text-green-700 font-medium flex items-center gap-1"><Check size={12} />{ok}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onFechar} disabled={isPending}
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={isPending}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ p }: { p: LinhaParcela }) {
  if (p.pago) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <CheckCircle2 size={11} /> Pago
      </span>
    )
  }
  if (p.diasAteVenc < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        <AlertTriangle size={11} /> Atrasado {-p.diasAteVenc}d
      </span>
    )
  }
  if (p.diasAteVenc === 0) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">Vence hoje</span>
  }
  if (p.diasAteVenc <= 5) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
        <Clock size={11} /> em {p.diasAteVenc}d
      </span>
    )
  }
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Em aberto</span>
}

export { StatusBadge as _StatusBadge }
