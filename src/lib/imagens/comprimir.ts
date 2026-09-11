/**
 * Reduz foto de documento antes de subir, no navegador.
 *
 * Foto de celular hoje sai com 4 a 10MB. Mandar duas ou três num mesmo POST
 * estoura o limite de corpo da requisição da Vercel (4,5MB por chamada de
 * função, que não dá pra aumentar por configuração) e o envio morre com erro
 * de servidor, sem mensagem útil. Em celular mais simples o navegador ainda
 * pode ficar sem memória antes disso.
 *
 * Um RG a 1600px de lado maior, JPEG 0.82, sai em torno de 250KB e continua
 * perfeitamente legível. O que não dá pra converter (PDF, HEIC que o Chrome
 * não decodifica) volta como veio: melhor subir grande do que não subir.
 */

export interface OpcoesCompressao {
  /** Maior lado da imagem final, em pixels. */
  maxLado?: number
  /** Qualidade do JPEG, de 0 a 1. */
  qualidade?: number
  /** Abaixo disto não mexe: já está pequeno o bastante. */
  minBytes?: number
}

const PADRAO: Required<OpcoesCompressao> = {
  maxLado: 1600,
  qualidade: 0.82,
  minBytes: 400 * 1024,
}

function ehImagemConversivel(file: File): boolean {
  // HEIC fica de fora de propósito: o Chrome no Android não decodifica, e a
  // tentativa só custa tempo. No iPhone o próprio seletor já entrega JPEG.
  return ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)
}

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('não decodificou'))
    img.src = url
  })
}

export async function comprimirImagem(file: File, opcoes: OpcoesCompressao = {}): Promise<File> {
  const { maxLado, qualidade, minBytes } = { ...PADRAO, ...opcoes }
  if (!ehImagemConversivel(file) || file.size <= minBytes) return file

  const url = URL.createObjectURL(file)
  try {
    const img = await carregarImagem(url)
    const maior = Math.max(img.width, img.height)
    const escala = maior > maxLado ? maxLado / maior : 1
    const w = Math.round(img.width * escala)
    const h = Math.round(img.height * escala)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, w, h)

    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', qualidade))
    // Sem ganho real, fica o original — evita trocar um PNG nítido por um
    // JPEG do mesmo tamanho.
    if (!blob || blob.size >= file.size) return file

    const nome = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], nome, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    // Qualquer falha de decodificação: sobe o arquivo como veio.
    return file
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** "2,4 MB" — pra mostrar ao lado do arquivo escolhido. */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
