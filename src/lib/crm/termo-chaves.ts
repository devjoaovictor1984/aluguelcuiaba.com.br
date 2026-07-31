import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/** Status em que o termo já tem as duas assinaturas. */
export const TERMO_FECHADO = 'assinado'

/**
 * Decide o status resultante quando UMA das partes assina.
 *
 * Como a v72 permite as duas ordens, quem assina por último é quem fecha
 * o termo — não dá pra assumir que é sempre a administradora.
 */
export function statusAposAssinatura(
  statusAtual: string,
  quemAssinou: 'locatario' | 'locador',
): 'assinado' | 'assinado_locatario' | 'assinado_locador' {
  if (quemAssinou === 'locatario') {
    return statusAtual === 'assinado_locador' ? 'assinado' : 'assinado_locatario'
  }
  return statusAtual === 'assinado_locatario' ? 'assinado' : 'assinado_locador'
}

/**
 * Fecha o ciclo de encerramento no contrato: grava a data da entrega e a
 * quantidade de chaves devolvidas.
 *
 * Chamar SOMENTE quando o termo chega em 'assinado'. Vive aqui porque os
 * dois lados (painel e magic link) podem ser o último a assinar, e a regra
 * não pode divergir entre eles.
 */
export async function propagarEntregaNoContrato(
  admin: ReturnType<typeof createAdminClient>,
  termoId: string,
): Promise<void> {
  const { data: termo } = await admin
    .from('termos_entrega_chaves')
    .select('contrato_id, data_entrega, qtd_chaves_entregues')
    .eq('id', termoId)
    .maybeSingle()
  if (!termo) return

  await admin.from('contratos_locacao').update({
    chaves_entregues_em: termo.data_entrega ?? new Date().toISOString().slice(0, 10),
    qtd_chaves_entregues: termo.qtd_chaves_entregues ?? null,
  }).eq('id', termo.contrato_id)
}
