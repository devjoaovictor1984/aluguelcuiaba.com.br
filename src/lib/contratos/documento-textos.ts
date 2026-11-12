/**
 * Regras do documento do contrato que não dependem de banco: cláusula vazia,
 * duplicidade de assunto e os textos padrão editáveis (tabela, inventário e
 * termo de chaves). Leve, serve ao editor (cliente) e à rota do PDF.
 *
 * Precedência dos textos editáveis: texto personalizado da geração
 * (`capa_overrides[chave]`) > padrão atual > padrão legado. O padrão legado
 * só vale para contrato que já tem processo de assinatura, para a via final
 * sair igual ao que os signatários leram.
 */
import type { ItemChecklist } from './checklist'

// ── Cláusula vazia ──────────────────────────────────────────────────

/**
 * Corpo sem texto visível: só tags vazias do editor (`<p></p>`, `<br>`),
 * `&nbsp;`, espaços ou caracteres invisíveis. Tabela, lista ou qualquer
 * texto, ainda que curto, não é vazio.
 */
export function corpoVazio(corpo: string | null | undefined): boolean {
  // Estrutura que o editor usa e que conta como conteúdo mesmo sem texto.
  if (/<(table|img|hr)\b/i.test(corpo ?? '')) return false
  const s = (corpo ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/[\s ​-‍﻿]/g, '')
  return s.length === 0
}

export function separarClausulasVazias<T extends { corpo: string }>(lista: T[]): { mantidas: T[]; ignoradas: T[] } {
  const mantidas: T[] = []
  const ignoradas: T[] = []
  for (const c of lista) (corpoVazio(c.corpo) ? ignoradas : mantidas).push(c)
  return { mantidas, ignoradas }
}

export function verificarClausulasVazias(lista: Array<{ titulo: string; corpo: string }>): ItemChecklist[] {
  return lista
    .filter(c => corpoVazio(c.corpo))
    .map((c, i) => ({
      id: `clausula_vazia_${i}`,
      rotulo: `Cláusula sem texto: "${c.titulo || 'sem título'}"`,
      severidade: 'warn' as const,
      mensagem: 'Fica fora do PDF e do sumário, e a numeração é refeita. Escreva o texto ou remova a cláusula.',
    }))
}

// ── Cláusulas automáticas e duplicidade ─────────────────────────────

/**
 * Cláusulas que o sistema monta a partir dos participantes. Quando o
 * operador personaliza uma delas, a cópia vai para as cláusulas do contrato
 * com `origem` e a automática deixa de ser gerada.
 */
export const ORIGENS_AUTOMATICAS = {
  usuario_autorizado: {
    rotulo: 'Usuário autorizado',
    assunto: /usu[aá]rio\s+(comercial\s+)?autorizado|ocupante\s+autorizado/i,
  },
  titularidade: {
    rotulo: 'Titularidade das contas de consumo',
    assunto: /titularidade|contas?\s+de\s+consumo|energia\s+el[eé]trica/i,
  },
} as const

export type OrigemAutomatica = keyof typeof ORIGENS_AUTOMATICAS

export const ehOrigemAutomatica = (v: unknown): v is OrigemAutomatica =>
  typeof v === 'string' && v in ORIGENS_AUTOMATICAS

const normalizarTitulo = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Possíveis duplicidades, só como alerta (nunca remove nada):
 *  - cláusula do contrato sobre o mesmo assunto de uma automática ativa;
 *  - duas cláusulas do contrato com o mesmo título.
 */
export function verificarDuplicidades(
  clausulas: Array<{ titulo: string; origem?: string | null }>,
  automaticasAtivas: Array<{ origem: OrigemAutomatica; titulo: string }>,
): ItemChecklist[] {
  const itens: ItemChecklist[] = []
  for (const a of automaticasAtivas) {
    const parecidas = clausulas.filter(c => !c.origem && ORIGENS_AUTOMATICAS[a.origem].assunto.test(c.titulo))
    for (const c of parecidas) {
      itens.push({
        id: `duplicidade_${a.origem}_${normalizarTitulo(c.titulo).replace(/ /g, '_')}`,
        rotulo: `Possível duplicidade: "${c.titulo}"`,
        severidade: 'warn',
        mensagem: `Trata do mesmo assunto da cláusula automática "${a.titulo}". Remova uma delas, ou personalize a automática e junte os textos nela.`,
      })
    }
  }
  const vistos = new Map<string, string>()
  for (const c of clausulas) {
    const k = normalizarTitulo(c.titulo)
    if (!k) continue
    if (vistos.has(k)) {
      itens.push({
        id: `duplicidade_titulo_${k.replace(/ /g, '_')}`,
        rotulo: `Título repetido: "${c.titulo}"`,
        severidade: 'warn',
        mensagem: 'Duas cláusulas do contrato têm o mesmo título. Confira se não é a mesma cláusula duas vezes.',
      })
    } else vistos.set(k, c.titulo)
  }
  return itens
}

// ── Textos padrão editáveis ─────────────────────────────────────────

/** Chaves de `contrato_geracoes.capa_overrides` usadas fora da capa. */
export const CHAVES_DOCUMENTO = {
  tabela_observacao: 'tabela_observacao',
  inventario_declaracao: 'inventario_declaracao',
  termo_titulo: 'termo_titulo',
  termo_endereco: 'termo_endereco',
  termo_texto_entrega: 'termo_texto_entrega',
  termo_observacoes: 'termo_observacoes',
  termo_devolucao: 'termo_devolucao',
  termo_quem_recebe: 'termo_quem_recebe',
} as const

export const TABELA_OBSERVACAO_LEGADO = 'Após esse período, o aluguel será reajustado anualmente conforme cláusula de reajuste.'
export const TABELA_OBSERVACAO_PADRAO =
  'Após esse período, os valores seguem as condições de valor, escalonamento e reajuste previstas nas cláusulas deste contrato.'

export const INVENTARIO_DECLARACAO_LEGADO =
  'Os LOCATÁRIOS declaram receber os bens no estado descrito e obrigam-se a devolvê-los nas mesmas condições, ressalvado o desgaste natural.'

/** Singular/plural pelo número de locatários; cita o usuário autorizado quando há. */
export function declaracaoInventarioPadrao(args: { locatarios: number; usuarioAutorizado?: string | null }): string {
  const plural = args.locatarios > 1
  const sujeito = plural ? 'Os LOCATÁRIOS declaram' : 'O LOCATÁRIO declara'
  const obriga = plural ? 'obrigam-se' : 'obriga-se'
  const usuario = args.usuarioAutorizado
    ? `, inclusive quando recebidos por intermédio do ${args.usuarioAutorizado.toUpperCase()},`
    : ''
  return `${sujeito} receber os bens no estado descrito${usuario} e ${obriga} a devolvê-los nas mesmas condições, ressalvado o desgaste natural.`
}

export const TERMO_TITULO_PADRAO = 'Termo de Entrega de Chaves'

export const TERMO_DEVOLUCAO_LEGADO =
  'O LOCATÁRIO declara ciência de que a devolução do imóvel somente será considerada válida mediante entrega formal de todas as chaves, controles, tags e acessos, realização de vistoria final e quitação das obrigações pendentes, conforme cláusulas contratuais.'

/**
 * A devolução das chaves não fica condicionada à quitação nem à concordância
 * com a vistoria: pendências e danos são apurados e cobrados à parte.
 */
export const TERMO_DEVOLUCAO_PADRAO =
  'Ao final da locação, a devolução do imóvel se formaliza com a entrega de todas as chaves, controles, tags e acessos à ADMINISTRADORA ou ao LOCADOR, mediante recibo. A vistoria final será agendada para a mesma ocasião ou logo em seguida, e eventuais débitos, consumos ou danos apurados serão cobrados na forma do contrato, sem que o recebimento das chaves dependa de sua prévia quitação e sem que esse recebimento importe quitação.'

export type QuemRecebe = 'todos' | 'usuario'

export const OPCOES_QUEM_RECEBE: Array<{ valor: QuemRecebe; rotulo: string }> = [
  { valor: 'todos', rotulo: 'Locatário e usuário autorizado recebem' },
  { valor: 'usuario', rotulo: 'Só o usuário autorizado recebe; o locatário assina ciente' },
]

/** Valor personalizado não vazio, ou null. */
export function textoPersonalizado(ov: Record<string, unknown> | null | undefined, chave: string): string | null {
  const v = ov?.[chave]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}
