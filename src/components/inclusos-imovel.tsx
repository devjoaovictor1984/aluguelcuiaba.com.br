import { Package, Flame, Droplets, Zap, Check } from 'lucide-react'
import { resumirInclusos, linhaInclusos, type InclusosImovel, type TipoIncluso } from '@/lib/imoveis/inclusos'

const ICONE: Record<TipoIncluso, typeof Package> = {
  pacote: Package,
  gas: Flame,
  agua: Droplets,
  luz: Zap,
}

/**
 * Verde porque é economia: o que está incluso é dinheiro que o inquilino
 * não vai pagar por fora. Cor diferente das garantias (violeta) e da
 * exigência do incêndio (âmbar), que são outra conversa.
 */
export function InclusosChips({ imovel, className = '' }: { imovel: InclusosImovel; className?: string }) {
  const lista = resumirInclusos(imovel)
  if (lista.length === 0) return null

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {lista.map(x => {
        const Icone = ICONE[x.tipo]
        return (
          <span
            key={x.tipo}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 px-2.5 py-1 text-xs font-medium"
          >
            <Icone size={12} className="shrink-0" aria-hidden />
            {x.rotulo}
          </span>
        )
      })}
    </div>
  )
}

/** No card não cabe chip: vira uma linha só, discreta, abaixo do preço. */
export function InclusosLinha({ imovel, className = '' }: { imovel: InclusosImovel; className?: string }) {
  const texto = linhaInclusos(imovel)
  if (!texto) return null

  return (
    <p className={`flex items-center gap-1 text-[11px] font-medium text-emerald-700 ${className}`}>
      <Check size={11} className="shrink-0" aria-hidden />
      <span className="truncate">{texto}</span>
    </p>
  )
}
