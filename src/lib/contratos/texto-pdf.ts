/**
 * Limpeza de texto que vai pro PDF do contrato.
 *
 * A descrição do anúncio é HTML do TipTap e costuma ter emoji (🏢, ✅...).
 * A Poppins não tem esses glifos: o react-pdf desenha lixo no lugar
 * (ex.: "🏢 Sala" saía como "<Sâala"). Entidade (&nbsp;) também passava
 * crua, e trocar tag por espaço deixava "Cuiabá , ideal".
 */

const ENTIDADES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
  ordm: 'º', orda: 'ª', deg: '°', sup2: '²', middot: '·', bull: '•',
}

function decodificarEntidades(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, nome) => ENTIDADES[nome.toLowerCase()] ?? m)
}

/** Tira emoji, símbolos pictográficos e caracteres invisíveis que a fonte não desenha. */
export function removerCaracteresSemGlifo(s: string): string {
  return s
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]/gu, '') // bandeiras e tons de pele
    .replace(/[︀-️​-‍⁠﻿⃣]/g, '') // variation selector, ZWJ, zero-width
    .replace(/\p{Cc}/gu, c => (c === '\n' ? '\n' : ' '))
}

/** Arruma espaços: sem espaço antes de pontuação, sem espaços duplicados. */
function normalizarEspacos(s: string, manterQuebras: boolean): string {
  let t = s.replace(/ /g, ' ')
  t = manterQuebras
    ? t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n')
    : t.replace(/\s+/g, ' ')
  return t.replace(/ +([,.;:!?)])/g, '$1').replace(/\( +/g, '(').trim()
}

/**
 * HTML (ou texto) → texto puro seguro pro PDF.
 * `manterQuebras`: parágrafos viram quebra de linha (corpo do contrato);
 * sem ela, tudo numa linha só (capa).
 */
export function textoPdfDeHtml(html: string | null | undefined, opts: { manterQuebras?: boolean } = {}): string {
  if (!html) return ''
  const manter = opts.manterQuebras ?? false
  const sep = manter ? '\n' : ' '
  let t = html
    .replace(/<br\s*\/?>/gi, sep)
    .replace(/<\/(p|div|li|h[1-6])>/gi, manter ? '\n\n' : ' ¶ ')
    .replace(/<li[^>]*>/gi, manter ? '• ' : ' ')
    // tag inline (strong, em, span...) some sem virar espaço — senão "Cuiabá</strong>," vira "Cuiabá ,"
    .replace(/<\/?(strong|b|em|i|u|span|a|mark|s|sub|sup)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
  t = decodificarEntidades(t)
  t = removerCaracteresSemGlifo(t)
  t = normalizarEspacos(t, manter)
  if (manter) return t
  // capa: fim de parágrafo vira ponto ("…em Cuiabá. Sala comercial…")
  return t
    .replace(/\s*(?:¶\s*)+/g, ' ¶ ')
    .replace(/([.!?:;…])?\s*¶\s*/g, (_, p) => (p ? `${p} ` : '. '))
    .replace(/^[.\s]+/, '')
    .replace(/[\s.]+$/, m => (m.includes('.') ? '.' : ''))
    .trim()
}
