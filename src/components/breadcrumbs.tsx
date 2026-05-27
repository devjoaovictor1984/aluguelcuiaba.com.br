import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string  // sem href = item atual (não clicável)
}

interface Props {
  items: BreadcrumbItem[]
  /** Se true, mostra ícone de casa antes do primeiro item. Default: true. */
  comHome?: boolean
  /** Path da home. Default: "/painel". */
  homeHref?: string
}

/**
 * Migalhas de pão pra navegação. Use no topo de páginas internas.
 *
 * Exemplo:
 * ```tsx
 * <Breadcrumbs items={[
 *   { label: 'Contratos', href: '/painel/contratos' },
 *   { label: 'Cláusulas' }
 * ]} />
 * ```
 */
export function Breadcrumbs({ items, comHome = true, homeHref = '/painel' }: Props) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-gray-500 mb-4 flex-wrap">
      {comHome && (
        <>
          <Link href={homeHref} className="flex items-center gap-1 hover:text-violet-700 transition-colors">
            <Home size={12} />
            <span className="hidden sm:inline">Painel</span>
          </Link>
          {items.length > 0 && <ChevronRight size={11} className="text-gray-300" />}
        </>
      )}
      {items.map((item, idx) => {
        const ultimo = idx === items.length - 1
        return (
          <span key={idx} className="flex items-center gap-1">
            {item.href && !ultimo ? (
              <Link href={item.href} className="hover:text-violet-700 transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={ultimo ? 'font-semibold text-gray-900' : ''}>
                {item.label}
              </span>
            )}
            {!ultimo && <ChevronRight size={11} className="text-gray-300" />}
          </span>
        )
      })}
    </nav>
  )
}
