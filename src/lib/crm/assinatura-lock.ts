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

export const MSG_CONTRATO_TRAVADO =
  'Contrato já assinado por todas as partes — não pode mais ser editado. Use um termo aditivo.'
