import { SeguroApiError } from './tipos'

/**
 * Tradução de falha da corretora para frase que o corretor entende.
 *
 * Antes as actions devolviam `e.message` cru, que é escrito para log:
 * "Maximiza respondeu 500 em /apiFiancaAnalise/transmitirAnalise". Isso
 * vaza nome de endpoint na tela, não diz o que fazer, e no link público
 * chega a aparecer para o inquilino.
 *
 * O detalhe técnico não se perde — ele vai inteiro para `seguro_eventos`,
 * com corpo da resposta. Aqui fica só o que ajuda quem está olhando.
 */

/** A mensagem que a corretora mandou no corpo do erro, se houver alguma. */
function mensagemDaCorretora(corpo: unknown): string | null {
  if (!corpo) return null
  if (typeof corpo === 'string') return corpo.trim().slice(0, 300) || null
  if (typeof corpo !== 'object') return null

  const o = corpo as Record<string, unknown>
  for (const campo of ['message', 'msg', 'erro', 'error', 'descricao', 'descricaoStatus']) {
    const v = o[campo]
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 300)
  }
  return null
}

/**
 * Medido em 16/08/2026: o 500 deles vem com `{"statusCode":500,
 * "message":"Internal server error"}`. Repetir isso na tela não informa
 * nada — em 5xx a mensagem própria vale mais que a deles.
 */
export function mensagemDeErro(e: unknown, fallback = 'Não foi possível concluir o envio para a corretora.'): string {
  if (!(e instanceof SeguroApiError)) {
    if (e instanceof Error && /timeout|aborted|fetch failed|network/i.test(e.message)) {
      return 'A corretora não respondeu a tempo. Tente de novo em alguns minutos.'
    }
    return fallback
  }

  const status = e.httpStatus ?? 0

  // Sem status: nem chegou a falar com eles (rede, timeout, credencial ausente).
  if (status === 0) {
    return 'Não foi possível falar com a corretora agora. Tente de novo em alguns minutos.'
  }
  if (status >= 500) {
    return 'A corretora está instável e não concluiu o pedido. O registro ficou salvo aqui — tente de novo em alguns minutos.'
  }
  if (status === 401 || status === 403) {
    return 'A corretora recusou nossa credencial de acesso. Isso é configuração da integração, não o cadastro do cliente.'
  }
  if (status === 429) {
    return 'Muitas consultas seguidas na corretora. Espere um minuto e tente de novo.'
  }

  const daCorretora = mensagemDaCorretora(e.corpo)
  if (daCorretora) return `A corretora recusou: ${daCorretora}`

  return 'A corretora recusou o pedido sem informar o motivo. O detalhe ficou no histórico de integração.'
}
