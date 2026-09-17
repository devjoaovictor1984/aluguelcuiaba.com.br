import type { createClient } from '@/lib/supabase/server'

type SB = Awaited<ReturnType<typeof createClient>>

/**
 * Diz se o contrato já foi assinado por todas as partes pela plataforma —
 * i.e., existe um processo de assinatura CONCLUÍDO. Quando true, o contrato
 * fica travado: o editor vira somente leitura e mudanças só por termo aditivo.
 *
 * `contratoId` é a mesma chave usada no processo de assinatura:
 *   - locação      → id da GERAÇÃO (contrato_geracoes.id)
 *   - administração → id do CONTRATO de administração (contratos_administracao.id)
 */
export async function contratoAssinado(
  supabase: SB,
  tipo: 'locacao' | 'administracao',
  contratoId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('contrato_assinaturas')
    .select('id')
    .eq('tipo_contrato', tipo)
    .eq('contrato_id', contratoId)
    .eq('status', 'concluido')
    .limit(1)
    .maybeSingle()
  return !!data
}

/**
 * Situação da assinatura eletrônica de um documento avulso — termo aditivo
 * ou distrato.
 *
 * Documento com processo em andamento ou concluído não pode ser editado nem
 * excluído: o texto que cada parte lê — e que o hash do certificado prende —
 * tem que ser o mesmo do primeiro ao último signatário. Em andamento,
 * cancelar o processo destrava; concluído, não destrava mais.
 */
export async function situacaoAssinaturaDocumento(
  supabase: SB,
  tipo: 'aditivo_locacao' | 'aditivo_administracao' | 'distrato_locacao',
  aditivoId: string,
): Promise<'concluido' | 'enviado' | null> {
  const { data } = await supabase
    .from('contrato_assinaturas')
    .select('status')
    .eq('tipo_contrato', tipo)
    .eq('contrato_id', aditivoId)
    .neq('status', 'cancelado')
  const lista = data ?? []
  if (lista.some(p => p.status === 'concluido')) return 'concluido'
  return lista.length > 0 ? 'enviado' : null
}

/** `documento`: "aditivo" ou "distrato" — entra na frase que o corretor lê. */
export function msgDocumentoTravado(
  situacao: 'concluido' | 'enviado',
  documento: 'aditivo' | 'distrato' = 'aditivo',
): string {
  const saida = documento === 'distrato'
    ? 'Para corrigir, cancele o distrato e faça um novo.'
    : 'Para mudar algo, faça um novo aditivo.'
  return situacao === 'concluido'
    ? `${documento === 'distrato' ? 'Distrato' : 'Aditivo'} já assinado por todas as partes — não pode mais ser editado nem excluído. ${saida}`
    : `${documento === 'distrato' ? 'Distrato' : 'Aditivo'} em assinatura. Cancele o envio no painel de assinatura antes de editar ou excluir.`
}

export const MSG_CONTRATO_TRAVADO =
  'Contrato já assinado por todas as partes — não pode mais ser editado. Use um termo aditivo.'
