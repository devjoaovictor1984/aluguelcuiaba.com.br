'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

export interface ItemInventarioInput {
  contrato_id: string
  descricao: string
  quantidade: number
  marca_modelo?: string | null
  estado?: string | null
  observacao?: string | null
}

export async function adicionarItemInventario(input: ItemInventarioInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (!input.descricao?.trim()) return { error: 'Descreva o item.' }

  // Confirma posse do contrato
  const { data: contrato } = await supabase
    .from('contratos_locacao')
    .select('id')
    .eq('id', input.contrato_id)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!contrato) return { error: 'Contrato não encontrado.' }

  // Próxima ordem
  const { count } = await supabase
    .from('contrato_inventario_itens')
    .select('id', { count: 'exact', head: true })
    .eq('contrato_id', input.contrato_id)

  const { error } = await supabase.from('contrato_inventario_itens').insert({
    contrato_id: input.contrato_id,
    user_id: acesso.userId,
    descricao: input.descricao.trim(),
    quantidade: Math.max(1, Math.floor(input.quantidade) || 1),
    marca_modelo: input.marca_modelo?.trim() || null,
    estado: input.estado?.trim() || null,
    observacao: input.observacao?.trim() || null,
    ordem: count ?? 0,
  })
  if (error) return { error: error.message }

  // Marca o contrato como tendo inventário (o checklist deixa de alertar)
  await supabase
    .from('contratos_locacao')
    .update({ tem_inventario_bens: true })
    .eq('id', input.contrato_id)
    .eq('user_id', acesso.userId)

  revalidatePath(`/painel/contratos/${input.contrato_id}`)
  return { ok: true }
}

export async function removerItemInventario(id: string, contratoId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { error } = await supabase
    .from('contrato_inventario_itens')
    .delete()
    .eq('id', id)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${contratoId}`)
  return { ok: true }
}
