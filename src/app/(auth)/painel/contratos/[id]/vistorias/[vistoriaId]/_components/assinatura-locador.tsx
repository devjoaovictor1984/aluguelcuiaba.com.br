'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, PenLine, Eraser, CheckCircle2 } from 'lucide-react'
import { CapturaSelfie } from '@/components/captura-selfie'
import { assinarVistoriaComoLocador } from '../../actions'

/**
 * Contra-assinatura da administradora na vistoria (v99).
 *
 * Mesmo desenho do termo de entrega de chaves: canvas pra desenhar e selfie
 * opcional. Opcional porque quem assina aqui entrou com login — a identidade
 * não depende da foto, ela é reforço.
 *
 * Pode ser usada antes ou depois de o inquilino assinar; quem fecha por
 * último leva a vistoria a 'concluida'.
 */
export function AssinaturaLocador({
  vistoriaId, assinadaEm, assinaturaUrl, selfieUrl,
}: {
  vistoriaId: string
  assinadaEm: string | null
  assinaturaUrl: string | null
  selfieUrl: string | null
}) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasVazio, setCanvasVazio] = useState(true)
  const [selfie, setSelfie] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const jaAssinou = !!assinadaEm

  useEffect(() => {
    if (jaAssinou) return
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
  }, [jaAssinou])

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

  const limpar = () => {
    const c = canvasRef.current
    if (!c) return
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setCanvasVazio(true)
  }

  const assinar = () => {
    setErro('')
    if (canvasVazio) { setErro('Desenhe sua assinatura no quadro.'); return }
    const dataUrl = canvasRef.current!.toDataURL('image/png')
    startTransition(async () => {
      const r = await assinarVistoriaComoLocador(vistoriaId, {
        assinatura_dataurl: dataUrl,
        selfie_dataurl: selfie,
      })
      if (r.error) { setErro(r.error); return }
      router.refresh()
    })
  }

  if (jaAssinou) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-green-600" />
          Assinatura da administradora · {new Date(assinadaEm).toLocaleString('pt-BR')}
        </p>
        <div className="flex items-start gap-4 flex-wrap justify-center">
          {selfieUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={selfieUrl} alt="Selfie" className="w-20 h-20 object-cover rounded-xl border border-gray-100" />
          )}
          {assinaturaUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={assinaturaUrl} alt="Assinatura da administradora" className="max-h-20" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-violet-200 rounded-xl p-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700 flex items-center gap-1.5">
        <PenLine size={12} /> Sua assinatura
      </p>
      <p className="text-[11px] text-gray-500 leading-snug">
        Assinando, a administradora confirma que recebeu este laudo — inclusive as ressalvas que o inquilino
        registrou nos itens — e está de acordo com ele.
      </p>

      <canvas
        ref={canvasRef}
        onPointerDown={desenhar}
        onPointerMove={desenhar}
        className="w-full h-28 rounded-lg border border-dashed border-gray-300 bg-gray-50 touch-none cursor-crosshair"
      />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={limpar}
          disabled={canvasVazio || isPending}
          className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 disabled:opacity-40"
        >
          <Eraser size={11} /> Limpar
        </button>
        <span className="text-[10px] text-gray-400">Desenhe com o dedo, caneta ou mouse</span>
      </div>

      <details className="group">
        <summary className="text-[11px] text-violet-700 cursor-pointer hover:underline">
          Anexar selfie (opcional)
        </summary>
        <div className="mt-2">
          <CapturaSelfie value={selfie} onChange={setSelfie} disabled={isPending} />
        </div>
      </details>

      {erro && <p className="text-xs text-rose-600">{erro}</p>}

      <button
        type="button"
        onClick={assinar}
        disabled={isPending || canvasVazio}
        className="w-full flex items-center justify-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg"
      >
        {isPending ? <Loader2 size={13} className="animate-spin" /> : <PenLine size={13} />}
        Assinar vistoria
      </button>
    </div>
  )
}
