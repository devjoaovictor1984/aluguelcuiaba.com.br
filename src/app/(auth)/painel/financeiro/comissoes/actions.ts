'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

export async function marcarNfEmitida(parcelaIds: string[], numeroNf: string | null = null) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  if (parcelaIds.length === 0) return { error: 'Nenhuma parcela informada.' }
  if (parcelaIds.length > 500) return { error: 'Máximo 500 parcelas por vez.' }

  // RLS já garante que só atualiza parcelas do próprio user via contrato.
  // Confirma a posse via join antes pra evitar tentativa silenciosa.
  const { data: posse } = await supabase
    .from('parcelas_aluguel')
    .select('id, contrato_id, contratos_locacao!inner(user_id)')
    .in('id', parcelaIds)
    .eq('contratos_locacao.user_id', acesso.userId)

  const idsValidos = (posse ?? []).map(p => p.id)
  if (idsValidos.length === 0) return { error: 'Parcelas não encontradas.' }

  const { error } = await supabase
    .from('parcelas_aluguel')
    .update({
      nf_emitida_em: new Date().toISOString(),
      nf_numero: numeroNf?.trim() || null,
    })
    .in('id', idsValidos)

  if (error) return { error: error.message }
  revalidatePath('/painel/financeiro/comissoes')
  return { ok: true, marcadas: idsValidos.length }
}

export async function desmarcarNfEmitida(parcelaIds: string[]) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  if (parcelaIds.length === 0) return { error: 'Nenhuma parcela informada.' }

  const { data: posse } = await supabase
    .from('parcelas_aluguel')
    .select('id, contrato_id, contratos_locacao!inner(user_id)')
    .in('id', parcelaIds)
    .eq('contratos_locacao.user_id', acesso.userId)

  const idsValidos = (posse ?? []).map(p => p.id)
  if (idsValidos.length === 0) return { error: 'Parcelas não encontradas.' }

  const { error } = await supabase
    .from('parcelas_aluguel')
    .update({ nf_emitida_em: null, nf_numero: null })
    .in('id', idsValidos)

  if (error) return { error: error.message }
  revalidatePath('/painel/financeiro/comissoes')
  return { ok: true }
}
