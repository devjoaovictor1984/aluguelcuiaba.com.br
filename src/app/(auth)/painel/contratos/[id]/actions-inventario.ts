'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { BUCKET_INVENTARIO } from '@/lib/crm/inventario-fotos'

/**
 * Foto do item do inventário (v101): uma por item. O limite é pequeno de
 * propósito — a compressão acontece no navegador, antes de subir.
 */
const MAX_FOTO = 2 * 1024 * 1024
const MIMES_FOTO = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

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

  // Se não sobrou nenhum item, desmarca tem_inventario_bens (checklist volta a alertar)
  const { count } = await supabase
    .from('contrato_inventario_itens')
    .select('id', { count: 'exact', head: true })
    .eq('contrato_id', contratoId)
  if ((count ?? 0) === 0) {
    await supabase
      .from('contratos_locacao')
      .update({ tem_inventario_bens: false })
      .eq('id', contratoId)
      .eq('user_id', acesso.userId)
  }

  revalidatePath(`/painel/contratos/${contratoId}`)
  return { ok: true }
}

// ───────────────── Foto do item (v101) ─────────────────

/** Confirma que o item é de um contrato do usuário logado. */
async function itemDoUsuario(itemId: string, userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('contrato_inventario_itens')
    .select('id, contrato_id, foto_path')
    .eq('id', itemId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

/**
 * Troca a foto do item. Uma por item: a anterior é apagada do bucket, e
 * não fica versão velha ocupando espaço nem aparecendo no PDF errado.
 */
export async function definirFotoItem(formData: FormData) {
  const acesso = await exigirAcessoCRM()

  const itemId = formData.get('item_id')
  const file = formData.get('file')

  if (typeof itemId !== 'string' || !itemId) return { error: 'Item inválido.' }
  if (!(file instanceof File) || file.size === 0) return { error: 'Foto não enviada.' }
  if (file.size > MAX_FOTO) return { error: 'Foto muito grande — tente de novo.' }
  if (!MIMES_FOTO.includes(file.type)) return { error: 'Envie uma imagem (JPG, PNG ou WebP).' }

  const item = await itemDoUsuario(itemId, acesso.userId)
  if (!item) return { error: 'Item não encontrado.' }

  const admin = createAdminClient()
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${acesso.userId}/${item.contrato_id}/${itemId}-${crypto.randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: upErr } = await admin.storage
    .from(BUCKET_INVENTARIO)
    .upload(path, new Uint8Array(bytes), { contentType: file.type, upsert: false })
  if (upErr) return { error: `Falha no upload: ${upErr.message}` }

  const { error: dbErr } = await admin
    .from('contrato_inventario_itens')
    .update({ foto_path: path })
    .eq('id', itemId)
    .eq('user_id', acesso.userId)

  if (dbErr) {
    // Sem a linha apontando pra ele, o arquivo vira lixo invisível no bucket.
    await admin.storage.from(BUCKET_INVENTARIO).remove([path])
    return { error: `Falha ao salvar: ${dbErr.message}` }
  }

  if (item.foto_path) await admin.storage.from(BUCKET_INVENTARIO).remove([item.foto_path])

  revalidatePath(`/painel/contratos/${item.contrato_id}`)
  return { ok: true }
}

export async function removerFotoItem(itemId: string) {
  const acesso = await exigirAcessoCRM()
  const item = await itemDoUsuario(itemId, acesso.userId)
  if (!item) return { error: 'Item não encontrado.' }
  if (!item.foto_path) return { ok: true }

  const admin = createAdminClient()
  const { error } = await admin
    .from('contrato_inventario_itens')
    .update({ foto_path: null })
    .eq('id', itemId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  await admin.storage.from(BUCKET_INVENTARIO).remove([item.foto_path])

  revalidatePath(`/painel/contratos/${item.contrato_id}`)
  return { ok: true }
}
