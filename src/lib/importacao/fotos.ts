import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { baixar, ErroDownload } from './baixar'

/**
 * Baixa as fotos do sistema de origem e grava no bucket do site.
 *
 * Toda foto é reprocessada (sharp): vira JPG — o único formato que o
 * portal aceita, ver src/lib/portais/vrsync.ts —, gira pela orientação da
 * câmera, fica com no máximo 1920 px e PERDE os metadados. Isso importa: a
 * foto do celular guarda o GPS da casa no EXIF, e o site só mostra o bairro.
 */

const BUCKET = 'fotos-imoveis'
const MAX_BYTES = 25 * 1024 * 1024
const CONCORRENCIA = 4

type Sharp = typeof import('sharp')
let sharpCarregado: Sharp | null | undefined

async function carregarSharp(): Promise<Sharp | null> {
  if (sharpCarregado !== undefined) return sharpCarregado
  try {
    const m = await import('sharp')
    sharpCarregado = (m.default ?? m) as Sharp
  } catch (e) {
    console.warn('[importacao] sharp indisponível, fotos JPG sobem sem reprocessar:', e instanceof Error ? e.message : e)
    sharpCarregado = null
  }
  return sharpCarregado
}

function ehJpeg(b: Buffer) { return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff }
function pareceImagem(b: Buffer) {
  if (ehJpeg(b)) return true
  const h = b.subarray(0, 16)
  return (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47)         // PNG
    || (h.toString('latin1', 0, 4) === 'RIFF' && h.toString('latin1', 8, 12) === 'WEBP')
    || h.toString('latin1', 0, 3) === 'GIF'
    || h.toString('latin1', 4, 8) === 'ftyp'                                       // AVIF/HEIC
    || (h[0] === 0x42 && h[1] === 0x4d)                                             // BMP
    || (h[0] === 0x49 && h[1] === 0x49) || (h[0] === 0x4d && h[1] === 0x4d)       // TIFF
}

export async function prepararFoto(bytes: Buffer): Promise<Buffer> {
  if (!pareceImagem(bytes)) throw new Error('o arquivo não é uma imagem')
  const sharp = await carregarSharp()
  if (!sharp) {
    if (ehJpeg(bytes)) return bytes
    throw new Error('formato não suportado (só JPG sem o conversor)')
  }
  try {
    return await sharp(bytes, { failOn: 'none', limitInputPixels: 120_000_000 })
      .rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })  // PNG transparente não fica preto
      .jpeg({ quality: 82, progressive: true, mozjpeg: false })
      .toBuffer()
  } catch (e) {
    throw new Error(`imagem corrompida ou formato não suportado (${e instanceof Error ? e.message : e})`)
  }
}

export interface FotoGravada { url: string; path: string; origem: string }

export interface ResultadoFotos {
  gravadas: FotoGravada[]
  falhas: Array<{ origem: string; motivo: string }>
}

/** Baixa e grava na ordem recebida (a primeira é a principal). */
export async function importarFotos(
  db: SupabaseClient,
  userId: string,
  imovelId: string,
  urls: string[],
  prazo: number,
): Promise<ResultadoFotos> {
  const lote = Date.now().toString(36)
  const resultado: Array<FotoGravada | { origem: string; motivo: string }> = new Array(urls.length)
  let proxima = 0

  async function trabalhador() {
    while (proxima < urls.length) {
      const i = proxima++
      const origem = urls[i]
      if (Date.now() > prazo) { resultado[i] = { origem, motivo: 'tempo do lote esgotado' }; continue }
      try {
        const { bytes } = await baixar(origem, { maxBytes: MAX_BYTES, timeoutMs: 30_000, aceitar: 'image/*' })
        const jpg = await prepararFoto(bytes)
        const path = `${userId}/${imovelId}/imp-${lote}-${i + 1}.jpg`
        const { error } = await db.storage.from(BUCKET).upload(path, jpg, {
          contentType: 'image/jpeg', upsert: true, cacheControl: '31536000',
        })
        if (error) throw new Error(`armazenamento: ${error.message}`)
        const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path)
        resultado[i] = { url: publicUrl, path, origem }
      } catch (e) {
        resultado[i] = { origem, motivo: e instanceof ErroDownload || e instanceof Error ? e.message : String(e) }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, urls.length) }, trabalhador))

  const gravadas: FotoGravada[] = []
  const falhas: ResultadoFotos['falhas'] = []
  for (const r of resultado) {
    if (!r) continue
    if ('url' in r) gravadas.push(r)
    else falhas.push(r)
  }
  return { gravadas, falhas }
}

/** Caminho no bucket a partir da URL pública (só as do nosso bucket). */
export function caminhoDaUrl(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/public\/fotos-imoveis\/([^?#]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export async function apagarArquivos(db: SupabaseClient, urls: string[]) {
  const paths = urls.map(caminhoDaUrl).filter((p): p is string => !!p)
  for (let i = 0; i < paths.length; i += 100) {
    await db.storage.from(BUCKET).remove(paths.slice(i, i + 100)).catch(() => {})
  }
}
