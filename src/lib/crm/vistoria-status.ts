/**
 * Situação de assinatura da vistoria (v99).
 *
 * A vistoria é assinada pelos dois lados, em qualquer ordem — o inquilino
 * pelo magic link, a administradora pelo painel. Como os dois pontos de
 * entrada podem ser o último a assinar, a regra mora aqui e não em cada um.
 *
 * 'assinada' continua querendo dizer "o inquilino assinou", que é o que
 * sempre quis dizer: vistoria anterior à v99 fica com a contra-assinatura
 * pendente, que é a verdade sobre ela.
 */

export type StatusVistoria =
  | 'rascunho' | 'enviada'
  | 'assinada' | 'assinada_locador' | 'concluida'
  | 'recusada'

export function statusAposAssinaturaVistoria(
  statusAtual: string,
  quemAssinou: 'inquilino' | 'locador',
): 'assinada' | 'assinada_locador' | 'concluida' {
  if (quemAssinou === 'inquilino') {
    return statusAtual === 'assinada_locador' ? 'concluida' : 'assinada'
  }
  return statusAtual === 'assinada' ? 'concluida' : 'assinada_locador'
}

export function inquilinoAssinou(status: string): boolean {
  return status === 'assinada' || status === 'concluida'
}

export function locadorAssinou(status: string): boolean {
  return status === 'assinada_locador' || status === 'concluida'
}

/** Assinada por quem tinha que assinar — nada mais pendente. */
export function vistoriaConcluida(status: string): boolean {
  return status === 'concluida'
}

/**
 * A administradora só assina depois que o link saiu: é o envio que congela
 * os itens que estão sendo assinados. Assinar antes disso seria assinar um
 * laudo que ainda pode mudar.
 */
export function podeLocadorAssinar(status: string): boolean {
  return status === 'enviada' || status === 'assinada'
}

/** Alguma das partes já assinou — o documento não é mais só rascunho. */
export function temAlgumaAssinatura(status: string): boolean {
  return inquilinoAssinou(status) || locadorAssinou(status)
}
