import { PLANOS } from '@/lib/constants'
import { createAdminClient } from '@/lib/supabase/admin'

export type PlanoId = keyof typeof PLANOS

// Status que ocupam uma vaga do plano: anúncio publicado ou imóvel sob contrato.
const STATUS_OCUPA_VAGA: string[] = ['ativo', 'alugado']

export function limiteImoveis(plano: string): number {
  return PLANOS[plano as PlanoId]?.imoveis ?? 1
}

// No nosso modelo "ilimitado" é representado por 999 (profissional/admin).
export function ehIlimitado(plano: string): boolean {
  return limiteImoveis(plano) >= 999
}

/**
 * Pausa os imóveis 'ativo' que excedem o limite do plano, mantendo os mais
 * recentes. Não toca em 'alugado' (têm contrato vigente) nem em contratos já
 * existentes. Idempotente. Retorna quantos imóveis foram pausados.
 *
 * Usado no webhook quando o cliente faz downgrade (ex.: profissional → básico)
 * ou cancela (→ free).
 */
export async function aplicarLimiteImoveis(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  plano: string,
): Promise<number> {
  const limite = limiteImoveis(plano)
  if (limite >= 999) return 0

  const { data: ocupados } = await admin
    .from('imoveis')
    .select('id, status, created_at')
    .eq('user_id', userId)
    .in('status', STATUS_OCUPA_VAGA)
    .order('created_at', { ascending: false })

  if (!ocupados || ocupados.length <= limite) return 0

  // Mantém os `limite` mais recentes; pausa só os 'ativo' que sobraram.
  // Imóveis 'alugado' são preservados — têm contrato vigente.
  const excedentes = ocupados
    .slice(limite)
    .filter(i => i.status === 'ativo')
    .map(i => i.id)

  if (excedentes.length === 0) return 0

  await admin.from('imoveis').update({ status: 'pausado' }).in('id', excedentes)
  return excedentes.length
}
