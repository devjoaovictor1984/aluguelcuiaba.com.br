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
    /**
     * 25%, e não os 30% que usávamos.
     *
     * Medido em 17/08/2026 num imóvel comercial com LMI de incêndio de
     * R$ 700.000: 30% volta 400 "IS da Cobertura: Vendaval, Granizo,
     * Queda de Aeronave e F fora do limite", e 25% passa. Em residencial
     * os mesmos 30% eram aceitos — ou seja, o teto varia com a ocupação,
     * e a documentação não diz qual é.
     *
     * Como isto é ponto de partida e não regra, o valor que passa nos dois
     * casos vale mais que o valor maior que quebra num deles. Está
     * perguntado à corretora.
     */
    vendaval: Math.round(predio * 0.25),
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
