import type { TipoCobertura, ValoresCobertura } from './tipos'

/**
 * Sugestão de limites e estimativa de pró-labore.
 *
 * O painel da corretora tem um botão "Sugerir valores" que deriva as
 * coberturas do aluguel. Fazemos o mesmo, mas sem botão: já vem
 * preenchido, e o corretor ajusta se quiser. Um campo em branco que
 * precisa de um clique pra ser útil é um campo mal desenhado.
 *
 * As proporções abaixo são convenção de mercado, não regra da seguradora
 * — servem de ponto de partida. O prêmio real sai do cálculo.
 */

/**
 * Valor do imóvel estimado a partir do aluguel.
 *
 * Regra prática do mercado: aluguel residencial gira em torno de 0,5% do
 * valor do imóvel ao mês, ou seja ~200 aluguéis. Para incêndio interessa
 * o custo de RECONSTRUÇÃO, não o valor de mercado (que embute o terreno),
 * daí o fator menor.
 */
const FATOR_RECONSTRUCAO = 80

export function sugerirValores(aluguel: number, cobertura: TipoCobertura): ValoresCobertura {
  if (!(aluguel > 0)) return {}

  const predio = Math.round((aluguel * FATOR_RECONSTRUCAO) / 1000) * 1000

  // O tipo de cobertura define como o capital se divide entre prédio e
  // conteúdo. Ver tabela TIPO DE COBERTURA da documentação.
  const conteudo =
    cobertura === 4 ? Math.round(predio * 0.10) :
    cobertura === 5 ? Math.round(predio * 0.15) :
    cobertura === 2 ? Math.round(predio * 0.20) : 0

  return {
    incendio: predio,
    // Perda de aluguel: 6 meses é o padrão de contrato de locação.
    perdaAluguel: Math.round(aluguel * 6),
    vendaval: Math.round(predio * 0.30),
    danosEletricos: Math.round(predio * 0.05),
    vazamento: Math.round(predio * 0.05),
    respCivil: Math.round(predio * 0.10),
    ...(conteudo > 0 ? { conteudo } : {}),
  }
}

/** A parcela mínima aceita pela seguradora — aparece no painel deles. */
export const PARCELA_MINIMA = 60

/**
 * Quantas parcelas cabem sem furar o mínimo, respeitando o teto de 6 da
 * API. Evita o corretor escolher 6× e a seguradora recusar.
 */
export function parcelasPossiveis(premio: number): number {
  if (!(premio > 0)) return 1
  return Math.max(1, Math.min(6, Math.floor(premio / PARCELA_MINIMA)))
}

/**
 * Percentual de pró-labore padrão sobre o prêmio.
 *
 * Lido do painel da corretora, onde a coluna "Pró-labore %/R$" mostra 20%
 * nas apólices de incêndio. É ESTIMATIVA: a API não devolve esse valor, e
 * a tela sempre rotula como tal.
 */
export const PRO_LABORE_PADRAO = 0.20

export function estimarProLabore(premio: number, percentual = PRO_LABORE_PADRAO): number {
  if (!(premio > 0)) return 0
  return Math.round(premio * percentual * 100) / 100
}
