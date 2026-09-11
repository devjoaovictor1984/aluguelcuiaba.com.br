import { TrendingUp, Repeat } from 'lucide-react'
import type { MarcoContrato } from '@/lib/contratos/reajuste'

/**
 * Etiqueta do próximo marco do contrato — o 1º reajuste aos 12 meses, o 2º aos
 * 24, a renovação no fim da vigência. Aparece no último mês antes da data, e
 * fica vermelha quando passa.
 */
export function BadgeMarco({ marco, longo = false }: { marco: MarcoContrato; longo?: boolean }) {
  const atrasado = marco.dias < 0
  const cor = atrasado
    ? 'bg-red-100 text-red-700'
    : marco.tipo === 'renovacao'
      ? 'bg-orange-100 text-orange-700'
      : 'bg-amber-100 text-amber-700'

  const quando = atrasado
    ? `${-marco.dias}d atrás`
    : marco.dias === 0 ? 'hoje'
    : `em ${marco.dias}d`

  const Icone = marco.tipo === 'renovacao' ? Repeat : TrendingUp

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${cor}`}
      title={
        atrasado
          ? `${marco.rotuloLongo} venceu em ${marco.data.split('-').reverse().join('/')}`
          : `${marco.rotuloLongo} em ${marco.data.split('-').reverse().join('/')}`
      }
    >
      <Icone size={10} className="shrink-0" />
      {longo ? marco.rotuloLongo : marco.rotulo} · {quando}
      {marco.estimado && <span className="opacity-60">est.</span>}
    </span>
  )
}
