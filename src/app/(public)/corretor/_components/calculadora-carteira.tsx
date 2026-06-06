'use client'

// Calculadora de simulação: nº de imóveis administrados × aluguel médio × taxa.
// NÃO promete resultado — deixa explícito que é simulação.
import { useState } from 'react'
import { TrendingUp } from 'lucide-react'

const PRESETS = [
  { label: 'Começando', imoveis: 5, aluguel: 1800 },
  { label: 'Em crescimento', imoveis: 10, aluguel: 2000 },
  { label: 'Carteira firme', imoveis: 20, aluguel: 2500 },
]

const TAXA = 0.1 // 10%

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function CalculadoraCarteira() {
  const [imoveis, setImoveis] = useState(10)
  const [aluguel, setAluguel] = useState(2000)

  const mensal = imoveis * aluguel * TAXA
  const anual = mensal * 12

  const presetAtivo = PRESETS.findIndex(p => p.imoveis === imoveis && p.aluguel === aluguel)

  return (
    <div className="bg-white rounded-3xl border border-violet-100 shadow-xl shadow-violet-900/5 overflow-hidden">
      <div className="grid lg:grid-cols-5">
        {/* Controles */}
        <div className="lg:col-span-3 p-6 sm:p-8 space-y-6">
          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                type="button"
                onClick={() => { setImoveis(p.imoveis); setAluguel(p.aluguel) }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  presetAtivo === i
                    ? 'bg-violet-700 border-violet-700 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Slider imóveis */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label htmlFor="calc-imoveis" className="text-sm font-medium text-gray-600">Imóveis administrados</label>
              <span className="text-lg font-extrabold text-violet-700">{imoveis}</span>
            </div>
            <input
              id="calc-imoveis"
              type="range" min={1} max={40} step={1}
              value={imoveis}
              onChange={e => setImoveis(Number(e.target.value))}
              className="w-full accent-violet-700 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>1</span><span>40</span></div>
          </div>

          {/* Slider aluguel médio */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label htmlFor="calc-aluguel" className="text-sm font-medium text-gray-600">Aluguel médio</label>
              <span className="text-lg font-extrabold text-violet-700">{brl(aluguel)}</span>
            </div>
            <input
              id="calc-aluguel"
              type="range" min={800} max={6000} step={100}
              value={aluguel}
              onChange={e => setAluguel(Number(e.target.value))}
              className="w-full accent-violet-700 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>R$ 800</span><span>R$ 6.000</span></div>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Simulação com taxa de administração de <strong className="text-gray-600">10%</strong>. Os valores dependem dos contratos firmados com cada proprietário, do valor dos aluguéis e da carteira de cada corretor.
          </p>
        </div>

        {/* Resultado */}
        <div className="lg:col-span-2 bg-gradient-to-br from-violet-700 to-indigo-800 text-white p-6 sm:p-8 flex flex-col justify-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/15 text-amber-200 px-2.5 py-1 rounded-full w-fit mb-4">
            <TrendingUp size={12} /> Receita recorrente estimada
          </div>
          <p className="text-[11px] uppercase tracking-wider text-violet-200 font-semibold">Por mês</p>
          <p className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3 tabular-nums">{brl(mensal)}</p>
          <div className="h-px bg-white/15 my-2" />
          <p className="text-[11px] uppercase tracking-wider text-violet-200 font-semibold mt-1">Em 12 meses</p>
          <p className="text-2xl font-bold text-amber-300 tabular-nums">{brl(anual)}</p>
          <p className="text-[11px] text-violet-200 mt-4 leading-relaxed">
            Conforme taxa de administração firmada em contrato com o proprietário.
          </p>
        </div>
      </div>
    </div>
  )
}
