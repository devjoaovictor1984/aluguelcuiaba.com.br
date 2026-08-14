import type { Parecer } from './tipos'
import { statusAprovado, statusPendente, statusPreAprovado } from './tabelas'

/**
 * Status resumido da análise — o nosso, não o da API.
 *
 * Fica separado de `pareceres.ts` (que é server-only, por causa do client
 * do Supabase) porque as telas do cliente precisam dos rótulos.
 */

/**
 * Reduz N pareceres a um status só, pra listar e filtrar sem join.
 *
 * Vale o melhor resultado: uma aprovação entre quatro recusas é uma
 * análise aprovada — o corretor fecha com essa seguradora.
 *
 * `pre_aprovado` fica ENTRE aprovado e analisando, e é um degrau próprio de
 * propósito. Dobrá-lo em "Em análise" esconderia do corretor a única coisa
 * que ele pode fazer para destravar o negócio (mandar o link da biometria);
 * dobrá-lo em "Aprovado" o faria prometer ao proprietário uma aprovação que
 * ainda pode virar recusa.
 */
export function resumirStatus(pareceres: Pick<Parecer, 'codigoStatus'>[]): string {
  if (!pareceres.length) return 'enviando'
  if (pareceres.some(p => statusAprovado(p.codigoStatus))) return 'aprovado'
  if (pareceres.some(p => statusPreAprovado(p.codigoStatus))) return 'pre_aprovado'
  if (pareceres.some(p => statusPendente(p.codigoStatus))) return 'analisando'
  if (pareceres.some(p => p.codigoStatus === 3)) return 'recusado'
  return 'erro'
}

export const STATUS_RESUMO_LABEL: Record<string, string> = {
  enviando:     'Enviando',
  analisando:   'Em análise',
  pre_aprovado: 'Pré-aprovado',
  aprovado:     'Aprovado',
  recusado:     'Recusado',
  erro:         'Erro',
}

// Violeta pro pré-aprovado: é a cor da biometria no resto do módulo, e o
// que falta nesse estado é justamente a biometria. Verde diria "fechado".
export const STATUS_RESUMO_COR: Record<string, string> = {
  enviando:     'bg-gray-100 text-gray-600',
  analisando:   'bg-amber-100 text-amber-700',
  pre_aprovado: 'bg-violet-100 text-violet-700',
  aprovado:     'bg-green-100 text-green-700',
  recusado:     'bg-red-100 text-red-700',
  erro:         'bg-red-100 text-red-700',
}
