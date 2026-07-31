/**
 * Tabelas de domínio da API Maximiza (fiança v1).
 *
 * Transcritas do PDF `api.fianca.pdf`, seção 10 "TABELAS DE TIPOS".
 * Vivem isoladas aqui porque mapeamento de enum é onde integração quebra
 * calada — nenhum outro arquivo deve montar esses valores na mão.
 *
 * ⚠️ A doc se contradiz sobre o status: as páginas 9 e 10 dizem
 * "Aprovado(1), Reprovado(2), Em Análise(3)", mas a tabela oficial da
 * página 23 (e o OpenAPI) dizem 2=Em Análise e 3=Recusado. Seguimos a
 * tabela. Regra geral: SEMPRE ler `codigoStatus`, nunca `descricaoStatus`.
 */

/* ── Status da análise ─────────────────────────────────────────────── */

export const STATUS_ANALISE = {
  0:  'Erro não detalhado pela seguradora',
  1:  'Aprovado',
  2:  'Em análise',
  3:  'Recusado',
  4:  'Pendente / problema na análise',
  5:  'Aprovado com limite inferior ao solicitado',
  6:  'Cancelado',
  7:  'Expirada',
  8:  'Aguardando emissão',
  12: 'Pré-aprovado',
} as const

export type CodigoStatus = keyof typeof STATUS_ANALISE

/** Dá pra seguir pra contratação? Inclui o limite inferior — é aprovação parcial. */
export function statusAprovado(codigo: number | null | undefined): boolean {
  return codigo === 1 || codigo === 5
}

/** Acabou e não deu — só reanálise resolve. */
export function statusTerminalNegativo(codigo: number | null | undefined): boolean {
  return codigo === 3 || codigo === 6 || codigo === 7
}

/** Ainda vai mudar sozinho: vale esperar webhook / consultar de novo. */
export function statusPendente(codigo: number | null | undefined): boolean {
  return codigo === 2 || codigo === 4 || codigo === 8 || codigo === 12
}

/* ── Biometria ─────────────────────────────────────────────────────── */

export const STATUS_BIOMETRIA = {
  0: 'Aguardando',
  1: 'Aprovado',
  2: 'Cancelado',
  3: 'Recusado',
} as const

/* ── Tipos de arquivo ──────────────────────────────────────────────── */

export const TIPO_ARQUIVO = {
  1: 'Ficha cadastral',
  2: 'Carta parecer',
  3: 'Cotação',
  4: 'Contrato de locação',
  5: 'Vistoria',
  8: 'Proposta',
  9: 'Apólice',
} as const

export const TIPO_ARQUIVO_APOLICE = 9

/* ── Estado civil ──────────────────────────────────────────────────── */

const ESTADO_CIVIL_MAXIMIZA = {
  solteiro:     '0',
  casado:       '1',
  divorciado:   '2',
  viuvo:        '3',
  separado:     '4',
  companheiro:  '5',
} as const

/**
 * `pessoas.estado_civil` é texto livre no nosso CRM. Normaliza (sem acento,
 * minúsculo) e casa com o código deles. Devolve null quando não reconhece —
 * quem chama decide se pede o dado ao usuário.
 */
export function estadoCivilParaMaximiza(valor: string | null | undefined): string | null {
  if (!valor) return null
  const v = valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  if (v.startsWith('solteir'))    return ESTADO_CIVIL_MAXIMIZA.solteiro
  if (v.startsWith('casad'))      return ESTADO_CIVIL_MAXIMIZA.casado
  if (v.startsWith('divorciad'))  return ESTADO_CIVIL_MAXIMIZA.divorciado
  if (v.startsWith('viuv'))       return ESTADO_CIVIL_MAXIMIZA.viuvo
  if (v.startsWith('separad'))    return ESTADO_CIVIL_MAXIMIZA.separado
  if (v.startsWith('companheir') || v.startsWith('uniao')) return ESTADO_CIVIL_MAXIMIZA.companheiro
  return null
}

/* ── Índice de reajuste ────────────────────────────────────────────── */

/** `contratos_locacao.indice_reajuste` é texto ('IGPM', 'IPCA'…). */
export function indiceReajusteParaMaximiza(valor: string | null | undefined): string | null {
  if (!valor) return null
  const v = valor.toUpperCase().replace(/[\s\-_.()]/g, '')
  if (v.startsWith('IGPM'))  return '1'
  if (v.startsWith('IGPDI')) return '2'
  if (v.startsWith('IPCFIPE')) return '3'
  if (v.startsWith('IPCA'))  return '4'
  if (v.startsWith('INPC'))  return '5'
  if (v.startsWith('ICV'))   return '6'
  if (v.startsWith('INCC'))  return '7'
  if (v.startsWith('IPCFGV') || v === 'IPC') return '8'
  if (v.startsWith('IVAR'))  return '10'
  return null
}

/* ── Tipo de imóvel ────────────────────────────────────────────────── */

export const TIPOS_IMOVEL_RESIDENCIAL = ['APARTAMENTO', 'CASA', 'SOBRADO'] as const

export const TIPOS_IMOVEL_COMERCIAL = [
  'SALA COMERCIAL EM CONDOMÍNIO',
  'SALA COMERCIAL',
  'LOJA',
  'LOJA EM GALERIA COMERCIAL',
  'LOJA EM SMALL CENTERS',
  'LOJA DE SHOPPING',
  'PRÉDIO',
  'PRÉDIO EM CONDOMÍNIO',
  'GALPÃO',
  'GALPÃO EM CONDOMÍNIO',
] as const

/** Mapeia o tipo do nosso cadastro pro vocabulário deles. */
export function tipoImovelParaMaximiza(
  tipo: string | null | undefined,
  finalidade: 'R' | 'C',
): string | null {
  if (!tipo) return null
  const v = tipo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

  if (finalidade === 'R') {
    if (v.includes('apartamento') || v.includes('apto')) return 'APARTAMENTO'
    if (v.includes('sobrado')) return 'SOBRADO'
    if (v.includes('casa')) return 'CASA'
    return null
  }

  if (v.includes('galpao')) return 'GALPÃO'
  if (v.includes('predio')) return 'PRÉDIO'
  if (v.includes('shopping')) return 'LOJA DE SHOPPING'
  if (v.includes('galeria')) return 'LOJA EM GALERIA COMERCIAL'
  if (v.includes('loja')) return 'LOJA'
  if (v.includes('sala')) return 'SALA COMERCIAL'
  return null
}

/* ── Natureza de renda ─────────────────────────────────────────────── */

export const NATUREZAS_RENDA = [
  'APOSENTADO/PENSIONISTA',
  'AUTONOMO',
  'EMPRESARIO',
  'ESTUDANTE',
  'FUNCIONARIO PUBLICO',
  'FUNCIONARIO COM REGISTRO CLT',
  'PROFISSIONAL LIBERAL',
  'RENDA PROVENIENTE DE ALUGUEIS',
] as const

export type NaturezaRenda = (typeof NATUREZAS_RENDA)[number]
