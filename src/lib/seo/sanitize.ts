// Sanitização + pós-processamento de HTML vindo do editor (tiptap).
// SERVER-ONLY: usa sanitize-html (JS puro, sem jsdom). Roda no servidor
// antes do dangerouslySetInnerHTML (ou antes de mandar pro client via API).
//
// Uma única função pra qualquer conteúdo editorial: posts, seções de ajuda,
// descrições longas. Se a regra muda (ex: rebaixar h2→h3 num contexto),
// muda aqui e propaga.
//
// SEGURANÇA: o passo 1 (sanitize-html) mantém só tags/atributos da allowlist
// — remove <script>, atributos on* (onerror, onclick…), javascript: em href,
// <iframe>, etc. — bloqueando XSS armazenado em conteúdo de origem não
// confiável (ex: descrição de imóvel preenchida pelo anunciante). Os passos
// seguintes são só SEO.

import 'server-only'
import sanitizeHtml from 'sanitize-html'

interface Options {
  /** Rebaixa h1 → h2 pra evitar múltiplos H1 na página. Default: true. */
  rebaixarH1?: boolean
  /** Adiciona loading="lazy" e decoding="async" em <img>. Default: true. */
  lazyImages?: boolean
  /** Adiciona rel="nofollow noopener noreferrer" em links externos. Default: true. */
  externalLinksSafe?: boolean
}

const APP_HOST = new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://aluguelcuiaba.com.br').host

// Allowlist que preserva a formatação do tiptap (títulos, listas, links,
// imagens, tabelas, alinhamento e cor) e descarta o resto.
const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    '*': ['style', 'class'],
  },
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
      'color': [/^#(0x)?[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/],
      'background-color': [/^#(0x)?[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/],
    },
  },
  // Esquemas seguros: href nunca aceita javascript:; img aceita data: (imagem).
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  disallowedTagsMode: 'discard',
}

export function sanitizeHtmlContent(html: string, opts: Options = {}): string {
  if (!html) return ''
  const o = { rebaixarH1: true, lazyImages: true, externalLinksSafe: true, ...opts }

  // 1. Sanitização de segurança (anti-XSS) via allowlist.
  let out = sanitizeHtml(html, SANITIZE_OPTS)

  if (o.rebaixarH1) {
    out = out.replace(/<h1(\s[^>]*)?>/gi, '<h2$1>').replace(/<\/h1>/gi, '</h2>')
  }

  if (o.lazyImages) {
    out = out.replace(/<img(\s[^>]*)?>/gi, (match) => {
      let tag = match
      if (!/\bloading=/i.test(tag)) tag = tag.replace('<img', '<img loading="lazy"')
      if (!/\bdecoding=/i.test(tag)) tag = tag.replace('<img', '<img decoding="async"')
      return tag
    })
  }

  if (o.externalLinksSafe) {
    out = out.replace(/<a\s+([^>]*?)href=(["'])([^"']+)\2([^>]*)>/gi, (match, pre, q, href, post) => {
      try {
        const u = new URL(href, `https://${APP_HOST}`)
        if (u.host && u.host !== APP_HOST) {
          const attrs = `${pre} ${post}`.toLowerCase()
          let rel = (attrs.match(/rel=(["'])([^"']*)\1/)?.[2] ?? '')
          const set = new Set(rel.split(/\s+/).filter(Boolean))
          set.add('nofollow'); set.add('noopener'); set.add('noreferrer')
          rel = Array.from(set).join(' ')
          // Remove rel antigo de pre/post, depois reconstrói com rel novo
          const cleanPre = pre.replace(/\srel=(["'])[^"']*\1/i, '')
          const cleanPost = post.replace(/\srel=(["'])[^"']*\1/i, '')
          return `<a ${cleanPre}href=${q}${href}${q}${cleanPost} rel="${rel}">`
        }
      } catch { /* href inválido — ignora */ }
      return match
    })
  }

  return out
}

/** Extrai texto puro (sem HTML) — útil pra Schema.articleBody e excerpt. */
export function htmlParaTextoPlano(html: string): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
