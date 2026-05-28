'use client'

import { Check, AlertCircle } from 'lucide-react'
import { SECOES_ESSENCIAIS } from '@/lib/contratos/secoes-essenciais'

interface Props {
  categoriasIncluidas: string[]
  totalClausulas: number
  status: string
}

export function ProgressoContrato({ categoriasIncluidas, totalClausulas, status }: Props) {
  const secoes = SECOES_ESSENCIAIS.map(s => ({
    label: s.label,
    ok: categoriasIncluidas.some(c => s.categorias.includes(c)),
  }))

  const completas = secoes.filter(s => s.ok).length
  const totalMin = secoes.length
  const percentual = Math.round((completas / totalMin) * 100)
  const faltam = secoes.filter(s => !s.ok)

  const statusLabel =
    status === 'rascunho'  ? 'Rascunho' :
    status === 'gerado'    ? 'Gerado' :
    status === 'assinado'  ? 'Assinado' : status

  const statusCor =
    status === 'rascunho'  ? 'bg-amber-100 text-amber-700' :
    status === 'gerado'    ? 'bg-violet-100 text-violet-700' :
    status === 'assinado'  ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-900">Progresso do contrato</h2>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusCor}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">
            <strong className="text-gray-900 text-base">{completas}</strong>
            <span className="mx-1">/</span>
            <span className="text-gray-400">{totalMin} seções essenciais</span>
          </span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500"><strong>{totalClausulas}</strong> cláusulas</span>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            percentual === 100 ? 'bg-emerald-500' : percentual >= 60 ? 'bg-violet-600' : 'bg-amber-500'
          }`}
          style={{ width: `${percentual}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-900 mix-blend-difference">
          {percentual}%
        </span>
      </div>

      {/* Chips das seções */}
      <div className="flex flex-wrap gap-1.5">
        {secoes.map((s, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full border ${
              s.ok
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}
          >
            {s.ok ? <Check size={10} /> : <span className="w-2 h-2 rounded-full border border-current" />}
            {s.label}
          </span>
        ))}
      </div>

      {faltam.length > 0 && faltam.length <= 5 && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-start gap-2 text-[11px] text-amber-700">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <p>
            Falta(m) <strong>{faltam.length}</strong> seção(ões) essencial(is):{' '}
            {faltam.map(s => s.label).join(', ')}.
          </p>
        </div>
      )}

      {percentual === 100 && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-[11px] text-emerald-700">
          <Check size={12} />
          <p>Todas as seções essenciais estão presentes. Bom pra revisar e gerar.</p>
        </div>
      )}
    </div>
  )
}
