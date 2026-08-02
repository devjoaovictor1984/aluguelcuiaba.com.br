/**
 * Domínio do seguro incêndio.
 *
 * Separado da fiança de propósito: lá existe análise de crédito com N
 * pareceres; aqui é cálculo e contratação, sem aprovação. Compartilhar
 * tipos faria os dois fluxos se contaminarem.
 */

export type TipoSeguro = 'R' | 'C'
export type TipoPessoa = 'F' | 'J'

/** 0 = anual · 1 = mensalizado (cobrado junto do aluguel). */
export type TipoVigencia = 0 | 1

/**
 * 2 prédio + conteúdo · 3 só prédio ·
 * 4 prédio 90% / conteúdo 10% · 5 prédio 85% / conteúdo 15%
 */
export type TipoCobertura = 2 | 3 | 4 | 5

export const COBERTURA_LABEL: Record<TipoCobertura, string> = {
  2: 'Prédio e conteúdo',
  3: 'Somente prédio',
  4: 'Prédio (90%) e conteúdo (10%)',
  5: 'Prédio (85%) e conteúdo (15%)',
}

export const VIGENCIA_LABEL: Record<TipoVigencia, string> = {
  0: 'Anual',
  1: 'Mensalizado',
}

/** Só a Porto aceita cartão, e com os campos de PAN que não trafegamos. */
export const BANDEIRAS_CARTAO: Record<number, string> = {
  1: 'Visa',
  2: 'Master',
  3: 'Diners',
  5: 'Elo',
}

/* ── Catálogo ──────────────────────────────────────────────────────── */

export interface Ocupacao {
  nome: string
  rubrica: string
  cdresp2: string
}

export interface PacoteAssistencia {
  codigo: number
  tipo: string
  descricao: string
}

/* ── Entrada ───────────────────────────────────────────────────────── */

export interface PessoaIncendio {
  tipo: TipoPessoa
  nome: string
  cpfCnpj: string
  email?: string | null
  dataNascimento?: string | null   // ISO; o mapper converte
  sexo?: 'M' | 'F' | null
  telefone?: string | null
}

export interface EnderecoSeguro {
  cep: string
  endereco?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  uf: string
}

/** Limites de cada cobertura. Zero ou ausente = não contrata a cobertura. */
export interface ValoresCobertura {
  incendio?: number
  perdaAluguel?: number
  vendaval?: number
  respCivil?: number
  danosEletricos?: number
  vazamento?: number
  conteudo?: number        // Porto
  impactoVeiculo?: number  // Porto
}

export interface CalculoIncendioInput {
  seguradora: string
  cnpjImobiliaria: string
  aluguel: number

  tipoSeguro: TipoSeguro
  tipoCobertura: TipoCobertura
  tipoVigencia: TipoVigencia
  ocupacao: Pick<Ocupacao, 'rubrica' | 'cdresp2'>
  pacoteAssistencia: number

  inquilino: PessoaIncendio
  proprietario: PessoaIncendio
  proprietarioSegurado?: boolean   // Porto

  endereco: EnderecoSeguro
  inicioVigencia: string           // ISO
  fimVigencia: string              // ISO

  valores: ValoresCobertura
}

export interface ContratacaoIncendioInput extends CalculoIncendioInput {
  /** Máximo 6, conforme a documentação. */
  qtdParcelas: number
  formaPagtoCodigo?: string | null
  formaPagtoDescricao?: string | null

  // Sem campos de cartão: trafegar PAN nos põe no escopo do PCI-DSS.
}

/* ── Saída ─────────────────────────────────────────────────────────── */

export interface CoberturaCalculada {
  codigo: string
  nome: string
  limite: number       // LMI — valor segurado
  premio: number
  franquia: string | null
}

export interface ParcelaPagamento {
  descricao: string
  qtdParcelas: number
  valorParcela: number
}

export interface FormaPagamento {
  codigo: string
  parcelas: ParcelaPagamento[]
}

export interface ResultadoCalculo {
  coberturas: CoberturaCalculada[]
  formasPagamento: FormaPagamento[]
  premio: number
  valorAssistencia: number
  premioLiquido: number
  iof: number
}

export interface ResultadoContratacao {
  codigoSeguro: string
  numeroProposta: string
}

/* ── Documentos ────────────────────────────────────────────────────── */

export interface DocumentosProposta {
  certificadoBase64: string | null
  propostaBase64: string | null
  numeroProposta: string | null
}

export interface BoletoParcela {
  base64: string
  numParcela: number
  dataVencimento: string | null
  dataPagamento: string | null
}

/* ── Faturamento ───────────────────────────────────────────────────── */

export interface ItemFatura {
  codigo: string
  cnpjImobiliaria: string
  cdconseg: string | null
  cdemi: string | null
  numeroProposta: string | null
  dataCobertura: string | null
  inquilino: string | null
  proprietario: string | null
  localRisco: string | null
  parcelas: number | null
  valorParcela: number | null
  premioTotal: number | null
}

export interface Faturamento {
  vigencia: 'mensalizado' | 'anual'
  ramo: 'residencial' | 'comercial'
  itens: ItemFatura[]
  base64: string | null
}
