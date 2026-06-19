import type { createAdminClient } from '@/lib/supabase/admin'

/**
 * Valida um token de revisão de contrato e confirma que ele aponta para o
 * contrato/geração informado. Retorna o user_id do dono (pra autorizar a
 * geração do PDF no lugar do login) ou null se inválido/expirado/revogado.
 */
export async function validarTokenRevisao(
  admin: ReturnType<typeof createAdminClient>,
  token: string,
  tipoContrato: 'locacao' | 'administracao',
  contratoId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('contrato_revisao_links')
    .select('user_id, tipo_contrato, contrato_id, expira_em, revogado_em')
    .eq('token', token)
    .maybeSingle()

  if (!data) return null
  if (data.revogado_em) return null
  if (new Date(data.expira_em).getTime() < Date.now()) return null
  if (data.tipo_contrato !== tipoContrato || data.contrato_id !== contratoId) return null
  return data.user_id as string
}
