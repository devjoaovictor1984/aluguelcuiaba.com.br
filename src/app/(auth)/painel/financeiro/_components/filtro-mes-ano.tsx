'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { ChevronLeft, ChevronRight, Calendar, CalendarDays, Infinity as InfinityIcon } from 'lucide-react'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export type ModoPeriodo = 'mensal' | 'anual' | 'tudo'

interface Props {
  modo: ModoPeriodo
  mes: number   // 1..12
  ano: number
  ehAtual: boolean
}

export function FiltroMesAno({ modo, mes, ano, ehAtual }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const hoje = new Date()
  const anos = Array.from({ length: 11 }, (_, i) => hoje.getFullYear() - 5 + i)

  const setParams = (novos: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(novos)) {
      if (v === null) params.delete(k)
      else params.set(k, v)
    }
    const qs = params.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname))
  }

  const trocarModo = (novo: ModoPeriodo) => {
    if (novo === 'tudo') {
      setParams({ modo: 'tudo', mes: null, ano: null })
    } else if (novo === 'anual') {
      setParams({ modo: 'anual', mes: null, ano: String(ano) })
    } else {
      setParams({ modo: null, mes: String(mes), ano: String(ano) })
    }
  }

  const anterior = () => {
    if (modo === 'anual') setParams({ ano: String(ano - 1) })
    else if (modo === 'mensal') {
      if (mes === 1) setParams({ mes: '12', ano: String(ano - 1) })
      else setParams({ mes: String(mes - 1), ano: String(ano) })
    }
  }

  const proximo = () => {
    if (modo === 'anual') setParams({ ano: String(ano + 1) })
    else if (modo === 'mensal') {
      if (mes === 12) setParams({ mes: '1', ano: String(ano + 1) })
      else setParams({ mes: String(mes + 1), ano: String(ano) })
    }
  }

  const irHoje = () => setParams({ modo: null, mes: null, ano: null })

  return (
    <div className={`flex flex-col items-end gap-2 ${isPending ? 'opacity-60' : ''}`}>
      {/* Toggle de modo */}
      <div className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5">
        <ModoBotao ativo={modo === 'mensal'} icone={<Calendar size={12} />} label="Mensal" onClick={() => trocarModo('mensal')} />
        <ModoBotao ativo={modo === 'anual'} icone={<CalendarDays size={12} />} label="Anual" onClick={() => trocarModo('anual')} />
        <ModoBotao ativo={modo === 'tudo'} icone={<InfinityIcon size={12} />} label="Tudo" onClick={() => trocarModo('tudo')} />
      </div>

      {modo !== 'tudo' && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={anterior}
            title={modo === 'anual' ? 'Ano anterior' : 'Mês anterior'}
            className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft size={16} />
          </button>

          {modo === 'mensal' && (
            <select
              value={mes}
              onChange={e => setParams({ mes: e.target.value, ano: String(ano) })}
              className="px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-medium text-gray-700 bg-white"
            >
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          )}

          <select
            value={ano}
            onChange={e => setParams({ ano: e.target.value })}
            className="px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-medium text-gray-700 bg-white"
          >
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <button
            type="button"
            onClick={proximo}
            title={modo === 'anual' ? 'Próximo ano' : 'Próximo mês'}
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
      )}
    </div>
  )
}

function ModoBotao({
  ativo, icone, label, onClick,
}: { ativo: boolean; icone: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        ativo ? 'bg-violet-700 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {icone} {label}
    </button>
  )
}
