import { valorPorExtenso } from '@/lib/extenso'

/**
 * O texto do termo aditivo de reajuste, escrito a partir do reajuste que
 * acabou de ser aplicado.
 *
 * Existe porque o aditivo de reajuste é sempre o mesmo instrumento: passou
 * um ano, as partes ajustaram o valor, e **nada mais muda** — nem prazo, nem
 * data de início ou término, nem dia de vencimento. Deixar isso na mão de
 * quem digita produz um texto diferente a cada contrato, e é justamente a
 * frase sobre o que NÃO muda que ninguém lembra de escrever.
 *
 * Cada parágrafo vira um item numerado (1.1, 1.2…) na cláusula do objeto,
 * no PDF do aditivo.
 */

export interface DadosTextoReajuste {
  valorAntigo: number
  valorNovo: number
  /** Variação percentual do aluguel. Negativa em redução. */
  percentual: number
  /** A partir de quando vale, ISO yyyy-mm-dd. */
  dataEfetiva: string
  indice?: string | null
  iptuAntigo?: number | null
  iptuNovo?: number | null
  condominioAntigo?: number | null
  condominioNovo?: number | null
  /** Texto livre do corretor, quando houver. Entra como último item. */
  observacao?: string | null
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const dataBr = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

const pct = (v: number) =>
  `${Math.abs(v).toFixed(2).replace('.', ',')}%`

/** "R$ 1.950,00 (mil novecentos e cinquenta reais)" */
const porExtenso = (v: number) => `${brl(v)} (${valorPorExtenso(v)})`

export function textoAditivoReajuste(d: DadosTextoReajuste): string {
  const paragrafos: string[] = []
  const aumentou = d.valorNovo >= d.valorAntigo
  const desde = dataBr(d.dataEfetiva)

  // 1. O aluguel — o que o aditivo faz. Ajuste só de IPTU/condomínio não
  // tem este parágrafo: "de R$ 1.600 para R$ 1.600, acréscimo de 0%" não
  // é cláusula, é ruído.
  const aluguelMudou = d.valorNovo !== d.valorAntigo
  const base = d.indice?.trim()
    ? `, com base na variação do ${d.indice.trim()} acumulada no período`
    : ''
  if (aluguelMudou) {
    paragrafos.push(
      `Fica ${aumentou ? 'reajustado' : 'reduzido'} o valor do aluguel mensal de `
      + `${porExtenso(d.valorAntigo)} para ${porExtenso(d.valorNovo)}, `
      + `${aumentou ? 'correspondente a um acréscimo' : 'correspondente a uma redução'} de `
      + `${pct(d.percentual)}${base}, com efeitos a partir de ${desde}.`,
    )
  }

  // 2 e 3. Encargos, um parágrafo cada — são obrigações distintas do
  // aluguel e não podem ser somadas a ele.
  const iptuMudou = d.iptuNovo != null && d.iptuAntigo != null && d.iptuNovo !== d.iptuAntigo
  if (iptuMudou) {
    paragrafos.push(
      `Fica ${aluguelMudou ? 'igualmente ' : ''}ajustado o valor mensal do IPTU cobrado juntamente com o aluguel, de `
      + `${porExtenso(d.iptuAntigo!)} para ${porExtenso(d.iptuNovo!)}, com efeitos a partir de ${desde}, `
      + `em razão do lançamento do exercício pelo Município.`,
    )
  }

  const condoMudou = d.condominioNovo != null && d.condominioAntigo != null
    && d.condominioNovo !== d.condominioAntigo
  if (condoMudou) {
    paragrafos.push(
      `Fica ajustado o valor mensal da taxa de condomínio cobrada juntamente com o aluguel, de `
      + `${porExtenso(d.condominioAntigo!)} para ${porExtenso(d.condominioNovo!)}, `
      + `com efeitos a partir de ${desde}, conforme deliberação do condomínio.`,
    )
  }

  // 4. O que NÃO muda. É a razão de existir deste gerador: a frase que
  // protege as duas partes e que ninguém lembra de escrever.
  paragrafos.push(
    'Permanecem inalterados o prazo de vigência da locação, as datas de início e de término, '
    + 'o dia de vencimento e a modalidade de garantia previstos no contrato originário, '
    + `ficando este Termo Aditivo restrito ao ajuste ${[aluguelMudou, iptuMudou, condoMudou].filter(Boolean).length > 1 ? 'dos valores' : 'do valor'} acima.`,
  )

  if (d.observacao?.trim()) paragrafos.push(d.observacao.trim())

  return paragrafos.join('\n\n')
}
