import type { createAdminClient } from '@/lib/supabase/admin'

/**
 * Valida o token de um signatário e confirma que ele aponta para o
 * contrato/geração informado. Retorna o user_id do dono (pra autorizar a
 * geração do PDF no lugar do login) ou null se inválido/cancelado.
 */
export async function validarTokenAssinatura(
  admin: ReturnType<typeof createAdminClient>,
  token: string,
  tipoContrato: 'locacao' | 'administracao',
  contratoId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('contrato_assinatura_signatarios')
    .select('id, assinatura:contrato_assinaturas!inner(user_id, tipo_contrato, contrato_id, status)')
    .eq('token', token)
    .maybeSingle()

  if (!data) return null
  const a = (Array.isArray(data.assinatura) ? data.assinatura[0] : data.assinatura) as
    { user_id: string; tipo_contrato: string; contrato_id: string; status: string } | undefined
  if (!a) return null
  if (a.status === 'cancelado') return null
  if (a.tipo_contrato !== tipoContrato || a.contrato_id !== contratoId) return null
  return a.user_id
}
