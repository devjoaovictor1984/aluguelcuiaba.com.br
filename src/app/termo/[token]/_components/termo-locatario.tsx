'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { Pencil, AlertCircle, Loader2, Check, X, KeyRound, MessageSquare, Camera } from 'lucide-react'
import { CapturaSelfie } from '@/components/captura-selfie'
import { locatarioAssinar, locatarioRecusar } from '../actions'

interface Props {
  token: string
  dataEntrega: string | null
  qtdChaves: number
  qtdControles: number
  estadoEntrega: string | null
  observacoes: string | null
  inquilinoNome: string | null
  imovelEndereco: string | null
}

export function TermoLocatario({
  token, dataEntrega, qtdChaves, qtdControles, estadoEntrega, observacoes,
  inquilinoNome, imovelEndereco,
}: Props) {
  const [selfie, setSelfie] = useState<string | null>(null)
  const [observacoesFinal, setObservacoesFinal] = useState('')
  const [recusarMotivo, setRecusarMotivo] = useState('')
  const [mostrarRecusa, setMostrarRecusa] = useState(false)
  const [assinado, setAssinado] = useState(false)
  const [recusado, setRecusado] = useState(false)
  const [erroGlobal, setErroGlobal] = useState('')
  const [isPending, startTransition] = useTransition()

  /* ────────── Canvas de assinatura ─────────── */
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasVazio, setCanvasVazio] = useState(true)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = rect.width * dpr
    c.height = rect.height * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#1f2937'
  }, [])

  const desenhar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1 && e.pointerType !== 'touch' && e.pointerType !== 'pen') return
    const c = canvasRef.current!
    const rect = c.getBoundingClientRect()
    const ctx = c.getContext('2d')!
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (e.type === 'pointerdown') {
      ctx.beginPath()
      ctx.moveTo(x, y)
      setCanvasVazio(false)
    } else {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const limparCanvas = () => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    setCanvasVazio(true)
  }

  const assinar = () => {
    setErroGlobal('')
    if (!selfie) { setErroGlobal('Tire a selfie antes de assinar.'); return }
    if (canvasVazio) { setErroGlobal('Desenhe sua assinatura no quadro abaixo.'); return }
    const c = canvasRef.current!
    const dataUrl = c.toDataURL('image/png')
    startTransition(async () => {
      const r = await locatarioAssinar(token, {
        assinatura_dataurl: dataUrl,
        selfie_dataurl: selfie,
        observacoes: observacoesFinal,
      })
      if (r.error) { setErroGlobal(r.error); return }
      setAssinado(true)
    })
  }

  const recusar = () => {
    setErroGlobal('')
    if (!recusarMotivo.trim()) { setErroGlobal('Diga por que está recusando.'); return }
    startTransition(async () => {
      const r = await locatarioRecusar(token, recusarMotivo)
      if (r.error) { setErroGlobal(r.error); return }
      setRecusado(true)
    })
  }

  if (assinado) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Check size={28} className="text-green-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Entrega confirmada!</h2>
        <p className="text-sm text-gray-500">Sua assinatura foi registrada. A administradora vai confirmar o recebimento. Pode fechar essa página.</p>
      </div>
    )
  }

  if (recusado) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={28} className="text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Recusa registrada</h2>
        <p className="text-sm text-gray-500">A administradora foi avisada. Entrem em contato pra ajustar e enviar um novo termo.</p>
      </div>
    )
  }

  const dataFmt = dataEntrega ? new Date(dataEntrega + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

  return (
    <div className="space-y-4">
      {/* Resumo da entrega */}
      <section className="bg-violet-50 border border-violet-100 rounded-xl p-3 space-y-2 text-sm text-violet-900">
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <KeyRound size={14} /> O que você está devolvendo
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Info label="Data da entrega" valor={dataFmt} />
          <Info label="Estado do imóvel" valor={estadoEntrega || '—'} />
          <Info label="Chaves" valor={String(qtdChaves)} />
          <Info label="Controles" valor={String(qtdControles)} />
        </div>
        {imovelEndereco && <p className="text-xs text-violet-700">{imovelEndereco}</p>}
        {observacoes && <p className="text-xs italic text-violet-800">&ldquo;{observacoes}&rdquo;</p>}
      </section>

      {/* Declaração */}
      <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 border border-gray-100 rounded-xl p-3">
        Eu{inquilinoNome ? <>, <strong>{inquilinoNome}</strong>,</> : ''} declaro que entrego nesta data as chaves
        e controles do imóvel acima, encerrando minha posse, e que as quantidades e o estado descritos estão corretos.
        Caso discorde, use a opção <em>&ldquo;Não concordo&rdquo;</em> no final.
      </p>

      {/* Selfie obrigatória */}
      <section className="bg-white border-2 border-violet-200 rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-bold text-violet-900 flex items-center gap-1.5">
          <Camera size={14} /> Selfie de confirmação <span className="text-red-500">*</span>
        </h3>
        <CapturaSelfie value={selfie} onChange={setSelfie} disabled={isPending} />
      </section>

      {/* Observação final */}
      <section className="bg-white border border-gray-100 rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <MessageSquare size={14} /> Algo a acrescentar?
        </h3>
        <textarea
          value={observacoesFinal}
          onChange={e => setObservacoesFinal(e.target.value)}
          rows={2}
          placeholder="Observação sobre a entrega (opcional)"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900 resize-y"
        />
      </section>

      {/* Canvas de assinatura */}
      <section className="bg-white border-2 border-violet-200 rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-bold text-violet-900 flex items-center gap-1.5">
          <Pencil size={14} /> Sua assinatura <span className="text-red-500">*</span>
        </h3>
        <p className="text-[11px] text-gray-500">
          Use o dedo (no celular) ou o mouse pra desenhar sua assinatura no quadro abaixo.
        </p>
        <canvas
          ref={canvasRef}
          onPointerDown={desenhar}
          onPointerMove={desenhar}
          className="w-full h-32 border border-gray-300 rounded-lg bg-white touch-none cursor-crosshair"
          style={{ touchAction: 'none' }}
        />
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={limparCanvas}
            disabled={isPending || canvasVazio}
            className="text-xs text-gray-500 hover:text-violet-700 disabled:opacity-50"
          >
            Limpar
          </button>
          {canvasVazio && <span className="text-[11px] text-amber-700">Assine no quadro acima</span>}
        </div>
      </section>

      {erroGlobal && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{erroGlobal}</span>
        </div>
      )}

      {/* Botões */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <button
          type="button"
          onClick={assinar}
          disabled={isPending || canvasVazio || !selfie}
          className="flex-1 flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl"
        >
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Confirmar entrega e assinar
        </button>
        <button
          type="button"
          onClick={() => setMostrarRecusa(v => !v)}
          className="text-xs text-red-600 hover:text-red-700 px-3 py-2"
        >
          {mostrarRecusa ? 'Cancelar' : 'Não concordo'}
        </button>
      </div>

      {mostrarRecusa && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-red-900">Conta o que está errado</p>
          <textarea
            value={recusarMotivo}
            onChange={e => setRecusarMotivo(e.target.value)}
            rows={3}
            placeholder="As quantidades estão diferentes? O estado não confere? Descreva aqui."
            className="w-full text-sm px-3 py-2 rounded-lg border border-red-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            type="button"
            onClick={recusar}
            disabled={isPending || !recusarMotivo.trim()}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
            Recusar termo
          </button>
        </div>
      )}
    </div>
  )
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-violet-500 font-semibold">{label}</p>
      <p className="text-violet-900 font-medium">{valor}</p>
    </div>
  )
}
