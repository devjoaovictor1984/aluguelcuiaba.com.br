'use client'

// Loader custom de next/image. Em vez de mandar tudo pro otimizador da Vercel
// (que estourou cota e passou a responder 402 em /_next/image), as imagens do
// Supabase Storage são redimensionadas pelo próprio Supabase via o endpoint
// /storage/v1/render/image/public/... — incluído no plano e sem cota da Vercel.
//
// Imagens que NÃO são do Supabase (logos/SVGs locais em /public, etc.) passam
// direto, sem otimização — comportamento seguro pra assets estáticos.

interface LoaderArgs {
  src: string
  width: number
  quality?: number
}

// Supabase aceita width/height de 1 a 2500. Acima disso o render devolve 400.
const MAX_WIDTH = 2500

const PUBLIC_PREFIX = '/storage/v1/object/public/'
const RENDER_PREFIX = '/storage/v1/render/image/public/'

export default function supabaseImageLoader({ src, width, quality }: LoaderArgs): string {
  // Não-Supabase (assets locais, data URIs, etc.): serve como está.
  if (!src.includes('.supabase.co') || !src.includes(PUBLIC_PREFIX)) {
    return src
  }

  const url = new URL(src)
  // Remove cache-buster (?t=...) que alguns uploads antigos anexavam.
  url.search = ''
  // object/public -> render/image/public (mesmo path, com transformação)
  url.pathname = url.pathname.replace(PUBLIC_PREFIX, RENDER_PREFIX)

  const w = Math.min(width, MAX_WIDTH)
  url.searchParams.set('width', String(w))
  url.searchParams.set('quality', String(quality ?? 75))
  // resize=contain evita corte; o object-fit do CSS cuida do enquadramento.
  url.searchParams.set('resize', 'contain')

  return url.toString()
}
