'use client'

import { useRef, useState, useEffect } from 'react'
import { Eraser } from 'lucide-react'

interface Props {
  value: string | null
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
}

// Pad de assinatura desenhada (mouse/dedo). Devolve PNG via data URL.
export function SignaturePad({ value, onChange, disabled = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const desenhando = useRef(false)
  const [temTraco, setTemTraco] = useState(!!value)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // resolução interna fixa pra qualidade consistente
    canvas.width = 600
    canvas.height = 200
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1f2937'
  }, [])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    desenhando.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    canvasRef.current!.setPointerCapture(e.pointerId)
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!desenhando.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const end = () => {
    if (!desenhando.current) return
    desenhando.current = false
    setTemTraco(true)
    onChange(canvasRef.current!.toDataURL('image/png'))
  }

  const limpar = () => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setTemTraco(false)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-violet-200 rounded-xl bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full touch-none"
          style={{ height: 160, cursor: disabled ? 'not-allowed' : 'crosshair' }}
        />
        {!temTraco && (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-gray-300 pointer-events-none">
            assine aqui
          </span>
        )}
      </div>
      {!disabled && (
        <button type="button" onClick={limpar} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-violet-700">
          <Eraser size={12} /> Limpar
        </button>
      )}
    </div>
  )
}
