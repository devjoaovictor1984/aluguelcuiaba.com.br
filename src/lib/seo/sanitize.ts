// Pós-processamento de HTML vindo do editor (tiptap).
// Roda em Server Component antes do dangerouslySetInnerHTML.
//
// Uma única função pra qualquer conteúdo editorial: posts, seções de ajuda,
// descrições longas. Se a regra muda (ex: rebaixar h2→h3 num contexto),
// muda aqui e propaga.

interface Options {
  /** Rebaixa h1 → h2 pra evitar múltiplos H1 na página. Default: true. */
  rebaixarH1?: boolean
  /** Adiciona loading="lazy" e decoding="async" em <img>. Default: true. */
  lazyImages?: boolean
  /** Adiciona rel="nofollow noopener noreferrer" em links externos. Default: true. */
  externalLinksSafe?: boolean
}

const APP_HOST = new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://aluguelcuiaba.com.br').host

export function sanitizeHtmlContent(html: string, opts: Options = {}): string {
  if (!html) return ''
  const o = { rebaixarH1: true, lazyImages: true, externalLinksSafe: true, ...opts }
  let out = html

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
