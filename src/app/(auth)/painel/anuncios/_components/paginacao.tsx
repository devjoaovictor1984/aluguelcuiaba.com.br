import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Paginação compacta: 1 … 4 5 [6] 7 8 … 20. Server component. */
export function Paginacao({ pagina, totalPaginas, hrefDaPagina }: {
  pagina: number; totalPaginas: number; hrefDaPagina: (p: number) => string
}) {
  if (totalPaginas <= 1) return null

  const nums = new Set<number>([1, totalPaginas])
  for (let p = pagina - 2; p <= pagina + 2; p++) if (p >= 1 && p <= totalPaginas) nums.add(p)
  const ordenados = [...nums].sort((a, b) => a - b)

  const base = 'min-w-9 h-9 px-2 flex items-center justify-center rounded-lg text-sm font-medium transition-colors'
  return (
    <nav className="flex items-center justify-center gap-1 mt-5 flex-wrap" aria-label="Paginação">
      {pagina > 1
        ? <Link href={hrefDaPagina(pagina - 1)} className={`${base} text-gray-600 hover:bg-gray-100`} aria-label="Página anterior"><ChevronLeft size={16} /></Link>
        : <span className={`${base} text-gray-300`}><ChevronLeft size={16} /></span>}
      {ordenados.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - ordenados[i - 1] > 1 && <span className="text-gray-300 px-1">…</span>}
          <Link
            href={hrefDaPagina(p)}
            aria-current={p === pagina ? 'page' : undefined}
            className={`${base} ${p === pagina ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {p}
          </Link>
        </span>
      ))}
      {pagina < totalPaginas
        ? <Link href={hrefDaPagina(pagina + 1)} className={`${base} text-gray-600 hover:bg-gray-100`} aria-label="Próxima página"><ChevronRight size={16} /></Link>
        : <span className={`${base} text-gray-300`}><ChevronRight size={16} /></span>}
    </nav>
  )
}
