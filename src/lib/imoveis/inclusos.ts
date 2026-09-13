/**
 * O que já está dentro do valor anunciado.
 *
 * O cadastro pergunta isso desde sempre — "Pacote tudo incluso", gás, água,
 * luz — e nada disso aparecia na vitrine. Quem anuncia um valor com
 * condomínio e IPTU dentro parecia mais caro que o vizinho que anuncia só
 * o aluguel, e a informação que desfazia a impressão estava guardada.
 */

export interface InclusosImovel {
  custo_tipo?: string | null
  gas_incluso?: boolean | null
  agua_inclusa?: boolean | null
  luz_inclusa?: boolean | null
}

export type TipoIncluso = 'pacote' | 'gas' | 'agua' | 'luz'

export interface InclusoResumo {
  tipo: TipoIncluso
  /** Texto do chip na página. */
  rotulo: string
  /** Versão curta, pro card, onde não cabe frase. */
  curto: string
}

/**
 * O pacote vem primeiro: condomínio e IPTU pesam muito mais no bolso do que
 * gás, água e luz, e é a diferença que explica o valor anunciado.
 */
export function resumirInclusos(i: InclusosImovel): InclusoResumo[] {
  const lista: InclusoResumo[] = []

  if (i.custo_tipo === 'pacote') {
    lista.push({
      tipo: 'pacote',
      rotulo: 'Condomínio e IPTU inclusos',
      curto: 'Condo + IPTU inclusos',
    })
  }
  if (i.gas_incluso) lista.push({ tipo: 'gas', rotulo: 'Gás incluso', curto: 'Gás' })
  if (i.agua_inclusa) lista.push({ tipo: 'agua', rotulo: 'Água inclusa', curto: 'Água' })
  if (i.luz_inclusa) lista.push({ tipo: 'luz', rotulo: 'Luz inclusa', curto: 'Luz' })

  return lista
}

/** Uma linha só, pro card: "Condo + IPTU inclusos · Água · Luz". */
export function linhaInclusos(i: InclusosImovel): string | null {
  const lista = resumirInclusos(i)
  if (lista.length === 0) return null
  return lista.map(x => x.curto).join(' · ')
}
