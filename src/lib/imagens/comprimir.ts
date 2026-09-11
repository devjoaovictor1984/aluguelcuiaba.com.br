/**
 * Reduz imagem no navegador, antes de subir.
 *
 * Foto de celular hoje sai com 4 a 12MB. Isso quebra o upload de três
 * maneiras: o limite de corpo de requisição da Vercel é de 4,5MB por chamada
 * de função (não é configurável, e o `bodySizeLimit` do Next não manda nele),
 * o aparelho mais simples fica sem memória antes disso, e o que passa custa
 * armazenamento e faz a página do corretor arrastar depois.
 *
 * A conta é sempre a mesma: documento e foto de vistoria precisam ser
 * LEGÍVEIS, não precisam ser grandes. 1600px no lado maior é mais resolução
 * do que qualquer tela vai mostrar e continua dando pra ler um RG na lupa.
 *
 * Sem biblioteca: canvas resolve, e uma dependência de compressão custaria
 * mais no bundle do celular do que economiza no upload.
 */

export interface OpcoesCompressao {
  /** Maior lado da imagem final, em pixels. */
  maxLado?: number
  /** Onde a qualidade começa. Cai sozinha se o arquivo ainda ficar grande. */
  qualidade?: number
  /** Alvo de tamanho. Não é garantia: a qualidade só cai até `qualidadeMin`. */
  alvoBytes?: number
  /** Piso da qualidade. Abaixo disso texto de documento começa a borrar. */
  qualidadeMin?: number
  /** Abaixo disto nem tenta: já está pequeno o bastante. */
  minBytes?: number
}

const PADRAO: Required<OpcoesCompressao> = {
  maxLado: 1600,
  qualidade: 0.82,
  alvoBytes: 900 * 1024,
  qualidadeMin: 0.55,
  minBytes: 300 * 1024,
}

/** Perfis prontos, pra não espalhar números mágicos pelas telas. */
export const PERFIL_DOCUMENTO: OpcoesCompressao = { maxLado: 1600, alvoBytes: 900 * 1024 }
export const PERFIL_FOTO_VISTORIA: OpcoesCompressao = { maxLado: 1400, alvoBytes: 700 * 1024 }
/** Foto de anúncio: mantém os 1200px que o portal já usava desde sempre. */
export const PERFIL_FOTO_ANUNCIO: OpcoesCompressao = { maxLado: 1200, alvoBytes: 600 * 1024 }

/** PDF, DOCX e afins passam direto: canvas não sabe o que fazer com eles. */
export function ehImagem(file: File): boolean {
  // SVG é vetor (redimensionar não economiza nada e destrói a nitidez) e ICO
  // o canvas nem sempre decodifica. Os dois passam direto.
  if (file.type === 'image/svg+xml' || file.type === 'image/x-icon' || file.type === 'image/vnd.microsoft.icon') {
    return false
  }
  return file.type.startsWith('image/')
}

/**
 * Decodifica em duas tentativas. `createImageBitmap` aceita tudo que o
 * navegador decodifica, HEIC no Safari do iPhone incluído; o `<img>` cobre
 * navegador antigo que não tem a função.
 */
async function decodificar(file: File): Promise<{ largura: number; altura: number; fonte: CanvasImageSource; liberar: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        largura: bitmap.width,
        altura: bitmap.height,
        fonte: bitmap,
        liberar: () => bitmap.close(),
      }
    } catch {
      // Formato que o createImageBitmap recusa: tenta pelo <img>.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('não decodificou'))
      el.src = url
    })
    return {
      largura: img.naturalWidth || img.width,
      altura: img.naturalHeight || img.height,
      fonte: img,
      liberar: () => URL.revokeObjectURL(url),
    }
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade?: number): Promise<Blob | null> {
  return new Promise(r => canvas.toBlob(r, tipo, qualidade))
}

/**
 * JPEG não tem canal alfa: transparência vira preto. Assinatura e logo são
 * justamente PNG recortado, então antes de converter é preciso olhar.
 *
 * Amostra de 1 em cada 16 pixels — o suficiente pra achar um fundo
 * transparente, que nunca é um pixel isolado, sem varrer a imagem inteira.
 */
function temTransparencia(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, w, h)
    for (let i = 3; i < data.length; i += 4 * 16) {
      if (data[i] < 250) return true
    }
    return false
  } catch {
    // Canvas "sujo" por imagem de outra origem: assume que tem, e preserva.
    return true
  }
}

/**
 * Devolve o arquivo reduzido, ou o próprio arquivo quando não dá pra reduzir
 * (PDF, formato que não decodifica, imagem que já está pequena, ou resultado
 * que ficaria maior que o original). Nunca lança: subir grande é melhor do
 * que não subir.
 */
export async function comprimirImagem(file: File, opcoes: OpcoesCompressao = {}): Promise<File> {
  const { maxLado, qualidade, alvoBytes, qualidadeMin, minBytes } = { ...PADRAO, ...opcoes }
  if (!ehImagem(file) || file.size <= minBytes) return file

  let img: Awaited<ReturnType<typeof decodificar>> | null = null
  try {
    img = await decodificar(file)
    const maior = Math.max(img.largura, img.altura)
    const escala = maior > maxLado ? maxLado / maior : 1
    const w = Math.max(1, Math.round(img.largura * escala))
    const h = Math.max(1, Math.round(img.altura * escala))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img.fonte, 0, 0, w, h)

    // Imagem com fundo transparente continua PNG, só menor. Virar JPEG
    // colocaria fundo preto atrás de assinatura e logo.
    const preservar = (file.type === 'image/png' || file.type === 'image/webp')
      && temTransparencia(ctx, w, h)

    if (preservar) {
      const png = await paraBlob(canvas, 'image/png')
      if (!png || png.size >= file.size) return file
      return new File([png], file.name, { type: 'image/png', lastModified: Date.now() })
    }

    // Primeiro tenta na qualidade cheia. Se o arquivo ainda passar do alvo,
    // baixa de 0,1 em 0,1 até o piso. Documento escaneado com muito texto é
    // o caso que precisa disso: ele comprime pior que foto.
    let blob = await paraBlob(canvas, 'image/jpeg', qualidade)
    let q = qualidade
    while (blob && blob.size > alvoBytes && q > qualidadeMin) {
      q = Math.max(qualidadeMin, Math.round((q - 0.1) * 100) / 100)
      blob = await paraBlob(canvas, 'image/jpeg', q)
    }

    if (!blob || blob.size >= file.size) return file

    const nome = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], nome, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  } finally {
    img?.liberar()
  }
}

/** "2,4 MB" — pra mostrar ao lado do arquivo escolhido. */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
