/**
 * Domínio de seguros do CRM — sem nenhuma referência a fornecedor.
 *
 * O app conversa só com estes tipos. Traduzir pro formato da Maximiza
 * (PT-BR "1.500,00", datas dd/MM/yyyy, enums numéricos) é trabalho do
 * mapper. Quando entrar uma segunda corretora, nenhuma tela muda.
 */

export type ProdutoSeguro = 'fianca' | 'incendio'
export type Finalidade = 'R' | 'C'
export type TipoPessoa = 'F' | 'J'
export type TipoAnalise = 'reduzida' | 'completa'

/* ── Entrada ───────────────────────────────────────────────────────── */

export interface PretendenteInput {
  tipo: TipoPessoa
  nome: string
  cpfCnpj: string
  email: string
  celular: string            // com DDD; o mapper separa
  telefone?: string | null

  // Exigidos só na análise completa
  dataNascimento?: string | null   // ISO (yyyy-MM-dd) — o mapper converte
  sexo?: 'M' | 'F' | null
  empresaMais2anos?: boolean | null

  // Só quando o imóvel é comercial
  cnae?: string | null
  capitalInicial?: number | null
  capitalGiro?: number | null
}

export interface SolidarioInput {
  nome: string
  cpf: string
  dataNascimento: string     // ISO
}

export interface ImovelSeguroInput {
  cep: string
  endereco?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null

  aluguel: number
  condominio?: number | null
  iptu?: number | null
  gas?: number | null
  energia?: number | null
  agua?: number | null

  pinturaNova: boolean
  finalidade: Finalidade
  tipo?: string | null              // vocabulário do nosso cadastro
  periodoContratoMeses: number
}

export interface AnaliseInput {
  produto: ProdutoSeguro
  tipoAnalise: TipoAnalise
  seguradoras?: string[]            // siglas; vazio = todas as disponíveis
  pretendente: PretendenteInput
  solidarios?: SolidarioInput[]     // no máximo 3
  imovel: ImovelSeguroInput
}

/* ── Saída ─────────────────────────────────────────────────────────── */

export interface Seguradora {
  nome: string
  sigla: string
  aceitaAnaliseReduzida: boolean
}

export interface Parecer {
  seguradoraSigla: string
  seguradoraNome: string | null
  codigoStatus: number | null
  descricaoStatus: string | null
  codigoAnalise: string | null
  limiteAprovado: number | null
  statusBiometria: number | null
  linkBiometria: string | null
  msg: string | null
}

export interface ResultadoAnalise {
  idExterno: number
  pareceres: Parecer[]
}

export interface ArquivoRecebido {
  seguradoraSigla: string | null
  codigoTipo: number
  descricao: string | null
  base64: string
}

/* ── Preços ────────────────────────────────────────────────────────── */

export interface OpcaoPagamento {
  formaPagamento: string          // "Fatura", "Boleto", "Cartão de Crédito"…
  tipoPlano: string               // basic / complete / traditional
  qtdParcelas: number
  valorParcela: number
  comEntrada: boolean
}

export interface PlanosPreco {
  basico: OpcaoPagamento[]
  completo: OpcaoPagamento[]
  tradicional: OpcaoPagamento[]
}

/* ── Contratação ───────────────────────────────────────────────────── */

export interface Coberturas {
  condominio?: number
  gas?: number
  iptu?: number
  energia?: number
  agua?: number
  danos?: boolean
  pinturaInterna?: boolean
  pinturaExterna?: boolean
  multa?: boolean
}

export interface ProprietarioInput {
  tipo: TipoPessoa
  nome: string
  cpfCnpj: string
  rg?: string | null
  dataNascimento?: string | null   // ISO
  estadoCivil?: string | null      // texto do CRM; o mapper converte
}

export interface ContratacaoInput {
  idAnaliseExterno: number
  seguradoraSigla: string

  inicioVigencia: string           // ISO
  fimVigencia: string              // ISO
  indiceReajuste?: string | null   // texto do CRM ('IGPM'…)

  opcao: OpcaoPagamento
  premioTotal: number
  coberturas: Coberturas

  imovel: { cep: string; endereco: string; bairro: string; cidade: string; uf: string }
  proprietario: ProprietarioInput
  observacoes?: string | null

  // Sem cartão de propósito: trafegar PAN nos coloca no escopo do
  // PCI-DSS. As formas fatura/boleto/ficha cobrem o caso de uso.
}

/* ── Erros ─────────────────────────────────────────────────────────── */

export class SeguroApiError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
    readonly httpStatus?: number,
    readonly corpo?: unknown,
  ) {
    super(message)
    this.name = 'SeguroApiError'
  }
}
