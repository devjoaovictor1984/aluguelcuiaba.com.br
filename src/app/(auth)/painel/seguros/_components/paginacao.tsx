import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  pagina: number
  totalPaginas: number
  total: number
  base: string
  params?: Record<string, string | undefined>
}

/** Paginação por querystring — mantém os filtros ativos ao navegar. */
export function Paginacao({ pagina, totalPaginas, total, base, params = {} }: Props) {
  if (totalPaginas <= 1) {
    return total > 0
      ? <p className="text-[11px] text-gray-400 text-center pt-1">{total} registro{total === 1 ? '' : 's'}</p>
      : null
  }

  const href = (p: number) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
    if (p > 1) sp.set('p', String(p))
    const qs = sp.toString()
    return qs ? `${base}?${qs}` : base
  }

  const btn = 'flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50'
  const off = 'opacity-40 pointer-events-none'

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <Link href={href(pagina - 1)} className={`${btn} ${pagina <= 1 ? off : ''}`} aria-disabled={pagina <= 1}>
        <ChevronLeft size={14} /> Anterior
      </Link>
      <p className="text-xs text-gray-500">
        Página {pagina} de {totalPaginas} · {total} registro{total === 1 ? '' : 's'}
      </p>
      <Link href={href(pagina + 1)} className={`${btn} ${pagina >= totalPaginas ? off : ''}`} aria-disabled={pagina >= totalPaginas}>
        Próxima <ChevronRight size={14} />
      </Link>
    </div>
  )
}
