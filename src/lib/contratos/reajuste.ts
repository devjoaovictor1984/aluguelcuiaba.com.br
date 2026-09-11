/**
 * Quando cai o próximo reajuste de um contrato.
 *
 * O reajuste do aluguel é anual, mas a data no contrato (`data_proximo_reajuste`)
 * é preenchida à mão no cadastro — e quase nunca está. Sem ela o painel não
 * tinha o que avisar, e o contrato passava dos 12 meses em silêncio.
 *
 * Aqui, quando a data não está gravada, o aniversário do contrato serve de
 * estimativa: é a data que a lei usa como periodicidade mínima, e é boa o
 * bastante pra fazer o aviso aparecer. Fica marcada como estimada, porque
 * quem manda é o que estiver escrito no contrato.
 */

/** Soma meses a uma data ISO, sem transbordar pro mês seguinte (31/01 + 1 = 28/02). */
export function somarMeses(iso: string, meses: number): string {
  const d = new Date(iso + 'T00:00:00')
  const dia = d.getDate()
  const alvo = new Date(d.getFullYear(), d.getMonth() + meses, 1)
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()
  alvo.setDate(Math.min(dia, ultimoDia))
  const y = alvo.getFullYear()
  const m = String(alvo.getMonth() + 1).padStart(2, '0')
  const dd = String(alvo.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Dias entre hoje e uma data ISO. Negativo = já passou. */
export function diasAteISO(iso: string, hoje = hojeISO()): number {
  const alvo = new Date(iso + 'T00:00:00').getTime()
  const base = new Date(hoje + 'T00:00:00').getTime()
  return Math.round((alvo - base) / 86400000)
}

/**
 * Tudo aqui sai dos dados do próprio contrato — a data de início dele, o
 * prazo dele, a data de reajuste que estiver gravada nele. Não há regra
 * global: dois contratos que começam em dias diferentes têm marcos em dias
 * diferentes.
 */
export interface ContratoParaReajuste {
  data_inicio?: string | null
  data_proximo_reajuste?: string | null
  data_termino?: string | null
  /** Usado quando o contrato não tem `data_termino` gravada. */
  duracao_meses?: number | null
}

/**
 * O fim da vigência deste contrato. Prefere a data gravada; na falta dela,
 * conta o prazo do próprio contrato a partir do início. Sem os dois, é
 * contrato por prazo indeterminado — não tem fim para avisar.
 */
export function terminoContrato(contrato: ContratoParaReajuste): string | null {
  if (contrato.data_termino) return contrato.data_termino.slice(0, 10)
  if (contrato.data_inicio && contrato.duracao_meses && contrato.duracao_meses > 0) {
    return somarMeses(contrato.data_inicio.slice(0, 10), contrato.duracao_meses)
  }
  return null
}

export interface JanelaReajuste {
  /** Data ISO do próximo reajuste. */
  data: string
  /** Dias até lá. Negativo = atrasado. */
  dias: number
  /** true = derivada do aniversário do contrato, não gravada no cadastro. */
  estimada: boolean
}

/**
 * Um aniversário que passou há pouco ainda é acionável — o reajuste está
 * atrasado, não perdido. Passado esse prazo, a estimativa rola pro ano
 * seguinte em vez de acusar um atraso de anos que ninguém vai aplicar.
 */
const TOLERANCIA_ANIVERSARIO_DIAS = 30

export function janelaReajuste(
  contrato: ContratoParaReajuste,
  hoje = hojeISO(),
): JanelaReajuste | null {
  if (contrato.data_proximo_reajuste) {
    const data = contrato.data_proximo_reajuste.slice(0, 10)
    return { data, dias: diasAteISO(data, hoje), estimada: false }
  }

  if (!contrato.data_inicio) return null
  const inicio = contrato.data_inicio.slice(0, 10)

  // Primeiro aniversário que ainda não passou da tolerância.
  let data = somarMeses(inicio, 12)
  let guarda = 0
  while (diasAteISO(data, hoje) < -TOLERANCIA_ANIVERSARIO_DIAS && guarda < 60) {
    data = somarMeses(data, 12)
    guarda++
  }

  // Contrato que termina antes do aniversário não tem reajuste a fazer —
  // o que vem é renovação, e disso o painel já avisa por outro caminho.
  const termino = terminoContrato(contrato)
  if (termino && termino < data) return null

  return { data, dias: diasAteISO(data, hoje), estimada: true }
}

// ---------------------------------------------------------------------------
// Marcos do contrato
//
// O contrato típico aqui é de 30 meses: reajusta aos 12, reajusta aos 24 e
// termina aos 30, quando a conversa passa a ser renovação. São três momentos
// em que alguém tem que agir, e todos chegam sem avisar. O marco é o próximo
// deles — é o que vira etiqueta na lista e na ficha do contrato.
// ---------------------------------------------------------------------------

export type TipoMarco = 'reajuste' | 'renovacao'

export interface MarcoContrato {
  tipo: TipoMarco
  /** Data ISO do marco. */
  data: string
  /** Dias até lá. Negativo = passou. */
  dias: number
  /** Meses de contrato completados nessa data (12, 24, 30…). */
  meses: number
  /** 1º, 2º reajuste… `null` na renovação. */
  ordinal: number | null
  /** Reajuste sem data no cadastro — veio do aniversário do contrato. */
  estimado: boolean
  /** "1º reajuste" · "Renovação" */
  rotulo: string
  /** "1º reajuste (12 meses)" · "Renovação (30 meses)" */
  rotuloLongo: string
}

/** Dentro de quantos dias o marco vira etiqueta: o último mês antes dele. */
export const JANELA_MARCO_DIAS = 30

/** Meses inteiros entre duas datas ISO. */
function mesesEntre(de: string, ate: string): number {
  const a = new Date(de + 'T00:00:00')
  const b = new Date(ate + 'T00:00:00')
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (b.getDate() < a.getDate()) m--
  return m
}

/**
 * O próximo marco do contrato — reajuste ou fim de vigência, o que vier antes.
 * Devolve mesmo quando ainda falta muito; use `marcoNaJanela` para a etiqueta.
 */
export function marcoContrato(
  contrato: ContratoParaReajuste,
  hoje = hojeISO(),
): MarcoContrato | null {
  const candidatos: MarcoContrato[] = []

  const reaj = janelaReajuste(contrato, hoje)
  if (reaj && contrato.data_inicio) {
    const meses = mesesEntre(contrato.data_inicio.slice(0, 10), reaj.data)
    const ordinal = Math.max(1, Math.round(meses / 12))
    candidatos.push({
      tipo: 'reajuste',
      data: reaj.data,
      dias: reaj.dias,
      meses,
      ordinal,
      estimado: reaj.estimada,
      rotulo: `${ordinal}º reajuste`,
      rotuloLongo: `${ordinal}º reajuste (${meses} meses)`,
    })
  }

  const termino = terminoContrato(contrato)
  if (termino) {
    const data = termino
    const dias = diasAteISO(data, hoje)
    // Contrato que venceu há muito tempo não é pendência de renovação — ou foi
    // renovado por outro registro, ou está encerrado.
    if (dias >= -TOLERANCIA_ANIVERSARIO_DIAS) {
      const meses = contrato.data_inicio ? mesesEntre(contrato.data_inicio.slice(0, 10), data) : 0
      candidatos.push({
        tipo: 'renovacao',
        data,
        dias,
        meses,
        ordinal: null,
        estimado: false,
        rotulo: 'Renovação',
        rotuloLongo: meses > 0 ? `Renovação (${meses} meses)` : 'Renovação',
      })
    }
  }

  if (candidatos.length === 0) return null

  // O mais próximo manda. Empate — contrato de 12 meses, em que o reajuste cai
  // no dia do término — fica com a renovação, que é a decisão maior.
  candidatos.sort((a, b) => a.dias - b.dias || (a.tipo === 'renovacao' ? -1 : 1))
  return candidatos[0]
}

/** O marco, só se ele estiver no último mês (ou já tiver passado). */
export function marcoNaJanela(
  contrato: ContratoParaReajuste,
  hoje = hojeISO(),
): MarcoContrato | null {
  const marco = marcoContrato(contrato, hoje)
  return marco && marco.dias <= JANELA_MARCO_DIAS ? marco : null
}
