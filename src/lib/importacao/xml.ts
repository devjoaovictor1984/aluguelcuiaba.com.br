/**
 * Leitura do XML de outro sistema: descobre o formato e devolve os imóveis
 * crus (objeto do parser), sem converter nada ainda — isso é o `mapear.ts`.
 *
 * Formatos aceitos:
 *  - VRSync (`<ListingDataFeed>`): o padrão do Grupo OLX, o que quase todo
 *    sistema gera para o ZAP/Viva Real. Spec: developers.grupozap.com/feeds/vrsync
 *  - ZAP legado (`<Carga><Imoveis><Imovel>`): o formato anterior ao VRSync,
 *    que sistemas mais antigos ainda geram.
 *
 * Funções puras (sem rede/banco) — testadas em tests/importacao.
 * Ver docs/integracoes/importacao/README.md.
 */
import { XMLParser } from 'fast-xml-parser'
import { gunzipSync } from 'node:zlib'

export type FormatoImportacao = 'vrsync' | 'zap_legado'

export type NoXml = Record<string, unknown>

export interface XmlLido {
  formato: FormatoImportacao
  listagens: NoXml[]
  /** Nome do sistema que gerou (Header/Provider), quando houver. */
  provedor: string | null
}

export class ErroImportacao extends Error {}

/** Tags que podem aparecer uma ou várias vezes: sempre viram lista. */
const SEMPRE_LISTA = new Set([
  'Listing', 'Item', 'Feature', 'Warranty', 'Imovel', 'Foto', 'Video', 'Telephone',
])

/**
 * Bytes → texto respeitando o `encoding` declarado. Sistema antigo ainda
 * gera ISO-8859-1 / Windows-1252; ler como UTF-8 estragaria todo acento.
 * Arquivo .gz (alguns feeds são servidos compactados) é descompactado.
 */
export function decodificarXml(bytes: Uint8Array): string {
  let buf = bytes
  if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    try {
      buf = new Uint8Array(gunzipSync(buf, { maxOutputLength: 400 * 1024 * 1024 }))
    } catch {
      throw new ErroImportacao('O arquivo parece compactado (.gz), mas não deu para descompactar.')
    }
  }
  // BOM UTF-8 / UTF-16
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return new TextDecoder('utf-8').decode(buf.subarray(3))
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf.subarray(2))
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf.subarray(2))

  const cabeca = new TextDecoder('latin1').decode(buf.subarray(0, 300))
  const m = cabeca.match(/<\?xml[^>]*encoding\s*=\s*["']([\w.:-]+)["']/i)
  const declarado = (m?.[1] ?? 'utf-8').toLowerCase()
  let encoding = declarado
  if (['iso-8859-1', 'latin1', 'latin-1', 'iso8859-1', 'cp1252', 'windows-1252'].includes(declarado)) encoding = 'windows-1252'
  try {
    const texto = new TextDecoder(encoding, { fatal: encoding === 'utf-8' }).decode(buf)
    return texto
  } catch {
    // Declarou UTF-8 mas veio em Latin-1 (acontece): lê como Windows-1252.
    return new TextDecoder('windows-1252').decode(buf)
  }
}

/** Nome da tag sem prefixo de namespace e sem caixa. */
function chave(k: string) {
  return k.replace(/^.*:/, '').toLowerCase()
}

/** Pega um filho pelo nome, ignorando maiúsculas/minúsculas e namespace. */
export function filho(no: unknown, nome: string): unknown {
  if (!no || typeof no !== 'object' || Array.isArray(no)) return undefined
  const alvo = nome.toLowerCase()
  for (const [k, v] of Object.entries(no as NoXml)) {
    if (chave(k) === alvo) return v
  }
  return undefined
}

/** Caminho de filhos: `caminho(no, 'Details', 'Description')`. */
export function caminho(no: unknown, ...nomes: string[]): unknown {
  let atual: unknown = no
  for (const n of nomes) {
    if (Array.isArray(atual)) atual = atual[0]
    atual = filho(atual, n)
    if (atual === undefined) return undefined
  }
  return atual
}

export function lista(v: unknown): unknown[] {
  if (v === undefined || v === null || v === '') return []
  return Array.isArray(v) ? v : [v]
}

/** Texto de um nó (string, número, ou objeto com #text e atributos). */
export function texto(v: unknown): string | null {
  if (v === undefined || v === null) return null
  if (Array.isArray(v)) return texto(v[0])
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'object') {
    const t = (v as NoXml)['#text']
    return t === undefined ? null : texto(t)
  }
  return null
}

/** Atributo de um nó (`@_period`), ignorando caixa. */
export function atributo(v: unknown, nome: string): string | null {
  if (Array.isArray(v)) v = v[0]
  if (!v || typeof v !== 'object') return null
  const alvo = '@_' + nome.toLowerCase()
  for (const [k, val] of Object.entries(v as NoXml)) {
    if (k.toLowerCase() === alvo || k.toLowerCase().replace(/^@_.*:/, '@_') === alvo) {
      return val == null ? null : String(val).trim() || null
    }
  }
  return null
}

export function lerXml(xml: string): XmlLido {
  if (/^\s*(<\?xml[^>]*>\s*)?<(!doctype\s+html|html)[\s>]/i.test(xml)) {
    throw new ErroImportacao('O endereço devolveu uma página da internet (HTML), não o XML. Confira a URL do feed.')
  }
  if (!xml.trim()) throw new ErroImportacao('O arquivo está vazio.')

  // DOCTYPE fora: o feed não precisa de entidade declarada, e é por ela que
  // vêm os ataques (XXE / "billion laughs"). O parser já não resolve
  // entidade externa; tirar o DOCTYPE fecha a porta de vez.
  const limpo = xml.replace(/<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>/gi, '')

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,     // "0065" continua "0065", CEP não perde zero
    parseAttributeValue: false,
    trimValues: true,
    processEntities: true,
    htmlEntities: true,
    isArray: (nome) => SEMPRE_LISTA.has(nome.replace(/^.*:/, '')),
  })

  let raiz: NoXml
  try {
    raiz = parser.parse(limpo) as NoXml
  } catch (e) {
    throw new ErroImportacao(`O arquivo não é um XML válido: ${e instanceof Error ? e.message : String(e)}`)
  }

  const vrsync = filho(raiz, 'ListingDataFeed')
  if (vrsync !== undefined) {
    const listagens = lista(caminho(vrsync, 'Listings', 'Listing')) as NoXml[]
    return {
      formato: 'vrsync',
      listagens: listagens.filter(l => l && typeof l === 'object'),
      provedor: texto(caminho(vrsync, 'Header', 'Provider')),
    }
  }

  const carga = filho(raiz, 'Carga')
  if (carga !== undefined) {
    const listagens = lista(caminho(carga, 'Imoveis', 'Imovel')) as NoXml[]
    return { formato: 'zap_legado', listagens: listagens.filter(l => l && typeof l === 'object'), provedor: null }
  }

  const tags = Object.keys(raiz).filter(k => !k.startsWith('?') && !k.startsWith('@_') && k !== '#text')
  if (!tags.length) throw new ErroImportacao('O arquivo está vazio ou não é XML.')
  throw new ErroImportacao(
    `Formato não reconhecido (a primeira tag é <${tags[0]}>). Aceitamos o XML VRSync (<ListingDataFeed>), o mesmo que o sistema manda para o ZAP/Viva Real, e o formato antigo do ZAP (<Carga>).`,
  )
}
