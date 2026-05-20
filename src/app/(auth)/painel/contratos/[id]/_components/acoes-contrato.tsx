'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Repeat, XCircle, X, Loader2, AlertCircle } from 'lucide-react'
import { InputMoeda } from '@/components/inputs/input-mascarado'
import { parseMoney, formatarBRL } from '@/lib/formatters'
import {
  encerrarContrato, renovarContrato,
  type MotivoEncerramento, type EncerrarContratoInput, type RenovarContratoInput,
} from '../../actions'

interface Props {
  contratoId: string
  contratoCodigo: string
  dataTerminoAtual: string | null
  valorAluguelAtual: number
  valorSeguroAtual: number
  duracaoMesesAtual: number
  diaVencimentoAtual: number
  jaEncerrado: boolean
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"

const MOTIVOS: { valor: MotivoEncerramento; label: string }[] = [
  { valor: 'fim_natural', label: 'Fim natural do prazo' },
  { valor: 'rescisao_inquilino', label: 'Rescisão pelo inquilino' },
  { valor: 'rescisao_proprietario', label: 'Rescisão pelo proprietário' },
  { valor: 'inadimplencia', label: 'Inadimplência' },
  { valor: 'acordo', label: 'Acordo entre as partes' },
  { valor: 'outro', label: 'Outro' },
]

const HOJE = () => new Date().toISOString().slice(0, 10)

function somarMeses(dataIso: string, meses: number): string {
  const d = new Date(dataIso + 'T00:00:00')
  d.setMonth(d.getMonth() + meses)
  return d.toISOString().slice(0, 10)
}

function diaSeguinte(dataIso: string): string {
  const d = new Date(dataIso + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function AcoesContrato(props: Props) {
  const [modal, setModal] = useState<'encerrar' | 'renovar' | null>(null)

  if (props.jaEncerrado) return null

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setModal('renovar')}
          className="flex items-center gap-1.5 text-sm text-green-700 hover:text-green-800 border border-green-200 hover:border-green-400 hover:bg-green-50 px-3 py-1.5 rounded-xl transition-colors"
        >
          <Repeat size={13} /> Renovar
        </button>
        <button
          type="button"
          onClick={() => setModal('encerrar')}
          className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 border border-red-200 hover:border-red-400 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors"
        >
          <XCircle size={13} /> Encerrar
        </button>
      </div>

      {modal === 'encerrar' && <ModalEncerrar {...props} onFechar={() => setModal(null)} />}
      {modal === 'renovar' && <ModalRenovar {...props} onFechar={() => setModal(null)} />}
    </>
  )
}

function ModalEncerrar({
  contratoId, contratoCodigo, onFechar,
}: Props & { onFechar: () => void }) {
  const router = useRouter()
  const [motivo, setMotivo] = useState<MotivoEncerramento>('fim_natural')
  const [data, setData] = useState(HOJE())
  const [observacao, setObs] = useState('')
  const [chavesEntreguesEm, setChavesEntreguesEm] = useState('')
  const [qtdChaves, setQtdChaves] = useState('')
  const [caucaoDevolvida, setCaucaoDevolvida] = useState<'sim' | 'nao' | ''>('')
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const confirmar = () => {
    setErro('')
    const payload: EncerrarContratoInput = {
      motivo,
      data_encerramento: data,
      observacao: observacao || undefined,
      chaves_entregues_em: chavesEntreguesEm || null,
      qtd_chaves_entregues: qtdChaves ? parseInt(qtdChaves) : null,
      caucao_devolvida: caucaoDevolvida === '' ? null : caucaoDevolvida === 'sim',
    }
    startTransition(async () => {
      const r = await encerrarContrato(contratoId, payload)
      if (r.error) { setErro(r.error); return }
      onFechar()
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl shadow-xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900">Encerrar contrato</h3>
            <p className="text-xs text-gray-500 font-mono">{contratoCodigo}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Motivo *</label>
            <select value={motivo} onChange={e => setMotivo(e.target.value as MotivoEncerramento)} className={inputCls}>
              {MOTIVOS.map(m => <option key={m.valor} value={m.valor}>{m.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Data do encerramento *</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
          </div>

          {/* Entrega de chaves */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Entrega de chaves</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Data da entrega</label>
                <input
                  type="date"
                  value={chavesEntreguesEm}
                  onChange={e => setChavesEntreguesEm(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Qtd. de chaves</label>
                <input
                  type="number"
                  min="0"
                  value={qtdChaves}
                  onChange={e => setQtdChaves(e.target.value)}
                  className={inputCls}
                  placeholder="ex: 3"
                />
              </div>
            </div>
          </div>

          {/* Caução */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Caução foi devolvida?</label>
            <div className="flex gap-2">
              {[
                { v: '', label: 'Não se aplica' },
                { v: 'sim', label: 'Sim' },
                { v: 'nao', label: 'Não' },
              ].map(o => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setCaucaoDevolvida(o.v as 'sim' | 'nao' | '')}
                  className={`flex-1 text-xs font-medium py-2 rounded-lg border transition-colors ${
                    caucaoDevolvida === o.v
                      ? 'bg-violet-700 border-violet-700 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Observação</label>
            <textarea value={observacao} onChange={e => setObs(e.target.value)} rows={2}
              className={`${inputCls} resize-y`} placeholder="Vistoria final, danos, acertos, etc (opcional)" />
          </div>

          <div className="bg-amber-50 border border-amber-100 text-amber-800 text-xs rounded-lg px-3 py-2 flex gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>O imóvel volta para &quot;disponível&quot; automaticamente (se não houver outro contrato ativo). Parcelas futuras ficam no histórico — marque como isentas se necessário.</span>
          </div>

          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onFechar} disabled={isPending}
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={isPending}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Encerrar contrato
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalRenovar({
  contratoId, contratoCodigo,
  dataTerminoAtual, valorAluguelAtual, valorSeguroAtual,
  duracaoMesesAtual, diaVencimentoAtual,
  onFechar,
}: Props & { onFechar: () => void }) {
  const router = useRouter()
  const inicioDefault = dataTerminoAtual ? diaSeguinte(dataTerminoAtual) : HOJE()

  const [dataInicio, setDataInicio] = useState(inicioDefault)
  const [dataPrimeiroAluguel, setDataPrimeiroAluguel] = useState(inicioDefault)
  const [duracaoMeses, setDuracaoMeses] = useState(duracaoMesesAtual)
  const [diaVenc, setDiaVenc] = useState(diaVencimentoAtual)
  const [valorAluguel, setValorAluguel] = useState(
    valorAluguelAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
  const [valorSeguro, setValorSeguro] = useState(
    valorSeguroAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
  const [encerrarAnterior, setEncerrarAnterior] = useState(true)
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const dataTerminoNovo = somarMeses(dataInicio, duracaoMeses)
  const valor = parseMoney(valorAluguel)
  const seguro = parseMoney(valorSeguro)
  const reajusteAbsoluto = valor - valorAluguelAtual
  const reajustePct = valorAluguelAtual ? (reajusteAbsoluto / valorAluguelAtual) * 100 : 0

  const confirmar = () => {
    setErro('')
    if (!valor) { setErro('Valor do aluguel inválido.'); return }
    if (duracaoMeses < 1) { setErro('Duração inválida.'); return }
    if (diaVenc < 1 || diaVenc > 31) { setErro('Dia de vencimento inválido.'); return }

    const payload: RenovarContratoInput = {
      contrato_anterior_id: contratoId,
      data_inicio: dataInicio,
      data_primeiro_aluguel: dataPrimeiroAluguel,
      duracao_meses: duracaoMeses,
      dia_vencimento: diaVenc,
      valor_aluguel: valor,
      valor_seguro_fianca_mensal: seguro || 0,
      encerrar_anterior: encerrarAnterior,
    }
    startTransition(async () => {
      const r = await renovarContrato(payload)
      if (r.error) { setErro(r.error); return }
      onFechar()
      if (r.id) router.push(`/painel/contratos/${r.id}`)
      else router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl shadow-xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900">Renovar contrato</h3>
            <p className="text-xs text-gray-500 font-mono">a partir de {contratoCodigo}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Início *</label>
              <input type="date" value={dataInicio} onChange={e => {
                setDataInicio(e.target.value); setDataPrimeiroAluguel(e.target.value)
              }} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">1º aluguel *</label>
              <input type="date" value={dataPrimeiroAluguel} onChange={e => setDataPrimeiroAluguel(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Duração (meses) *</label>
              <input type="number" min={1} max={60} value={duracaoMeses}
                onChange={e => setDuracaoMeses(parseInt(e.target.value) || 0)} className={inputCls} />
              <p className="text-[11px] text-gray-400 mt-0.5">termina em {dataTerminoNovo}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Dia vencimento *</label>
              <input type="number" min={1} max={31} value={diaVenc}
                onChange={e => setDiaVenc(parseInt(e.target.value) || 0)} className={inputCls} />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Aluguel * (atual {formatarBRL(valorAluguelAtual)})</label>
                <InputMoeda value={valorAluguel} onChange={setValorAluguel} className={inputCls} />
                {reajusteAbsoluto !== 0 && (
                  <p className={`text-[11px] mt-0.5 ${reajusteAbsoluto > 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {reajusteAbsoluto > 0 ? '+' : ''}{formatarBRL(reajusteAbsoluto)} ({reajustePct.toFixed(2).replace('.', ',')}%)
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Seguro fiança mensal</label>
                <InputMoeda value={valorSeguro} onChange={setValorSeguro} className={inputCls} />
              </div>
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-gray-100">
            <input type="checkbox" checked={encerrarAnterior} onChange={e => setEncerrarAnterior(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-violet-600" />
            <span className="text-xs text-gray-700">
              Encerrar o contrato anterior automaticamente (fim natural). O imóvel continua como alugado sem interrupção.
            </span>
          </label>

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
            Criar renovação
          </button>
        </div>
      </div>
    </div>
  )
}
