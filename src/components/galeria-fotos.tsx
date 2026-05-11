'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X, Expand } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Foto } from '@/types'

interface Props {
  fotos: Foto[]
  titulo: string
}

export function GaleriaFotos({ fotos, titulo }: Props) {
  const [atual, setAtual] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [fullscreenIdx, setFullscreenIdx] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const navTo = useCallback((idx: number) => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTo({ left: idx * scrollRef.current.clientWidth, behavior: 'smooth' })
    setAtual(idx)
  }, [])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth)
    setAtual(idx)
  }, [])

  const openFullscreen = useCallback((idx: number) => {
    setFullscreenIdx(idx)
    setFullscreen(true)
  }, [])

  const fsNext = useCallback(() => setFullscreenIdx(i => Math.min(fotos.length - 1, i + 1)), [fotos.length])
  const fsPrev = useCallback(() => setFullscreenIdx(i => Math.max(0, i - 1)), [])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
      if (e.key === 'ArrowLeft') fsPrev()
      if (e.key === 'ArrowRight') fsNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen, fsPrev, fsNext])

  const BtnNav = ({ onClick, children, disabled = false, side }: {
    onClick: () => void; children: React.ReactNode; disabled?: boolean; side: 'left' | 'right'
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={side === 'left' ? 'Anterior' : 'Próxima'}
      className="w-10 h-10 bg-black/50 hover:bg-black/70 active:bg-black/80 disabled:opacity-20 disabled:cursor-not-allowed rounded-full flex items-center justify-center text-white transition-colors"
    >
      {children}
    </button>
  )

  return (
    <>
      {/* ── Galeria principal ── */}
      <div className="relative bg-gray-900 select-none">
        {/* Voltar / X — mobile (topo esquerdo) */}
        <button
          onClick={() => router.back()}
          className="absolute top-3 left-3 z-10 w-10 h-10 bg-black/40 hover:bg-black/60 active:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft size={22} />
        </button>

        {!fotos || fotos.length === 0 ? (
          <div className="h-72 sm:h-[400px] flex items-center justify-center bg-gray-100">
            <div className="text-center text-gray-400">
              <div className="text-5xl mb-2">🏠</div>
              <p className="text-sm">Sem fotos disponíveis</p>
            </div>
          </div>
        ) : (
          <>
            {/* Carrossel */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex overflow-x-auto snap-x snap-mandatory scroll-hide touch-pan-x"
            >
              {fotos.map((foto, i) => (
                <button
                  key={foto.id}
                  onClick={() => openFullscreen(i)}
                  className="snap-start shrink-0 w-full relative h-72 sm:h-[400px] bg-gray-900 cursor-zoom-in"
                  tabIndex={i === 0 ? 0 : -1}
                  aria-label={`Ver foto ${i + 1} em tela cheia`}
                >
                  <Image
                    src={foto.url}
                    alt={`${titulo} — ${i + 1}`}
                    fill
                    className="object-cover"
                    priority={i === 0}
                    sizes="100vw"
                  />
                </button>
              ))}
            </div>

            {/* Prev/Next — somente desktop */}
            {fotos.length > 1 && (
              <>
                <div className="absolute top-1/2 left-3 -translate-y-1/2 z-10 hidden sm:block">
                  <BtnNav onClick={() => navTo(Math.max(0, atual - 1))} disabled={atual === 0} side="left">
                    <ChevronLeft size={20} />
                  </BtnNav>
                </div>
                <div className="absolute top-1/2 right-3 -translate-y-1/2 z-10 hidden sm:block">
                  <BtnNav onClick={() => navTo(Math.min(fotos.length - 1, atual + 1))} disabled={atual === fotos.length - 1} side="right">
                    <ChevronRight size={20} />
                  </BtnNav>
                </div>
              </>
            )}

            {/* Controles bottom */}
            <div className="absolute bottom-3 inset-x-3 flex items-end justify-between pointer-events-none">
              <div className="flex items-center gap-1 pointer-events-none">
                {fotos.length <= 10 && fotos.map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-200 ${i === atual ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  onClick={() => openFullscreen(atual)}
                  className="w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
                  aria-label="Tela cheia"
                >
                  <Expand size={14} />
                </button>
                <span className="bg-black/50 text-white text-xs px-2.5 py-1 rounded-full font-medium tabular-nums">
                  {atual + 1}/{fotos.length}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Fullscreen (lightbox) ── */}
      {fullscreen && fotos.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col"
          role="dialog"
          aria-label="Galeria em tela cheia"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <span className="text-white/70 text-sm tabular-nums">
              {fullscreenIdx + 1} / {fotos.length}
            </span>
            <button
              onClick={() => setFullscreen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 transition-colors text-white"
              aria-label="Fechar"
            >
              <X size={22} />
            </button>
          </div>

          {/* Imagem */}
          <div className="flex-1 relative">
            <Image
              src={fotos[fullscreenIdx].url}
              alt={`${titulo} — ${fullscreenIdx + 1}`}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>

          {/* Setas laterais (ambos desktop e mobile) */}
          {fotos.length > 1 && (
            <>
              <button
                onClick={fsPrev}
                disabled={fullscreenIdx === 0}
                aria-label="Anterior"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-black/50 hover:bg-black/70 disabled:opacity-20 disabled:cursor-not-allowed rounded-full flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={fsNext}
                disabled={fullscreenIdx === fotos.length - 1}
                aria-label="Próxima"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-black/50 hover:bg-black/70 disabled:opacity-20 disabled:cursor-not-allowed rounded-full flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {/* Thumbnails strip (desktop) */}
          {fotos.length > 1 && (
            <div className="shrink-0 hidden sm:flex justify-center gap-1.5 py-3 px-4 overflow-x-auto scroll-hide">
              {fotos.map((foto, i) => (
                <button
                  key={foto.id}
                  onClick={() => setFullscreenIdx(i)}
                  className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 transition-all border-2 ${i === fullscreenIdx ? 'border-white opacity-100' : 'border-transparent opacity-50 hover:opacity-80'}`}
                >
                  <Image src={foto.url} alt="" width={48} height={48} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
