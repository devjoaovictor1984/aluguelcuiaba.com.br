'use client'

import { useState, useEffect, useCallback } from 'react'
import { Imagem } from '@/components/imagem'

interface Banner {
  id: string
  imagem_url: string
  link_url: string | null
  ordem: number
}

export function BannerSidebar({ banners }: { banners: Banner[] }) {
  const [idx, setIdx] = useState(0)
  const [fade, setFade] = useState(true)

  const goTo = useCallback((i: number) => {
    setFade(false)
    setTimeout(() => {
      setIdx(i)
      setFade(true)
    }, 200)
  }, [])

  useEffect(() => {
    if (banners.length <= 1) return
    const t = setInterval(() => {
      goTo((idx + 1) % banners.length)
    }, 5000)
    return () => clearInterval(t)
  }, [banners.length, idx, goTo])

  if (!banners.length) return null

  const banner = banners[idx]

  const image = (
    <div className="relative w-full">
      <Imagem
        src={banner.imagem_url}
        alt="Patrocinador"
        aspect="1/1"
        wrapperClassName="rounded-xl bg-gray-100"
        sizes="(max-width: 1024px) 100vw, 252px"
        style={{ opacity: fade ? 1 : 0, transition: 'opacity 0.2s ease' }}
      />
      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1.5 pb-2.5">
        {banners.length > 1 && banners.map((_, i) => (
          <button
            key={i}
            onClick={e => { e.preventDefault(); goTo(i) }}
            aria-label={`Slide ${i + 1}`}
            className="w-1.5 h-1.5 rounded-full transition-colors"
            style={{ background: i === idx ? 'white' : 'rgba(255,255,255,0.45)' }}
          />
        ))}
      </div>
      <span className="absolute top-2 right-2 bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded font-medium tracking-wide">
        Patrocinado
      </span>
    </div>
  )

  if (banner.link_url) {
    return (
      <a href={banner.link_url} target="_blank" rel="noopener noreferrer sponsored" className="block">
        {image}
      </a>
    )
  }

  return image
}
