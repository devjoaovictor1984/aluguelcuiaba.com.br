'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, Clock, AlertTriangle, X, Loader2, Send, Shield, DollarSign,
  MessageCircle, FileText,
} from 'lucide-react'
import { InputMoeda } from '@/components/inputs/input-mascarado'
import { parseMoney, formatarBRL, formatarData } from '@/lib/formatters'
import { gerarLinkWhatsApp } from '@/lib/utils'
import {
  marcarPagamento, desfazerPagamento,
  alternarRepasse, alternarSeguro, alternarBoletoEnviado,
} from '../../contratos/actions'

export interface ParcelaInline {
  id: string
  numero: number
  contrato_id: string
  contrato_codigo: string
  inquilino_nome: string
  inquilino_telefone: string | null
  imovel_titulo: string | null
  vencimento: string
  valor_total: number
  status_pagamento: 'pendente' | 'pago' | 'atrasado' | 'isento' | 'renegociado' | string
  status_repasse: 'pendente' | 'pago' | string
  status_seguro: 'pendente' | 'pago' | 'sem_seguro' | string
  boleto_enviado: boolean | null
  data_pagamento: string | null
}

const HOJE = () => new Date().toISOString().slice(0, 10)

function templateCobranca(p: ParcelaInline, anunciante: string): string {
  const venc = new Date(p.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')
  const primeiroNome = p.inquilino_nome.split(' ')[0]
  return `Olá ${primeiroNome}, tudo bem?

Passando pra lembrar do aluguel ${p.imovel_titulo ? `do imóvel ${p.imovel_titulo} ` : ''}com vencimento em ${venc}.

Valor: ${formatarBRL(p.valor_total)}

Qualquer dúvida estou à disposição.

— ${anunciante}`
}

interface Props {
  parcela: ParcelaInline
  anuncianteNome: string
}

export function ParcelaAcoesInline({ parcela: p, anuncianteNome }: Props) {
  const router = useRouter()
  const [modalAberto, setModalAberto] = useState(false)
  const [isPending, startTransition] = useTransition()

  const pago = p.status_pagamento === 'pago'
  const atrasada = !pago && new Date(p.vencimento + 'T00:00:00') < new Date(HOJE() + 'T00:00:00')

  const togglePgto = () => {
    if (pago) {
      if (!confirm(`Desfazer o pagamento da parcela #${p.numero}?`)) return
      startTransition(async () => {
        await desfazerPagamento(p.id)
        router.refresh()
      })
    } else {
      setModalAberto(true)
    }
  }

  const toggleRepasse = () => {
    if (p.status_repasse === 'pago' && !confirm('Desfazer o repasse?')) return
    startTransition(async () => {
      await alternarRepasse(p.id, p.status_repasse === 'pago' ? 'pendente' : 'pago')
      router.refresh()
    })
  }

  const toggleSeguro = () => {
    if (p.status_seguro === 'sem_seguro') return
    const novo = p.status_seguro === 'pago' ? 'pendente' : 'pago'
    startTransition(async () => {
      await alternarSeguro(p.id, novo)
      router.refresh()
    })
  }

  const toggleBoleto = () => {
    startTransition(async () => {
      await alternarBoletoEnviado(p.id, !p.boleto_enviado)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center gap-0.5 justify-end" onClick={e => e.stopPropagation()}>
        <BtnAcao
          onClick={togglePgto}
          ativo={pago}
          atrasada={atrasada}
          isPending={isPending}
          title={pago
            ? `Pago em ${formatarData(p.data_pagamento)} · clique para desfazer`
            : atrasada ? 'Atrasado · marcar como pago' : 'Marcar como pago'}
          icone={pago ? CheckCircle2 : atrasada ? AlertTriangle : Clock}
          cores={pago ? 'green' : atrasada ? 'red' : 'gray'}
        />
        <BtnAcao
          onClick={toggleRepasse}
          ativo={p.status_repasse === 'pago'}
          isPending={isPending}
          title={p.status_repasse === 'pago' ? 'Repasse feito · clique para desfazer' : 'Marcar repasse'}
          icone={p.status_repasse === 'pago' ? CheckCircle2 : DollarSign}
          cores={p.status_repasse === 'pago' ? 'green' : 'gray'}
        />
        <BtnAcao
          onClick={toggleSeguro}
          ativo={p.status_seguro === 'pago'}
          disabled={p.status_seguro === 'sem_seguro'}
          isPending={isPending}
          title={
            p.status_seguro === 'sem_seguro' ? 'Sem seguro neste contrato' :
            p.status_seguro === 'pago' ? 'Seguradora paga · clique para desfazer' :
            'Marcar seguro como pago'
          }
          icone={p.status_seguro === 'pago' ? CheckCircle2 : Shield}
          cores={p.status_seguro === 'pago' ? 'blue' : 'gray'}
        />
        <BtnAcao
          onClick={toggleBoleto}
          ativo={!!p.boleto_enviado}
          isPending={isPending}
          title={p.boleto_enviado ? 'Boleto enviado · clique para desfazer' : 'Marcar boleto como enviado'}
          icone={Send}
          cores={p.boleto_enviado ? 'violet' : 'gray'}
        />
        {p.inquilino_telefone && !pago && (
          <a
            href={gerarLinkWhatsApp(p.inquilino_telefone, templateCobranca(p, anuncianteNome))}
            target="_blank"
            rel="noopener noreferrer"
            title="Enviar lembrete via WhatsApp"
            onClick={e => e.stopPropagation()}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-green-100 text-gray-400 hover:text-green-700 transition-colors"
          >
            <MessageCircle size={13} />
          </a>
        )}
        <a
          href={`/api/recibos/${p.id}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Gerar recibo em PDF"
          onClick={e => e.stopPropagation()}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-pink-100 text-gray-400 hover:text-pink-700 transition-colors"
        >
          <FileText size={13} />
        </a>
      </div>

      {modalAberto && (
        <ModalPgto parcela={p} onFechar={() => setModalAberto(false)} onConfirmou={() => { setModalAberto(false); router.refresh() }} />
      )}
    </>
  )
}

const CLASSES_COR: Record<string, string> = {
  green: 'bg-green-100 hover:bg-green-200 text-green-700',
  red: 'bg-red-100 hover:bg-red-200 text-red-600',
  blue: 'bg-blue-100 hover:bg-blue-200 text-blue-700',
  violet: 'bg-violet-100 hover:bg-violet-200 text-violet-700',
  gray: 'bg-gray-100 hover:bg-gray-200 text-gray-400',
}

function BtnAcao({
  onClick, ativo, atrasada, disabled, isPending, title, icone: Icone, cores,
}: {
  onClick: () => void
  ativo?: boolean
  atrasada?: boolean
  disabled?: boolean
  isPending: boolean
  title: string
  icone: React.ElementType
  cores: string
}) {
  const cls = CLASSES_COR[cores] ?? CLASSES_COR.gray
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isPending}
      title={title}
      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${cls} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      {isPending ? <Loader2 size={12} className="animate-spin" /> : <Icone size={13} />}
    </button>
  )
}

function ModalPgto({
  parcela, onFechar, onConfirmou,
}: {
  parcela: ParcelaInline
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
    if (!data) { setErro('Informe a data.'); return }
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl shadow-xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900">Confirmar pagamento</h3>
            <p className="text-xs text-gray-500">
              {parcela.inquilino_nome} · parcela #{parcela.numero} · venc. {formatarData(parcela.vencimento)}
            </p>
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
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
