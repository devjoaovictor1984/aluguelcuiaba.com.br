import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Baixa das parcelas quando o contrato termina.
 *
 * Vive fora das actions porque TRÊS caminhos encerram contrato —
 * encerrarContrato, renovarContrato (que encerra o anterior) e
 * atualizarContrato (que aceita status direto). Cada um repetindo a regra
 * é como o bug nasceu: nenhum dos três a tinha.
 */

/**
 * Dois filtros, e confundi-los custa caro — já custou uma vez.
 *
 * FORA_DA_COBRANCA remove pago E cancelada. Só serve onde a tela lista
 * o que ainda se cobra: /cobrancas e o cron de avisos.
 *
 * CANCELADA remove só o que deixou de ser devido. É o que vale em
 * financeiro, comissões, início e relatórios — ali a parcela PAGA é o
 * conteúdo principal (aluguel recebido, comissão ganha, extrato), e
 * escondê-la faz o histórico sumir da tela.
 */
export const STATUS_FORA_DA_COBRANCA = '(pago,cancelada)'
export const STATUS_CANCELADA = '(cancelada)'

/**
 * Cancela as parcelas que vencem DEPOIS do fim do contrato.
 *
 * As de até a data de corte continuam devidas — rescisão não perdoa
 * aluguel atrasado. Parcela já paga nunca é tocada.
 *
 * Idempotente: rodar de novo não muda nada.
 */
export async function cancelarParcelasFuturas(
  supabase: SupabaseClient,
  contratoId: string,
  dataCorte: string | null | undefined,
  motivo: string,
): Promise<{ canceladas: number; error?: string }> {
  // Sem data de corte não há como saber o que é "futuro"; cancelar tudo
  // apagaria cobrança legítima.
  if (!dataCorte) return { canceladas: 0 }

  const { data, error } = await supabase
    .from('parcelas_aluguel')
    .update({
      status_pagamento: 'cancelada',
      cancelada_em: new Date().toISOString(),
      cancelada_motivo: motivo,
      updated_at: new Date().toISOString(),
    })
    .eq('contrato_id', contratoId)
    .gt('vencimento', dataCorte)
    .not('status_pagamento', 'in', '(pago,cancelada)')
    .select('id')

  if (error) return { canceladas: 0, error: error.message }
  return { canceladas: data?.length ?? 0 }
}

/**
 * Reabre parcelas canceladas de um contrato.
 *
 * Necessário quando o contrato volta a ser ativo — encerramento feito por
 * engano, ou data de encerramento corrigida pra frente. Sem isto, desfazer
 * o encerramento deixaria o contrato ativo e sem cobrança.
 */
export async function reabrirParcelasCanceladas(
  supabase: SupabaseClient,
  contratoId: string,
  aPartirDe?: string | null,
): Promise<{ reabertas: number; error?: string }> {
  let q = supabase
    .from('parcelas_aluguel')
    .update({
      status_pagamento: 'pendente',
      cancelada_em: null,
      cancelada_motivo: null,
      updated_at: new Date().toISOString(),
    })
    .eq('contrato_id', contratoId)
    .eq('status_pagamento', 'cancelada')

  if (aPartirDe) q = q.gt('vencimento', aPartirDe)

  const { data, error } = await q.select('id')
  if (error) return { reabertas: 0, error: error.message }
  return { reabertas: data?.length ?? 0 }
}
