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

/** "R$ 1.950,00 (mil novecentos e cinquenta reais)" — minúsculo, que é como vai no meio da frase. */
const porExtenso = (v: number) => {
  const ext = valorPorExtenso(v)
  return `${brl(v)} (${ext.charAt(0).toLowerCase()}${ext.slice(1)})`
}

const INDICE_ROTULO: Record<string, string> = { IGPM: 'IGP-M', IPCA: 'IPCA', INPC: 'INPC' }

/**
 * Índice de verdade (IGP-M, IPCA…) ou null. "manual" é o "Manual / Acordo"
 * do modal: não é índice, é acordo — e "variação do manual" não é frase.
 */
export function indiceDoReajuste(indice: string | null | undefined): string | null {
  const t = indice?.trim()
  if (!t || t.toLowerCase() === 'manual') return null
  return INDICE_ROTULO[t.toUpperCase()] ?? t
}

/**
 * Parágrafo de um encargo (IPTU, condomínio). Zero de um lado não é
 * "ajuste de R$ 0,00 para R$ 100,00": é passar a cobrar, ou deixar de cobrar.
 */
function paragrafoEncargo(o: {
  nome: string; antigo: number; novo: number; desde: string; motivo: string; igualmente: boolean
}): string {
  const tambem = o.igualmente ? 'igualmente ' : ''
  if (o.antigo === 0) {
    return `Fica ${tambem}incluído na cobrança mensal, juntamente com o aluguel, ${o.nome} no valor de `
      + `${porExtenso(o.novo)}, com efeitos a partir de ${o.desde}, ${o.motivo}.`
  }
  if (o.novo === 0) {
    return `Deixa de ser cobrado juntamente com o aluguel ${o.nome}, até então no valor de `
      + `${porExtenso(o.antigo)}, com efeitos a partir de ${o.desde}.`
  }
  return `Fica ${tambem}ajustado o valor mensal d${o.nome} cobrado juntamente com o aluguel, de `
    + `${porExtenso(o.antigo)} para ${porExtenso(o.novo)}, com efeitos a partir de ${o.desde}, ${o.motivo}.`
}

export function textoAditivoReajuste(d: DadosTextoReajuste): string {
  const paragrafos: string[] = []
  const aumentou = d.valorNovo >= d.valorAntigo
  const desde = dataBr(d.dataEfetiva)

  // 1. O aluguel — o que o aditivo faz. Ajuste só de IPTU/condomínio não
  // tem este parágrafo: "de R$ 1.600 para R$ 1.600, acréscimo de 0%" não
  // é cláusula, é ruído.
  const aluguelMudou = d.valorNovo !== d.valorAntigo
  const indice = indiceDoReajuste(d.indice)
  const base = indice
    ? `, com base na variação do ${indice} acumulada no período`
    : ', conforme acordo entre as partes'
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
    paragrafos.push(paragrafoEncargo({
      nome: 'o IPTU', antigo: d.iptuAntigo!, novo: d.iptuNovo!, desde,
      motivo: 'em razão do lançamento do exercício pelo Município', igualmente: aluguelMudou,
    }))
  }

  const condoMudou = d.condominioNovo != null && d.condominioAntigo != null
    && d.condominioNovo !== d.condominioAntigo
  if (condoMudou) {
    paragrafos.push(paragrafoEncargo({
      nome: 'o condomínio', antigo: d.condominioAntigo!, novo: d.condominioNovo!, desde,
      motivo: 'conforme deliberação do condomínio', igualmente: aluguelMudou || iptuMudou,
    }))
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
