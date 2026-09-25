/**
 * Situação do seguro incêndio de um contrato (v104).
 *
 * A apólice de incêndio dura 12 meses; a locação, 30. Prorrogou o
 * contrato, a apólice vence no meio do caminho — e o imóvel segue alugado
 * sem cobertura até alguém reparar, normalmente no dia do sinistro.
 *
 * Tudo aqui é CALCULADO na hora, a partir da apólice anexada (v97) e das
 * datas do contrato. Não existe "pendência" gravada em lugar nenhum: se
 * existisse, ela dessincronizaria do dia em que alguém anexasse a apólice
 * nova. A única coisa gravada é a dispensa, que é decisão humana e o
 * sistema não teria como deduzir.
 */

export type SituacaoSeguroIncendio =
  | 'nao_se_aplica'      // contrato fora de vigência, ou seguro que nunca foi assunto aqui
  | 'dispensado'         // alguém decidiu não exigir neste contrato
  | 'sem_apolice'        // é pra ter, e não há nenhuma anexada
  | 'sem_vigencia'       // anexada, mas sem datas — não dá pra saber se vale
  | 'vencida'            // acabou antes de hoje
  | 'vence_em_breve'     // acaba nos próximos 30 dias
  | 'descoberto_ate_fim' // vale hoje, mas acaba antes do contrato terminar
  | 'vigente'

export interface ContratoParaSeguro {
  status?: string | null
  data_termino?: string | null
  data_inicio?: string | null
  duracao_meses?: number | null
  valor_seguro_incendio_anual?: number | null
  seguro_incendio_dispensado_em?: string | null
  seguro_incendio_dispensado_motivo?: string | null
}

export interface ApoliceParaSeguro {
  tipo: string
  seguradora?: string | null
  vigencia_inicio?: string | null
  vigencia_fim?: string | null
}

export interface ResultadoSeguroIncendio {
  situacao: SituacaoSeguroIncendio
  /** Pede ação de alguém: é o que acende o aviso na tela. */
  pendente: boolean
  /** Dias até o fim da vigência; negativo = já venceu. null = sem data. */
  diasAteVencer: number | null
  vigenciaFim: string | null
  seguradora: string | null
  /** Término do contrato — calculado quando a data não foi digitada. */
  terminoContrato: string | null
  motivoDispensa: string | null
}

const DIAS_DE_AVISO = 30
const STATUS_VIGENTE = ['ativo', 'inadimplente']

/** Término do contrato: a data digitada, ou início + duração. */
export function terminoDoContrato(c: ContratoParaSeguro): string | null {
  if (c.data_termino) return c.data_termino.slice(0, 10)
  if (!c.data_inicio || !c.duracao_meses) return null
  const [y, m, d] = c.data_inicio.slice(0, 10).split('-').map(Number)
  const fim = new Date(y, m - 1 + c.duracao_meses, d - 1)
  return `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`
}

function diasEntre(deIso: string, ateIso: string): number {
  const [y1, m1, d1] = deIso.split('-').map(Number)
  const [y2, m2, d2] = ateIso.split('-').map(Number)
  return Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000)
}

export function situacaoSeguroIncendio(
  contrato: ContratoParaSeguro,
  apolices: ApoliceParaSeguro[],
  hojeIso: string = new Date().toISOString().slice(0, 10),
): ResultadoSeguroIncendio {
  const apolice = apolices.find(a => a.tipo === 'apolice_incendio') ?? null
  const termino = terminoDoContrato(contrato)

  const base: ResultadoSeguroIncendio = {
    situacao: 'nao_se_aplica',
    pendente: false,
    diasAteVencer: apolice?.vigencia_fim ? diasEntre(hojeIso, apolice.vigencia_fim.slice(0, 10)) : null,
    vigenciaFim: apolice?.vigencia_fim?.slice(0, 10) ?? null,
    seguradora: apolice?.seguradora ?? null,
    terminoContrato: termino,
    motivoDispensa: contrato.seguro_incendio_dispensado_motivo ?? null,
  }

  // Contrato encerrado, rescindido ou ainda em rascunho não cobra nada:
  // "se encerra tudo com o encerramento do contrato".
  if (!STATUS_VIGENTE.includes(contrato.status ?? '')) return base

  if (contrato.seguro_incendio_dispensado_em) {
    return { ...base, situacao: 'dispensado' }
  }

  // Sem valor de incêndio no contrato e sem apólice nenhuma, o seguro
  // nunca foi assunto nesta locação — não é falha, é outro arranjo.
  const ehAssunto = (contrato.valor_seguro_incendio_anual ?? 0) > 0 || !!apolice
  if (!ehAssunto) return base

  if (!apolice) return { ...base, situacao: 'sem_apolice', pendente: true }
  if (!apolice.vigencia_fim) return { ...base, situacao: 'sem_vigencia', pendente: true }

  const dias = base.diasAteVencer!
  if (dias < 0) return { ...base, situacao: 'vencida', pendente: true }
  if (dias <= DIAS_DE_AVISO) return { ...base, situacao: 'vence_em_breve', pendente: true }

  // O caso da prorrogação: a apólice está valendo hoje, mas acaba antes
  // de a locação terminar. Avisa cedo, enquanto dá pra resolver sem
  // correria — e é o que o contrato renovado herda.
  if (termino && apolice.vigencia_fim.slice(0, 10) < termino) {
    return { ...base, situacao: 'descoberto_ate_fim', pendente: true }
  }

  return { ...base, situacao: 'vigente' }
}

/** Frase curta pro aviso, já com as datas dentro. */
export function mensagemSeguroIncendio(r: ResultadoSeguroIncendio): string {
  const fmt = (iso: string | null) => {
    if (!iso) return '—'
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }
  switch (r.situacao) {
    case 'sem_apolice':
      return 'Nenhuma apólice de incêndio anexada neste contrato.'
    case 'sem_vigencia':
      return 'A apólice anexada não tem vigência preenchida — não dá pra saber até quando vale.'
    case 'vencida':
      return `A apólice venceu em ${fmt(r.vigenciaFim)}. O imóvel está alugado sem cobertura.`
    case 'vence_em_breve':
      return `A apólice vence em ${fmt(r.vigenciaFim)} — ${r.diasAteVencer} dia${r.diasAteVencer === 1 ? '' : 's'}.`
    case 'descoberto_ate_fim':
      return `A apólice vale até ${fmt(r.vigenciaFim)}, mas a locação vai até ${fmt(r.terminoContrato)}: o fim do contrato fica descoberto.`
    case 'dispensado':
      return r.motivoDispensa
        ? `Apólice dispensada neste contrato — ${r.motivoDispensa}`
        : 'Apólice dispensada neste contrato.'
    case 'vigente':
      return `Apólice vigente até ${fmt(r.vigenciaFim)}.`
    default:
      return ''
  }
}
