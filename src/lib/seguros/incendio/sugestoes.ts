import type { TipoCobertura, ValoresCobertura } from './tipos'

/**
 * Sugestão de limites, espelhando o "Sugerir valores" do painel da
 * corretora.
 *
 * REGRA DESTE ARQUIVO: não inventar. O que sai daqui tem que ser o que o
 * painel da Maximiza produz para a mesma entrada — se a nossa cotação e a
 * deles divergem, a divergência tem que ser da API, não nossa.
 *
 * Até 08/09/2026 não era assim. Sugeríamos as SEIS coberturas com
 * proporções de mercado escolhidas por nós, e o painel deles sugere DUAS.
 * O resultado é que a mesma casa saía a R$ 364,71 aqui e R$ 131,99 lá —
 * 2,8× — e a conversa com a corretora virava sobre um preço que era
 * escolha nossa, não tarifa deles.
 */

/**
 * Limite de incêndio = aluguel × este fator.
 *
 * 83,33 lido do painel da corretora em 08/09/2026: aluguel de R$ 1.800
 * produz R$ 150.000 no campo de incêndio (150.000 ÷ 1.800 = 83,33). Antes
 * usávamos 80, que era regra de mercado nossa e dava R$ 144.000.
 *
 * ⚠️ UMA amostra só. Com um ponto não dá para distinguir "fator 83,33" de
 * "fator 80 arredondado para cima" — as duas explicam 1.800 → 150.000.
 * Está pedido à corretora, junto da fórmula. Um segundo aluguel no painel
 * deles fecha a questão.
 */
const FATOR_RECONSTRUCAO = 250 / 3

/** Perda de aluguel: 6 meses, igual ao painel deles. */
const MESES_PERDA_ALUGUEL = 6

export function sugerirValores(aluguel: number, cobertura: TipoCobertura): ValoresCobertura {
  if (!(aluguel > 0)) return {}

  const predio = Math.round((aluguel * FATOR_RECONSTRUCAO) / 1000) * 1000

  /**
   * As acessórias saem VAZIAS, e é de propósito.
   *
   * No painel da corretora, "Sugerir valores" preenche incêndio e perda de
   * aluguel; vendaval, responsabilidade civil e danos elétricos ficam em
   * zero e desmarcadas, e quem quiser liga. Fazemos igual: o corretor
   * preenche o que for vender, e o que ele não preencher não entra no
   * prêmio.
   *
   * Danos elétricos é o caso que mais dói: a taxa efetiva da API é 1,688%,
   * contra 0,725% na tabela do painel deles. Ligada por padrão sobre 5% do
   * prédio, ela sozinha custava mais que a cobertura principal de incêndio.
   *
   * `cobertura` continua no parâmetro porque a divisão prédio/conteúdo é
   * escolha da nossa tela e ainda decide o `tipo_cobertura` enviado; o que
   * mudou é que o conteúdo não vem mais sugerido.
   */
  void cobertura

  return {
    incendio: predio,
    perdaAluguel: Math.round(aluguel * MESES_PERDA_ALUGUEL),
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

export interface OpcaoParcelamento {
  descricao: string
  qtdParcelas: number
  valorParcela: number
}

/**
 * O parcelamento, quando a API não manda nenhum.
 *
 * Medido em 16/08/2026: o `/calculo` da Alfa devolve `listaFormasPagto`
 * VAZIA — nas duas vigências, com e sem assistência. Como a nossa tela só
 * oferecia o que vinha nessa lista, a cotação calculava e não dava pra
 * contratar: não havia o que escolher.
 *
 * O painel da corretora não depende dela. Ele deriva do prêmio e da
 * parcela mínima: prêmio de R$ 210,83 vira 1× 210,83, 2× 105,41 e
 * 3× 70,28 — para em 3 porque a quarta cairia abaixo de R$ 60. É a mesma
 * conta daqui.
 *
 * A escolha derivada vai sem `cod_forma_pagto`, campo que o `/contratar`
 * trata como opcional. Se a corretora confirmar quais códigos valem, a
 * lista da API volta a ter preferência.
 */
export function opcoesParcelamento(premio: number): OpcaoParcelamento[] {
  if (!(premio > 0)) return []
  const maximo = parcelasPossiveis(premio)
  return Array.from({ length: maximo }, (_, i) => {
    const n = i + 1
    return {
      descricao: n === 1 ? 'À vista' : `${n}× sem juros`,
      qtdParcelas: n,
      // Centavos para baixo: a soma das parcelas nunca pode passar do prêmio.
      valorParcela: Math.floor((premio / n) * 100) / 100,
    }
  })
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
