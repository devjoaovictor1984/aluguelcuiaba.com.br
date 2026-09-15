import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Como o termo aditivo cita o contrato originário (v95).
 *
 * Número e data só quando o contrato foi ASSINADO PELA PLATAFORMA — a
 * geração vira 'assinado' quando o último signatário assina. Contrato
 * importado, ou gerado aqui e assinado no papel, não tem número nem data
 * que a plataforma possa afirmar: o código dela não é o do papel, e a data
 * do cadastro não é a da assinatura. Nesses casos devolve null, e o PDF
 * cita "o contrato celebrado entre as partes".
 *
 * Devolve o trecho que vem depois de "Contrato de Locação": "nº X, firmado em dd/mm/aaaa".
 */
export async function referenciaOriginarioPadrao(
  sb: SupabaseClient,
  tipo: 'locacao' | 'administracao',
  contrato: { id: string; codigo: string },
): Promise<string | null> {
  const consulta = tipo === 'locacao'
    ? sb.from('contrato_geracoes').select('assinado_em').eq('contrato_id', contrato.id)
    : sb.from('contrato_admin_geracoes').select('assinado_em').eq('contrato_admin_id', contrato.id)

  const { data } = await consulta
    .eq('status', 'assinado')
    .order('assinado_em', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!data) return null

  const iso = (data as { assinado_em: string | null }).assinado_em
  const firmado = iso
    ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' })
    : null
  return `nº ${contrato.codigo}${firmado ? `, firmado em ${firmado}` : ''}`
}

/** O que o corretor escreveu no aditivo vale sobre a regra automática. */
export function referenciaOriginario(escrita: string | null | undefined, padrao: string | null): string | null {
  return escrita?.trim() || padrao
}
