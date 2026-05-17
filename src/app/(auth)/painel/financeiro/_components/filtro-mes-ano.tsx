'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface Props {
  mes: number   // 1..12
  ano: number
  ehAtual: boolean
}

export function FiltroMesAno({ mes, ano, ehAtual }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Janela de anos: 5 anos atrás até 5 anos à frente
  const hoje = new Date()
  const anos = Array.from({ length: 11 }, (_, i) => hoje.getFullYear() - 5 + i)

  const ir = (novoMes: number, novoAno: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('mes', String(novoMes))
    params.set('ano', String(novoAno))
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const irHoje = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('mes')
    params.delete('ano')
    const qs = params.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname))
  }

  const anterior = () => {
    if (mes === 1) ir(12, ano - 1)
    else ir(mes - 1, ano)
  }

  const proximo = () => {
    if (mes === 12) ir(1, ano + 1)
    else ir(mes + 1, ano)
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${isPending ? 'opacity-60' : ''}`}>
      <button
        type="button"
        onClick={anterior}
        title="Mês anterior"
        className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft size={16} />
      </button>

      <select
        value={mes}
        onChange={e => ir(parseInt(e.target.value), ano)}
        className="px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-medium text-gray-700 bg-white"
      >
        {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>

      <select
        value={ano}
        onChange={e => ir(mes, parseInt(e.target.value))}
        className="px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-medium text-gray-700 bg-white"
      >
        {anos.map(a => <option key={a} value={a}>{a}</option>)}
      </select>

      <button
        type="button"
        onClick={proximo}
        title="Próximo mês"
        className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-700"
      >
        <ChevronRight size={16} />
      </button>

      {!ehAtual && (
        <button
          type="button"
          onClick={irHoje}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 text-sm font-medium text-violet-700"
        >
          <Calendar size={13} /> Hoje
        </button>
      )}
    </div>
  )
}
