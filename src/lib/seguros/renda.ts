/**
 * Comprometimento de renda na locação.
 *
 * O painel da corretora mostra ao pretendente "Renda mensal necessária
 * para essa locação: R$ 5.142,86" logo abaixo dos valores. Conferindo o
 * exemplo — R$ 1.800,00 de gastos → R$ 5.142,86 — o divisor é 0,35: a
 * regra de mercado de que aluguel mais encargos não devem passar de 35%
 * da renda.
 *
 * Vale mostrar pelo mesmo motivo que eles mostram: o pretendente descobre
 * na hora se qualifica, e entende por que incluir um locatário solidário
 * — a renda considerada é a soma de todos.
 *
 * É orientação, não regra da seguradora: quem decide o limite é a análise.
 */

/** Teto de comprometimento aceito no mercado de locação. */
export const COMPROMETIMENTO_MAXIMO = 0.35

export interface GastosMensais {
  aluguel: number
  condominio?: number
  iptu?: number
  agua?: number
  energia?: number
  gas?: number
}

export function totalGastos(g: GastosMensais): number {
  return (g.aluguel || 0) + (g.condominio || 0) + (g.iptu || 0)
    + (g.agua || 0) + (g.energia || 0) + (g.gas || 0)
}

/** Renda somada (pretendente + solidários) necessária para a locação. */
export function rendaNecessaria(g: GastosMensais): number {
  const total = totalGastos(g)
  if (total <= 0) return 0
  return Math.round((total / COMPROMETIMENTO_MAXIMO) * 100) / 100
}
