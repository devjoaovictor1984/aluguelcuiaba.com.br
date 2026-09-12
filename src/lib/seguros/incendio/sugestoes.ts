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
 * Valor do imóvel = aluguel ÷ 0,5%, ou seja aluguel × 200.
 *
 * É a conta do painel da corretora, conferida em 08/09/2026: aluguel de
 * R$ 1.800 produz R$ 360.000 no campo de incêndio. O "valor segurado" da
 * cobertura principal É o valor do imóvel — não existe campo separado lá,
 * e o corretor sobrescreve quando conhece o valor real.
 *
 * Antes usávamos 80, sob a ideia de que interessava o custo de
 * reconstrução e não o valor de mercado. Era raciocínio nosso, e dava
 * R$ 144.000 onde eles davam R$ 360.000 — dois seguros diferentes para o
 * mesmo imóvel.
 */
const FATOR_VALOR_IMOVEL = 200

/** Perda de aluguel: 6 meses, igual ao painel. */
const MESES_PERDA_ALUGUEL = 6

/**
 * O que o painel sugere para cada cobertura opcional, como fração do valor
 * do imóvel, no momento em que o corretor MARCA a caixa.
 *
 * Medido no painel deles com valor do imóvel de R$ 360.000:
 * responsabilidade civil sugeriu 36.000 (10%) e danos elétricos 3.600 (1%).
 *
 * Vendaval está no painel e ainda não foi observado marcado — fica de fora
 * até alguém ver o número, em vez de entrar com chute. Vazamento não existe
 * no painel deles; a API aceita, e continua disponível como campo livre.
 */
export const SUGESTAO_OPCIONAL = {
  respCivil: 0.10,
  danosEletricos: 0.01,
} as const

/**
 * O que já vem preenchido: só as duas coberturas obrigatórias.
 *
 * No painel da corretora, "Sugerir valores" preenche incêndio e perda de
 * aluguel, e as demais ficam desmarcadas em zero. Enquanto sugeríamos as
 * seis, a mesma casa saía R$ 364,71 aqui e R$ 131,99 lá — parecia tarifa
 * da seguradora e era escolha nossa.
 *
 * `cobertura` segue no parâmetro porque a divisão prédio/conteúdo ainda
 * decide o `tipo_cobertura` enviado; o que mudou é que o conteúdo não vem
 * mais sugerido.
 */
export function sugerirValores(aluguel: number, cobertura: TipoCobertura): ValoresCobertura {
  if (!(aluguel > 0)) return {}
  void cobertura

  return {
    incendio: valorDoImovel(aluguel),
    perdaAluguel: Math.round(aluguel * MESES_PERDA_ALUGUEL),
  }
}

export function valorDoImovel(aluguel: number): number {
  return Math.round((aluguel * FATOR_VALOR_IMOVEL) / 1000) * 1000
}

/** O valor que o painel preenche quando a cobertura opcional é marcada. */
export function sugerirOpcional(
  chave: keyof typeof SUGESTAO_OPCIONAL, valorImovel: number,
): number {
  return Math.round(valorImovel * SUGESTAO_OPCIONAL[chave])
}

/** A parcela mínima aceita pela seguradora — aparece no painel deles. */
export const PARCELA_MINIMA = 60

/**
 * Teto de parcelas da Alfa **v2**, dito pela corretora em 11/09/2026: a v1
 * ia até 6×, a v2 vai até 4×. Fica registrado porque é o limite que o
 * `qtpar` do `/contratar` aceita — mas hoje a plataforma emite à vista, ver
 * `opcoesParcelamento`.
 */
export const MAX_PARCELAS_ALFA_V2 = 4

/**
 * Quantas parcelas caberiam sem furar o mínimo, dentro do teto da v2.
 * Não é usada na tela hoje (a plataforma emite à vista); serve de
 * referência pra quando o parcelamento voltar.
 */
export function parcelasPossiveis(premio: number): number {
  if (!(premio > 0)) return 1
  return Math.max(1, Math.min(MAX_PARCELAS_ALFA_V2, Math.floor(premio / PARCELA_MINIMA)))
}

export interface OpcaoParcelamento {
  descricao: string
  qtdParcelas: number
  valorParcela: number
}

/**
 * O pagamento, quando a API não manda nenhuma opção: **à vista, só**.
 *
 * Medido em 16/08/2026: o `/calculo` da Alfa devolve `listaFormasPagto`
 * VAZIA — nas duas vigências, com e sem assistência. Como a nossa tela só
 * oferecia o que vinha nessa lista, a cotação calculava e não dava pra
 * contratar: não havia o que escolher.
 *
 * A saída era derivar o parcelamento do prêmio, com a mesma conta do painel
 * da corretora. Em 11/09/2026 eles esclareceram por que a conta não fecha:
 * a v1 ia até 6×, a **v2 vai até 4×**, e a API **não devolve o valor da
 * parcela**. Parcelar sem esse dado é chutar o boleto do cliente.
 *
 * Então a plataforma emite à vista e ponto. Quando a API passar a devolver
 * as parcelas, a lista dela volta a mandar — o código que lê
 * `listaFormasPagto` continua no lugar e tem preferência.
 *
 * A escolha derivada vai sem `cod_forma_pagto`, campo que o `/contratar`
 * trata como opcional.
 */
export function opcoesParcelamento(premio: number): OpcaoParcelamento[] {
  if (!(premio > 0)) return []
  return [{
    descricao: 'À vista',
    qtdParcelas: 1,
    valorParcela: Math.round(premio * 100) / 100,
  }]
}

/**
 * Percentual de comissão (pró-labore) da imobiliária sobre o prêmio.
 *
 * Confirmado pela corretora em 11/09/2026, e é mais do que um número de
 * coluna: **a comissão entra no preço do seguro**. A API cota com a
 * comissão cadastrada para aquele CNPJ e não aceita outra — mexer nela só
 * no portal deles. Para a IMOBILIATTO está cadastrada em 20%, então toda
 * cotação nossa já sai com esses 20% embutidos no prêmio.
 *
 * A API continua não devolvendo o valor, então o que a tela mostra é a
 * conta de 20% sobre o prêmio, não um campo lido da resposta.
 */
export const PRO_LABORE_PADRAO = 0.20

export function estimarProLabore(premio: number, percentual = PRO_LABORE_PADRAO): number {
  if (!(premio > 0)) return 0
  return Math.round(premio * percentual * 100) / 100
}
