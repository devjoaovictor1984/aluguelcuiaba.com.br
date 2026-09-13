'use client'

import { ShieldCheck, Coins, UserCheck, Flame } from 'lucide-react'
import { TETO_FIANCA_SOBRE_ALUGUEL, tetoFianca } from '@/lib/imoveis/garantias'

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 text-sm transition"

export interface GarantiasForm {
  fianca: boolean
  /** Valor mensal aproximado, em texto (o que o usuário digita). */
  fiancaValor: string
  caucao: boolean
  caucaoMeses: '1' | '2' | '3'
  fiador: boolean
  incendioObrigatorio: boolean
  /** Valor ANUAL aproximado, em texto (o que o usuário digita). */
  incendioValor: string
}

export const GARANTIAS_VAZIO: GarantiasForm = {
  fianca: false,
  fiancaValor: '',
  caucao: false,
  caucaoMeses: '1',
  fiador: false,
  incendioObrigatorio: false,
  incendioValor: '',
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const emNumero = (v: string) =>
  Number(String(v).replace(/\./g, '').replace(',', '.')) || 0

/** O que o usuário digitou no valor do seguro fiança, em número. */
export function valorFianca(g: GarantiasForm): number {
  return emNumero(g.fiancaValor)
}

/** Valor anual do seguro incêndio, em número. */
export function valorIncendio(g: GarantiasForm): number {
  return emNumero(g.incendioValor)
}

/**
 * Mensagem de erro das garantias, ou null quando está tudo certo.
 *
 * Fica aqui, e não dentro do componente, porque quem barra o submit é o
 * formulário — e os dois têm que concordar sobre o que é válido.
 */
export function validarGarantias(g: GarantiasForm, aluguel: number): string | null {
  if (g.fianca && aluguel > 0 && valorFianca(g) > tetoFianca(aluguel)) {
    return `O seguro fiança passa de ${Math.round(TETO_FIANCA_SOBRE_ALUGUEL * 100)}% do aluguel `
      + `(máximo ${brl(tetoFianca(aluguel))} por mês). Confira o valor.`
  }
  return null
}

/** O que vai pro banco. Campo dependente zera quando a garantia é desmarcada. */
export function garantiasParaDb(g: GarantiasForm) {
  return {
    garantia_fianca: g.fianca,
    garantia_fianca_valor: g.fianca ? (valorFianca(g) || null) : null,
    garantia_caucao: g.caucao,
    garantia_caucao_meses: g.caucao ? Number(g.caucaoMeses) : null,
    garantia_fiador: g.fiador,
    seguro_incendio_obrigatorio: g.incendioObrigatorio,
    seguro_incendio_valor: g.incendioObrigatorio ? (valorIncendio(g) || null) : null,
  }
}

/** O caminho de volta, pra edição. */
export function garantiasDoDb(row: Record<string, unknown> | null | undefined): GarantiasForm {
  if (!row) return GARANTIAS_VAZIO
  const valor = Number(row.garantia_fianca_valor) || 0
  const meses = String(Number(row.garantia_caucao_meses) || 1)
  return {
    fianca: !!row.garantia_fianca,
    fiancaValor: valor > 0 ? valor.toFixed(2).replace('.', ',') : '',
    caucao: !!row.garantia_caucao,
    caucaoMeses: (['1', '2', '3'].includes(meses) ? meses : '1') as '1' | '2' | '3',
    fiador: !!row.garantia_fiador,
    incendioObrigatorio: !!row.seguro_incendio_obrigatorio,
    incendioValor: (Number(row.seguro_incendio_valor) || 0) > 0
      ? Number(row.seguro_incendio_valor).toFixed(2).replace('.', ',')
      : '',
  }
}

interface Props {
  value: GarantiasForm
  onChange: (v: GarantiasForm) => void
  /** Aluguel em reais, pra calcular o teto do seguro fiança. */
  aluguel: number
}

/**
 * Garantias aceitas — o que o inquilino precisa apresentar pra alugar.
 *
 * É a primeira pergunta de quem procura, e por isso virou informação do
 * anúncio: aparece no card e na página do imóvel, não só no contrato.
 */
export function GarantiasSection({ value, onChange, aluguel }: Props) {
  const set = <K extends keyof GarantiasForm>(campo: K, v: GarantiasForm[K]) =>
    onChange({ ...value, [campo]: v })

  const teto = aluguel > 0 ? tetoFianca(aluguel) : 0
  const erro = validarGarantias(value, aluguel)

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-violet-600 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Garantias aceitas</h2>
          <p className="text-xs text-gray-500">
            Aparece no anúncio. É a primeira pergunta de quem procura.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {/* Seguro fiança */}
        <div className="rounded-xl border border-gray-100 p-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={value.fianca}
              onChange={e => set('fianca', e.target.checked)}
              className="w-4 h-4 shrink-0 accent-violet-600"
            />
            <ShieldCheck size={14} className="text-violet-600 shrink-0" />
            <span className="text-sm text-gray-800">Seguro fiança</span>
          </label>

          {value.fianca && (
            <div className="mt-2.5 pl-7">
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Valor aproximado por mês
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={value.fiancaValor}
                onChange={e => set('fiancaValor', e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder={teto > 0 ? `até ${brl(teto)}` : '0,00'}
                className={inputCls}
              />
              <p className="text-[11px] text-gray-400 mt-1">
                {teto > 0
                  ? `Até ${Math.round(TETO_FIANCA_SOBRE_ALUGUEL * 100)}% do aluguel, ou seja ${brl(teto)}. `
                  : `Até ${Math.round(TETO_FIANCA_SOBRE_ALUGUEL * 100)}% do aluguel. `}
                É estimativa: a cotação real depende da análise do inquilino, e o
                anúncio mostra o valor como aproximado.
              </p>
            </div>
          )}
        </div>

        {/* Caução */}
        <div className="rounded-xl border border-gray-100 p-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={value.caucao}
              onChange={e => set('caucao', e.target.checked)}
              className="w-4 h-4 shrink-0 accent-violet-600"
            />
            <Coins size={14} className="text-violet-600 shrink-0" />
            <span className="text-sm text-gray-800">Caução</span>
          </label>

          {value.caucao && (
            <div className="mt-2.5 pl-7">
              <label className="text-xs font-medium text-gray-600 block mb-1">Quantos aluguéis</label>
              <div className="flex gap-2">
                {(['1', '2', '3'] as const).map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set('caucaoMeses', n)}
                    className={`flex-1 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                      value.caucaoMeses === n
                        ? 'border-violet-600 bg-violet-50 text-violet-700'
                        : 'border-gray-100 text-gray-600 hover:border-violet-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                A lei permite até 3 aluguéis de caução.
              </p>
            </div>
          )}
        </div>

        {/* Fiador */}
        <div className="rounded-xl border border-gray-100 p-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={value.fiador}
              onChange={e => set('fiador', e.target.checked)}
              className="w-4 h-4 shrink-0 accent-violet-600"
            />
            <UserCheck size={14} className="text-violet-600 shrink-0" />
            <span className="text-sm text-gray-800">Fiador</span>
          </label>
        </div>

        {/* Seguro incêndio — exigência, não escolha */}
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={value.incendioObrigatorio}
              onChange={e => set('incendioObrigatorio', e.target.checked)}
              className="w-4 h-4 shrink-0 accent-amber-600"
            />
            <Flame size={14} className="text-amber-600 shrink-0" />
            <span className="text-sm text-gray-800">Seguro incêndio obrigatório</span>
          </label>
          {value.incendioObrigatorio && (
            <div className="mt-2.5 pl-7">
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Valor aproximado por ano
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={value.incendioValor}
                onChange={e => set('incendioValor', e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="0,00"
                className={inputCls}
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Por ano, que é como a apólice de incêndio é vendida. É
                estimativa: o prêmio real depende do valor do imóvel e das
                coberturas escolhidas.
              </p>
            </div>
          )}

          <p className="text-[11px] text-gray-500 mt-1.5 pl-7">
            Exigência da locação, cobrada à parte do aluguel. Não é garantia:
            entra no anúncio pra ninguém ser pego de surpresa.
          </p>
        </div>
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </section>
  )
}
