import { ShieldCheck, Coins, UserCheck, Flame } from 'lucide-react'
import { resumirGarantias, type GarantiasImovel, type TipoGarantia } from '@/lib/imoveis/garantias'

const ICONE: Record<TipoGarantia, typeof ShieldCheck> = {
  fianca: ShieldCheck,
  caucao: Coins,
  fiador: UserCheck,
  incendio: Flame,
}

/**
 * O incêndio é o único que não é escolha do inquilino: é exigência. Sai em
 * âmbar pra não se misturar com as opções de garantia, que são boas notícias.
 */
const COR: Record<TipoGarantia, string> = {
  fianca: 'text-violet-600',
  caucao: 'text-violet-600',
  fiador: 'text-violet-600',
  incendio: 'text-amber-600',
}

const COR_CHIP: Record<TipoGarantia, string> = {
  fianca: 'bg-violet-50 text-violet-700 ring-violet-100',
  caucao: 'bg-violet-50 text-violet-700 ring-violet-100',
  fiador: 'bg-violet-50 text-violet-700 ring-violet-100',
  incendio: 'bg-amber-50 text-amber-800 ring-amber-100',
}

/**
 * No card só cabe ícone — o texto brigaria com preço, título e bairro na
 * mesma caixa. O `title` carrega a explicação pra quem passa o mouse, e o
 * `sr-only` pra quem usa leitor de tela.
 */
export function GarantiasIcones({ imovel, className = '' }: { imovel: GarantiasImovel; className?: string }) {
  const lista = resumirGarantias(imovel)
  if (lista.length === 0) return null

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {lista.map(g => {
        const Icone = ICONE[g.tipo]
        return (
          <span key={g.tipo} title={g.descricao} className={COR[g.tipo]}>
            <Icone size={13} aria-hidden />
            <span className="sr-only">{g.descricao}</span>
          </span>
        )
      })}
    </div>
  )
}

/** Na página do imóvel cabe o nome e o valor, que é o que decide a visita. */
export function GarantiasChips({ imovel, className = '' }: { imovel: GarantiasImovel; className?: string }) {
  const lista = resumirGarantias(imovel)
  if (lista.length === 0) return null

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {lista.map(g => {
        const Icone = ICONE[g.tipo]
        return (
          <span
            key={g.tipo}
            title={g.descricao}
            className={`inline-flex items-center gap-1 rounded-full ring-1 px-2.5 py-1 text-xs font-medium ${COR_CHIP[g.tipo]}`}
          >
            <Icone size={12} className="shrink-0" aria-hidden />
            {g.rotulo}
            {g.detalhe && <span className="font-normal opacity-80">· {g.detalhe}</span>}
          </span>
        )
      })}
    </div>
  )
}
