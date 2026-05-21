import { formatarPreco } from '@/lib/utils'

interface Props {
  preco: number
  precoAntigo?: number | null
  // Tamanho preset que define classe Tailwind do preço principal
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  // Adiciona "/mês" cinza ao lado
  perMes?: boolean
  className?: string
  // Posiciona o badge "BAIXOU": ao lado do valor ou em cima
  badgePosition?: 'inline' | 'above' | 'none'
}

const TAMANHOS: Record<NonNullable<Props['size']>, { atual: string; antigo: string }> = {
  xs: { atual: 'text-xs',                    antigo: 'text-[10px]' },
  sm: { atual: 'text-sm',                    antigo: 'text-[11px]' },
  md: { atual: 'text-base sm:text-lg',       antigo: 'text-xs sm:text-sm' },
  lg: { atual: 'text-xl sm:text-2xl',        antigo: 'text-sm' },
  xl: { atual: 'text-2xl sm:text-3xl',       antigo: 'text-sm sm:text-base' },
}

export function PrecoImovel({
  preco,
  precoAntigo,
  size = 'md',
  perMes = false,
  className = '',
  badgePosition = 'inline',
}: Props) {
  const promo = precoAntigo != null && precoAntigo > preco
  const cls = TAMANHOS[size]
  const desconto = promo ? Math.round((1 - preco / precoAntigo!) * 100) : 0

  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`}>
      {promo && badgePosition === 'above' && (
        <span className="w-full text-[10px] font-bold uppercase tracking-wider text-green-700">
          Baixou {desconto > 0 ? `${desconto}%` : ''}
        </span>
      )}

      <span className={`font-bold text-orange-500 ${cls.atual} leading-none`}>
        {formatarPreco(preco)}
        {perMes && (
          <span className="text-xs sm:text-sm font-normal text-gray-400">/mês</span>
        )}
      </span>

      {promo && (
        <>
          <span className={`text-gray-400 line-through ${cls.antigo} leading-none`}>
            {formatarPreco(precoAntigo!)}
          </span>
          {badgePosition === 'inline' && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full leading-none">
              {desconto > 0 ? `−${desconto}%` : 'Baixou'}
            </span>
          )}
        </>
      )}
    </span>
  )
}
