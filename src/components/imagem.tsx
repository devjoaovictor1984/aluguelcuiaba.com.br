// Wrapper único de next/Image pro projeto. Padroniza:
//   - strip do ?cache-buster (Supabase storage adiciona ?t=... no upload)
//   - WebP/AVIF automático
//   - sizes correto pelo aspect ratio
//   - loading lazy por default (priority opt-in)
//   - fallback se URL falhar
//
// SEMPRE use <Imagem> no lugar de <img> ou <Image> direto. O ESLint
// (@next/no-img-element) já barra <img>, e o lint custom recomenda <Imagem>.

import NextImage from 'next/image'

type Aspect = '1/1' | '4/3' | '16/9' | '16/7' | '3/2' | '21/9' | 'video'

interface Props {
  src: string | null | undefined
  alt: string
  /** Define wrapper com aspect-ratio + Image fill. Mais comum no projeto. */
  aspect?: Aspect
  /** Caso queira tamanho fixo em vez de aspect/fill. */
  width?: number
  height?: number
  /** Eager + fetchpriority high. Use no LCP (capa above-the-fold). Default: false. */
  priority?: boolean
  className?: string
  /** Classe extra no wrapper (quando usa aspect). */
  wrapperClassName?: string
  /** Override de sizes (raramente necessário — defaults cobrem o caso comum). */
  sizes?: string
  /** quality 1-100. Default do next/image: 75. */
  quality?: number
  /** style inline (transitions etc). */
  style?: React.CSSProperties
  /** Object-fit. Default: cover. */
  fit?: 'cover' | 'contain'
}

const ASPECT_CLASS: Record<Aspect, string> = {
  '1/1': 'aspect-square',
  '4/3': 'aspect-[4/3]',
  '16/9': 'aspect-video',
  '16/7': 'aspect-[16/7]',
  '3/2': 'aspect-[3/2]',
  '21/9': 'aspect-[21/9]',
  'video': 'aspect-video',
}

/** Remove cache-buster (?t=...) que quebra o image optimizer do Next. */
function limparUrl(u: string): string {
  return u.split('?')[0]
}

export function Imagem({
  src, alt, aspect, width, height, priority = false,
  className = '', wrapperClassName = '', sizes, quality, style, fit = 'cover',
}: Props) {
  if (!src) return null
  const cleanSrc = limparUrl(src)
  const objectFit = fit === 'contain' ? 'object-contain' : 'object-cover'
  const loadingProps = priority ? { priority: true as const } : { loading: 'lazy' as const }

  // Modo aspect: usa fill, precisa de wrapper relativo
  if (aspect) {
    return (
      <div className={`relative ${ASPECT_CLASS[aspect]} overflow-hidden ${wrapperClassName}`}>
        <NextImage
          src={cleanSrc}
          alt={alt}
          quality={quality}
          style={style}
          fill
          sizes={sizes ?? '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 800px'}
          className={`${objectFit} ${className}`}
          {...loadingProps}
        />
      </div>
    )
  }

  // Modo tamanho fixo: usa width/height
  if (width && height) {
    return (
      <NextImage
        src={cleanSrc}
        alt={alt}
        quality={quality}
        style={style}
        width={width}
        height={height}
        sizes={sizes}
        className={`${objectFit} ${className}`}
        {...loadingProps}
      />
    )
  }

  // Fallback: fill sem aspect (usuário precisa garantir wrapper relativo)
  return (
    <NextImage
      src={cleanSrc}
      alt={alt}
      quality={quality}
      style={style}
      fill
      sizes={sizes ?? '100vw'}
      className={`${objectFit} ${className}`}
      {...loadingProps}
    />
  )
}
