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

/* ── Seguradoras ───────────────────────────────────────────────────── */

/**
 * As quatro seguradoras integradas por API.
 *
 * O painel da Maximiza também lista a Junto, mas ela aparece sem o selo
 * "API" — é atendimento manual por lá. Filtramos aqui pra não oferecer no
 * sistema o que a integração não consegue cotar.
 *
 * A lista viva continua vindo de `/seguradorasAnalise`; isto é só o
 * crivo. Se a Junto (ou outra) entrar por API, basta somar a sigla.
 */
export const SEGURADORAS_API = ['too', 'tok', 'ptc', 'por'] as const

/**
 * A sigla da Porto é `por` — resolvido contra a API viva em 14/08/2026,
 * não pela documentação (que se contradizia entre "porto" e "por"):
 * `GET /apiFiancaAnalise/seguradorasAnalise` devolve
 * `{"seguradora":"Porto","sigla":"por"}`.
 *
 * Canônico é o que a API fala. "porto" fica como alias de entrada porque
 * pareceres gravados antes desta correção usavam essa forma.
 */
const ALIAS_SIGLA: Record<string, string> = { porto: 'por' }

export function normalizarSigla(sigla: string | null | undefined): string {
  const s = (sigla ?? '').toLowerCase().trim()
  return ALIAS_SIGLA[s] ?? s
}

/** A seguradora é cotável pela integração? */
export function seguradoraIntegrada(sigla: string | null | undefined): boolean {
  return (SEGURADORAS_API as readonly string[]).includes(normalizarSigla(sigla))
}

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

/**
 * Dá pra CONTRATAR? Inclui o limite inferior — é aprovação parcial.
 *
 * ⚠️ Regra da Maximiza (13/08/2026): a análise de crédito não devolve
 * "aprovado" — ela para em PRÉ-APROVADO (12). O 1/5 só aparece depois que
 * a biometria confirma que o pretendente é quem diz ser. Pré-aprovado é
 * financeiro OK e identidade não verificada, e é exatamente aí que mora a
 * fraude que a biometria existe pra pegar: contratar antes disso é fechar
 * apólice em cima de aprovação que ainda pode virar recusa.
 *
 * Por isso 12 NÃO entra aqui, e nenhuma tela deve tratá-lo como aprovação.
 */
export function statusAprovado(codigo: number | null | undefined): boolean {
  return codigo === 1 || codigo === 5
}

/**
 * Financeiro aprovado, biometria pendente. Estado intermediário e
 * reversível: daqui vai pra aprovado (1) ou pra recusado (3) — a Maximiza
 * confirmou que o caminho de volta acontece, por golpe ou erro de sistema.
 */
export function statusPreAprovado(codigo: number | null | undefined): boolean {
  return codigo === 12
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

/* ── Pessoa jurídica e imóvel comercial ────────────────────────────── */

/** Tabela TIPO EMPRESA. Os valores vão como estão — a doc pede respeitar maiúsculas. */
export const TIPOS_EMPRESA = [
  'Ltda',
  'Individual/ME',
  'S.A. Capital Aberto',
  'S.A Capital Fechado',
  'Sem Fins Lucrativos',
  'Pública',
] as const

/** Tabela OPÇÃO TRIBUTÁRIA. */
export const OPCOES_TRIBUTARIAS = [
  'Simples Nacional',
  'Lucro Presumido',
  'Lucro Real',
] as const

/** Tabela RAMO ATIVIDADE — em minúsculas na doc, e isso importa. */
export const RAMOS_ATIVIDADE = ['comércio', 'serviços', 'indústria'] as const

/**
 * Tabela TIPO FRANQUEADORA.
 *
 * Só é exigida quando `trataDeFranquia = S` em imóvel comercial. "Outra"
 * (21152) cobre o que não está na lista, então a ausência de uma marca
 * não bloqueia a análise.
 */
export const FRANQUEADORAS: { codigo: string; nome: string }[] = [
  { codigo: '21153', nome: '5àsec' },
  { codigo: '21155', nome: 'Am Pm Mini Market' },
  { codigo: '21156', nome: 'Arezzo' },
  { codigo: '21157', nome: "Bob's" },
  { codigo: '21158', nome: 'BR Mania' },
  { codigo: '21159', nome: 'Cacau Show' },
  { codigo: '21160', nome: 'Carmen Steffens' },
  { codigo: '21161', nome: 'Casa de Bolos' },
  { codigo: '21162', nome: 'CCAA' },
  { codigo: '21163', nome: 'Chilli Beans' },
  { codigo: '21164', nome: 'Chiquinho Sorvetes' },
  { codigo: '21165', nome: 'Chocolates Brasil Cacau' },
  { codigo: '21166', nome: 'CNA' },
  { codigo: '21167', nome: 'Correios' },
  { codigo: '21168', nome: 'CVC Brasil' },
  { codigo: '21169', nome: 'Dia%' },
  { codigo: '21170', nome: 'Drogarias Farmais' },
  { codigo: '21171', nome: 'Farmácias FTB' },
  { codigo: '21172', nome: 'Fisk Centro de Ensino' },
  { codigo: '21173', nome: 'Giraffas' },
  { codigo: '21174', nome: "Habib's" },
  { codigo: '21175', nome: 'Havaianas' },
  { codigo: '21176', nome: 'Hering Store' },
  { codigo: '21177', nome: 'Igui' },
  { codigo: '21178', nome: 'Instituto Embelleze' },
  { codigo: '21179', nome: 'Jet Oil' },
  { codigo: '21180', nome: 'Kopenhagen' },
  { codigo: '21181', nome: 'Kumon' },
  { codigo: '21182', nome: 'Localiza Rent a Car' },
  { codigo: '21183', nome: 'Lubrax +' },
  { codigo: '21184', nome: "McDonald's" },
  { codigo: '21185', nome: 'Microlins' },
  { codigo: '21186', nome: 'Morana' },
  { codigo: '21187', nome: 'Mundo Verde' },
  { codigo: '21188', nome: 'Não+Pêlo' },
  { codigo: '21189', nome: 'Nosso Bar' },
  { codigo: '21190', nome: 'O Boticário' },
  { codigo: '21191', nome: 'Óticas Carol' },
  { codigo: '21192', nome: 'Óticas Diniz' },
  { codigo: '21193', nome: 'Piticas Moda Criativa' },
  { codigo: '21194', nome: 'Prepara Cursos Profissionalizantes' },
  { codigo: '21195', nome: 'Rei do Mate' },
  { codigo: '21196', nome: 'Seguralta - Bolsa de Seguros' },
  { codigo: '21197', nome: 'Sobrancelhas Design' },
  { codigo: '21198', nome: 'Sodiê Doces' },
  { codigo: '21199', nome: 'Spa das Sobrancelhas' },
  { codigo: '21200', nome: 'Spoleto' },
  { codigo: '21201', nome: 'Wizard by Pearson' },
  { codigo: '21202', nome: 'Yázigi' },
  { codigo: '21152', nome: 'Outra' },
]

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
