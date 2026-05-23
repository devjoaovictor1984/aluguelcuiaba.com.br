// Builder único de Metadata. Centraliza:
//   - truncamento de title/description (sweet spots do Google)
//   - canonical absoluto
//   - OG e Twitter padronizados
//   - default image
// Uso: `return buildMetadata({ title, description, path, image })`
//
// O title aqui é a parte ANTES do "| AluguelCuiabá" (template do root layout).
// Mantenha em <= 43 chars pra ficar em 60 com o sufixo.

import type { Metadata } from 'next'
import { truncarComEllipsis } from '@/lib/utils'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aluguelcuiaba.com.br'

interface Input {
  /** Parte do title antes do " | AluguelCuiabá". Será truncado em 43c. */
  title?: string
  /** Description SEO. Será truncada em 155c. Se omitida, usa default da marca. */
  description?: string
  /** Path relativo (ex: "/blog/foo"). Vira canonical absoluto. */
  path?: string
  /** URL absoluta da imagem de OG/Twitter. Cache-buster (?t=) é removido. */
  image?: string | null
  /** "article" para posts, "website" pra resto. Default: website. */
  type?: 'website' | 'article'
  publishedTime?: string
  modifiedTime?: string
  /** Tags de keywords (artigos). */
  keywords?: string[]
  /** Se true, marca noindex (404, redirects, paginas de teste). */
  noindex?: boolean
}

export function buildMetadata(input: Input = {}): Metadata {
  const title = input.title ? truncarComEllipsis(input.title, 43) : undefined
  const description = input.description
    ? truncarComEllipsis(input.description, 155)
    : undefined
  const url = input.path
    ? (input.path.startsWith('http') ? input.path : `${APP_URL}${input.path}`)
    : undefined
  const image = input.image ? input.image.split('?')[0] : `${APP_URL}/og-default.jpg`
  const type = input.type ?? 'website'

  const meta: Metadata = {}

  if (title) meta.title = title
  if (description) meta.description = description
  if (input.keywords?.length) meta.keywords = input.keywords
  if (url) meta.alternates = { canonical: url }
  if (input.noindex) meta.robots = { index: false, follow: true }

  meta.openGraph = {
    type,
    locale: 'pt_BR',
    siteName: 'AluguelCuiabá',
    title,
    description,
    url,
    images: [{ url: image, width: 1200, height: 630, alt: title ?? 'AluguelCuiabá' }],
    ...(type === 'article' && input.publishedTime && { publishedTime: input.publishedTime }),
    ...(type === 'article' && input.modifiedTime && { modifiedTime: input.modifiedTime }),
  }

  meta.twitter = {
    card: 'summary_large_image',
    title,
    description,
    images: [image],
  }

  return meta
}
