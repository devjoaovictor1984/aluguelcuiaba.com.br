import type { OpcaoPagamento, PlanosPreco } from './tipos'

/**
 * Reduz o retorno de preços ao que cabe num card.
 *
 * A API devolve 3 planos × até 5 formas de pagamento — 15 números. No
 * card cabem dois: a melhor parcela e o valor à vista. O resto fica na
 * tela de contratação.
 */

export interface ResumoPrecos {
  plano: string
  parcelado: OpcaoPagamento | null
  aVista: OpcaoPagamento | null
}

const ROTULO_PLANO: Record<string, string> = {
  basico: 'Básico',
  completo: 'Completo',
  tradicional: 'Tradicional',
}

/** Cartão fica de fora: não oferecemos esse pagamento (PCI-DSS). */
const ehCartao = (o: OpcaoPagamento) => /cart[aã]o/i.test(o.formaPagamento)

/**
 * Escolhe o plano com mais opções de pagamento — é o que a corretora
 * costuma ter completo. Empate fica com o primeiro, na ordem em que a API
 * devolveu.
 */
export function resumirPrecos(planos: PlanosPreco | null | undefined): ResumoPrecos | null {
  if (!planos) return null

  const candidatos = (['tradicional', 'completo', 'basico'] as const)
    .map(chave => ({ chave, opcoes: (planos[chave] ?? []).filter(o => !ehCartao(o)) }))
    .filter(p => p.opcoes.length > 0)

  if (!candidatos.length) return null

  const melhor = candidatos.reduce((a, b) => (b.opcoes.length > a.opcoes.length ? b : a))

  // À vista = parcela única. Parcelado = o maior número de parcelas, que é
  // o que interessa ao inquilino (menor desembolso mensal).
  const aVista = melhor.opcoes.filter(o => o.qtdParcelas === 1)
    .sort((a, b) => a.valorParcela - b.valorParcela)[0] ?? null
  const parcelado = melhor.opcoes.filter(o => o.qtdParcelas > 1)
    .sort((a, b) => b.qtdParcelas - a.qtdParcelas)[0] ?? null

  return {
    plano: ROTULO_PLANO[melhor.chave] ?? melhor.chave,
    parcelado,
    aVista,
  }
}
