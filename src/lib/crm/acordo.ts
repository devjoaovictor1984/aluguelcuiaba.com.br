import type { BaseComissao } from './calculos'

/**
 * Acordo de quitação (v109): o locatário paga UM valor negociado por
 * várias parcelas em aberto. Funções puras — a action grava, isto calcula.
 *
 * Regras:
 *  - O valor recebido é rateado entre as parcelas proporcionalmente ao
 *    valor de cada uma, em centavos (a sobra do arredondamento vai para a
 *    última). 2 × R$ 3.600 por R$ 3.600 → R$ 1.800 em cada.
 *  - Dentro de cada parcela, o que entrou cobre primeiro os encargos
 *    (seguro fiança, IPTU, condomínio — dinheiro de terceiros que só passa
 *    por dentro) e o resto é aluguel. O desconto sai do aluguel.
 *  - Comissão sobre o que entrou: a comissão gravada na parcela é
 *    reduzida na mesma proporção da base dela (aluguel, ou aluguel +
 *    encargos). Escala a gravada, em vez de recalcular pela taxa, para
 *    respeitar o que a parcela já tinha de especial (taxa fixa, 1ª parcela
 *    de intermediação).
 *  - Repasse = aluguel recebido + IPTU/condomínio recebidos − comissão,
 *    a mesma conta de calcularRepasse.
 */

export interface ParcelaParaAcordo {
  id: string
  numero: number
  valor_aluguel: number
  valor_seguro: number
  valor_iptu: number
  valor_condominio: number
  valor_total: number
  valor_comissao: number
}

export interface ParcelaAcordada {
  id: string
  numero: number
  valor_original: number
  valor_pago: number
  desconto: number
  valor_comissao: number
  valor_repasse_proprietario: number
}

const c = (n: unknown) => Math.round(Number(n ?? 0) * 100)
const r = (centavos: number) => centavos / 100

export function ratearAcordo(
  parcelas: ParcelaParaAcordo[],
  valorAcordado: number,
  base: BaseComissao = 'aluguel',
): ParcelaAcordada[] {
  const ordenadas = [...parcelas].sort((a, b) => a.numero - b.numero)
  const totalC = ordenadas.reduce((s, p) => s + c(p.valor_total), 0)
  const acordadoC = Math.min(c(valorAcordado), totalC)
  if (totalC <= 0) return []

  let distribuido = 0
  return ordenadas.map((p, i) => {
    const valorC = c(p.valor_total)
    const parteC = i === ordenadas.length - 1
      ? acordadoC - distribuido
      : Math.floor((acordadoC * valorC) / totalC)
    distribuido += parteC

    // Encargos primeiro, na ordem: seguro (vai p/ seguradora), IPTU, condomínio.
    let resta = parteC
    const pega = (v: number) => { const x = Math.min(resta, Math.max(0, v)); resta -= x; return x }
    pega(c(p.valor_seguro))
    const iptu = pega(c(p.valor_iptu))
    const cond = pega(c(p.valor_condominio))
    const aluguel = resta

    const aluguelOrig = c(p.valor_aluguel)
    const encOrig = c(p.valor_iptu) + c(p.valor_condominio)
    const baseOrig = base === 'aluguel_encargos' ? aluguelOrig + encOrig : aluguelOrig
    const baseRec = base === 'aluguel_encargos' ? aluguel + iptu + cond : aluguel
    const comissaoC = baseOrig > 0 ? Math.round((c(p.valor_comissao) * baseRec) / baseOrig) : 0

    return {
      id: p.id,
      numero: p.numero,
      valor_original: r(valorC),
      valor_pago: r(parteC),
      desconto: r(valorC - parteC),
      valor_comissao: r(comissaoC),
      valor_repasse_proprietario: r(aluguel + iptu + cond - comissaoC),
    }
  })
}

export function resumirAcordo(linhas: ParcelaAcordada[]) {
  const soma = (k: keyof ParcelaAcordada) => r(linhas.reduce((s, l) => s + c(l[k]), 0))
  return {
    original: soma('valor_original'),
    pago: soma('valor_pago'),
    desconto: soma('desconto'),
    comissao: soma('valor_comissao'),
    repasse: soma('valor_repasse_proprietario'),
  }
}
