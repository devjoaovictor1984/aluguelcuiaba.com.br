// Cálculo de parcelas de aluguel e regras financeiras do CRM.
// Funções puras, sem dependência de banco — fáceis de testar.

export interface InputCalculoParcelas {
  duracao_meses: number
  data_primeiro_aluguel: string  // YYYY-MM-DD
  dia_vencimento: number         // 1..31
  valor_aluguel: number
  valor_seguro_fianca_mensal: number
  iptu_mensal: number
  condominio_mensal: number
  taxa_admin_tipo: 'percentual' | 'fixo'
  taxa_admin_valor: number       // 10 = 10% ou R$ 10
  primeira_parcela_cheia: boolean
}

export interface ParcelaCalculada {
  numero: number
  mes_referencia: string         // YYYY-MM-01
  vencimento: string             // YYYY-MM-DD
  valor_aluguel: number
  valor_seguro: number
  valor_iptu: number
  valor_condominio: number
  valor_total: number            // boleto cobrado do inquilino
  valor_comissao: number         // fica com a imobiliária
  valor_repasse_proprietario: number
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** Último dia do mês (28..31) — para clamp do dia de vencimento */
function ultimoDia(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function calcularComissao(aluguel: number, tipo: 'percentual' | 'fixo', valor: number): number {
  if (tipo === 'fixo') return round(valor)
  return round((aluguel * valor) / 100)
}

export function gerarParcelas(input: InputCalculoParcelas): ParcelaCalculada[] {
  const parcelas: ParcelaCalculada[] = []
  const inicio = new Date(input.data_primeiro_aluguel + 'T00:00:00')

  for (let i = 0; i < input.duracao_meses; i++) {
    const ano = inicio.getFullYear()
    const mes = inicio.getMonth() + i

    const mesRef = new Date(ano, mes, 1)
    const diaVenc = Math.min(input.dia_vencimento, ultimoDia(mesRef.getFullYear(), mesRef.getMonth()))
    const vencimento = new Date(mesRef.getFullYear(), mesRef.getMonth(), diaVenc)

    const seguro = round(input.valor_seguro_fianca_mensal)
    const iptu = round(input.iptu_mensal)
    const condo = round(input.condominio_mensal)
    const aluguel = round(input.valor_aluguel)
    const total = round(aluguel + seguro + iptu + condo)

    let comissaoVal = calcularComissao(aluguel, input.taxa_admin_tipo, input.taxa_admin_valor)
    let repasse = round(aluguel - comissaoVal)

    // 1ª parcela cheia: 100% do aluguel pro corretor (proprietário recebe 0)
    if (i === 0 && input.primeira_parcela_cheia) {
      comissaoVal = aluguel
      repasse = 0
    }

    parcelas.push({
      numero: i + 1,
      mes_referencia: fmtDate(mesRef),
      vencimento: fmtDate(vencimento),
      valor_aluguel: aluguel,
      valor_seguro: seguro,
      valor_iptu: iptu,
      valor_condominio: condo,
      valor_total: total,
      valor_comissao: comissaoVal,
      valor_repasse_proprietario: repasse,
    })
  }

  return parcelas
}

/** Gera código tipo "2025CT001" — sequencial por usuário. */
export function montarCodigo(ano: number, sequencial: number): string {
  return `${ano}CT${String(sequencial).padStart(3, '0')}`
}

/** Resumo financeiro do contrato — usado na revisão e dashboards. */
export interface ResumoFinanceiro {
  total_a_receber: number          // soma de valor_total das parcelas
  total_comissao: number
  total_repasse: number
  total_seguro: number
  primeira_parcela: ParcelaCalculada | null
  ultima_parcela: ParcelaCalculada | null
}

export function resumirParcelas(parcelas: ParcelaCalculada[]): ResumoFinanceiro {
  const r: ResumoFinanceiro = {
    total_a_receber: 0,
    total_comissao: 0,
    total_repasse: 0,
    total_seguro: 0,
    primeira_parcela: parcelas[0] ?? null,
    ultima_parcela: parcelas[parcelas.length - 1] ?? null,
  }
  for (const p of parcelas) {
    r.total_a_receber += p.valor_total
    r.total_comissao += p.valor_comissao
    r.total_repasse += p.valor_repasse_proprietario
    r.total_seguro += p.valor_seguro
  }
  r.total_a_receber = round(r.total_a_receber)
  r.total_comissao = round(r.total_comissao)
  r.total_repasse = round(r.total_repasse)
  r.total_seguro = round(r.total_seguro)
  return r
}
