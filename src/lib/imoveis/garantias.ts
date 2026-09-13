/**
 * Garantias aceitas na locação de um imóvel anunciado.
 *
 * É a primeira pergunta de quem procura aluguel, e até aqui só aparecia no
 * contrato — quem não tem fiador saía da conversa antes de ligar, e quem
 * tinha dinheiro pra caução não sabia que aquele imóvel aceitava.
 */

/** Teto do valor mensal do seguro fiança, como percentual do aluguel. */
export const TETO_FIANCA_SOBRE_ALUGUEL = 0.13

export interface GarantiasImovel {
  garantia_fianca?: boolean | null
  garantia_fianca_valor?: number | null
  garantia_caucao?: boolean | null
  garantia_caucao_meses?: number | null
  garantia_fiador?: boolean | null
  seguro_incendio_obrigatorio?: boolean | null
  /** Valor ANUAL aproximado — é assim que a apólice de incêndio é vendida. */
  seguro_incendio_valor?: number | null
}

export type TipoGarantia = 'fianca' | 'caucao' | 'fiador' | 'incendio'

export interface GarantiaResumo {
  tipo: TipoGarantia
  /** Nome curto, pro chip da página. */
  rotulo: string
  /** Complemento: valor do seguro, quantos aluguéis de caução. */
  detalhe: string | null
  /** Texto do `title`, que é o que o ícone sozinho no card precisa dizer. */
  descricao: string
}

/** Teto do seguro fiança pra este aluguel. */
export function tetoFianca(aluguel: number): number {
  return Math.round(aluguel * TETO_FIANCA_SOBRE_ALUGUEL * 100) / 100
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

/**
 * As garantias do imóvel, na ordem em que interessam a quem procura: o que
 * dá pra resolver sozinho vem antes do que depende de terceiro.
 */
export function resumirGarantias(i: GarantiasImovel): GarantiaResumo[] {
  const lista: GarantiaResumo[] = []

  if (i.garantia_fianca) {
    const valor = Number(i.garantia_fianca_valor) || 0
    lista.push({
      tipo: 'fianca',
      rotulo: 'Seguro fiança',
      detalhe: valor > 0 ? `~${brl(valor)}/mês` : null,
      descricao: valor > 0
        ? `Aceita seguro fiança, por volta de ${brl(valor)} por mês (valor aproximado)`
        : 'Aceita seguro fiança',
    })
  }

  if (i.garantia_caucao) {
    const meses = Number(i.garantia_caucao_meses) || 0
    lista.push({
      tipo: 'caucao',
      rotulo: 'Caução',
      detalhe: meses > 0 ? `${meses} aluguel${meses > 1 ? 'éis' : ''}` : null,
      descricao: meses > 0
        ? `Aceita caução de ${meses} aluguel${meses > 1 ? 'éis' : ''}`
        : 'Aceita caução',
    })
  }

  if (i.garantia_fiador) {
    lista.push({
      tipo: 'fiador',
      rotulo: 'Fiador',
      detalhe: null,
      descricao: 'Aceita fiador',
    })
  }

  if (i.seguro_incendio_obrigatorio) {
    // Anual, não mensal: é como a apólice de incêndio é vendida e cobrada.
    const valor = Number(i.seguro_incendio_valor) || 0
    lista.push({
      tipo: 'incendio',
      rotulo: 'Seguro incêndio',
      detalhe: valor > 0 ? `~${brl(valor)}/ano · obrigatório` : 'obrigatório',
      descricao: valor > 0
        ? `Seguro incêndio obrigatório, por volta de ${brl(valor)} por ano (valor aproximado), cobrado à parte do aluguel`
        : 'Seguro incêndio obrigatório, cobrado à parte do aluguel',
    })
  }

  return lista
}
