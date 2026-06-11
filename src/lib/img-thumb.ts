// Converte uma URL pública do Supabase Storage numa URL do render endpoint
// redimensionada + WebP. Pra <img>/background-image que NÃO passam pelo
// next/image (ex: pins e popup do mapa Leaflet). URLs não-Supabase voltam
// como estão.
//
// Motivo: os pins do mapa usavam a foto ORIGINAL (~120KB) num círculo de
// 44px — desperdício enorme de banda. Aqui pedimos só o tamanho exibido.

const PUBLIC_PREFIX = '/storage/v1/object/public/'
const RENDER_PREFIX = '/storage/v1/render/image/public/'

export function thumbSupabase(src: string | null | undefined, width: number, quality = 70): string {
  if (!src || !src.includes('.supabase.co') || !src.includes(PUBLIC_PREFIX)) return src ?? ''
  try {
    const url = new URL(src)
    url.search = ''
    url.pathname = url.pathname.replace(PUBLIC_PREFIX, RENDER_PREFIX)
    url.searchParams.set('width', String(Math.min(width, 2500)))
    url.searchParams.set('quality', String(quality))
    url.searchParams.set('resize', 'contain')
    url.searchParams.set('format', 'webp')
    return url.toString()
  } catch {
    return src
  }
}
