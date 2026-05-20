'use server'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'vistorias-fotos'
const MAX_FILE = 5 * 1024 * 1024
const MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']

interface VistoriaAuth {
  id: string
  user_id: string
  contrato_id: string
  status: string
  expira_em: string | null
}

async function carregarPorToken(token: string): Promise<{ vist?: VistoriaAuth; error?: string }> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('vistorias')
    .select('id, user_id, contrato_id, status, expira_em')
    .eq('token', token)
    .maybeSingle()
  if (!data) return { error: 'Link inválido ou não encontrado.' }
  if (data.status === 'assinada') return { error: 'Esta vistoria já foi assinada.' }
  if (data.status === 'recusada') return { error: 'Esta vistoria foi recusada anteriormente.' }
  if (data.status !== 'enviada') return { error: 'Vistoria não está disponível pra assinatura.' }
  if (data.expira_em && new Date(data.expira_em).getTime() < Date.now()) {
    return { error: 'Link expirado. Peça um novo ao solicitante.' }
  }
  return { vist: data as VistoriaAuth }
}

/** Inquilino edita observação do item enquanto revisa. */
export async function inquilinoObservacaoItem(token: string, itemId: string, observacao: string) {
  const { vist, error } = await carregarPorToken(token)
  if (!vist || error) return { error: error ?? 'Erro.' }

  const admin = createAdminClient()
  // Garante que o item é dessa vistoria
  const { data: item } = await admin
    .from('vistoria_itens').select('id').eq('id', itemId).eq('vistoria_id', vist.id).maybeSingle()
  if (!item) return { error: 'Item não encontrado.' }

  const { error: e } = await admin
    .from('vistoria_itens')
    .update({ observacao_inquilino: observacao?.trim() || null })
    .eq('id', itemId)
  if (e) return { error: e.message }
  return { ok: true }
}

export async function inquilinoUploadFoto(token: string, formData: FormData) {
  const { vist, error } = await carregarPorToken(token)
  if (!vist || error) return { error: error ?? 'Erro.' }

  const file = formData.get('file')
  const itemId = formData.get('vistoria_item_id')
  const legenda = formData.get('legenda')

  if (!(file instanceof File) || file.size === 0) return { error: 'Arquivo não enviado.' }
  if (file.size > MAX_FILE) return { error: 'Arquivo maior que 5MB.' }
  if (!MIMES.includes(file.type)) return { error: 'Use JPG, PNG, WEBP ou HEIC.' }

  const admin = createAdminClient()
  const uuid = crypto.randomUUID()
  const ext = file.name.lastIndexOf('.') !== -1
    ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
    : (file.type.split('/')[1] ?? 'jpg')
  const path = `${vist.user_id}/${vist.id}/inq-${uuid}.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: upErr } = await admin.storage.from(BUCKET)
    .upload(path, new Uint8Array(bytes), { contentType: file.type, upsert: false })
  if (upErr) return { error: upErr.message }

  const { data: row, error: dbErr } = await admin.from('vistoria_fotos').insert({
    vistoria_id: vist.id,
    vistoria_item_id: typeof itemId === 'string' && itemId ? itemId : null,
    arquivo_path: path,
    origem: 'inquilino',
    legenda: typeof legenda === 'string' ? legenda.slice(0, 200) : null,
  }).select('id').single()
  if (dbErr || !row) {
    await admin.storage.from(BUCKET).remove([path])
    return { error: dbErr?.message ?? 'Falha.' }
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
  return { ok: true, id: row.id, url: pub.publicUrl }
}

export async function inquilinoAssinar(token: string, input: {
  assinatura_dataurl: string  // PNG base64 do canvas
  observacoes?: string
}) {
  const { vist, error } = await carregarPorToken(token)
  if (!vist || error) return { error: error ?? 'Erro.' }

  if (!input.assinatura_dataurl || !input.assinatura_dataurl.startsWith('data:image/')) {
    return { error: 'Assinatura inválida.' }
  }

  const admin = createAdminClient()

  // Decodifica base64 → bytes
  const m = input.assinatura_dataurl.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!m) return { error: 'Formato de assinatura inválido.' }
  const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()
  const bytes = Buffer.from(m[2], 'base64')
  if (bytes.length > 2 * 1024 * 1024) return { error: 'Assinatura muito grande.' }

  const path = `${vist.user_id}/${vist.id}/assinatura.${ext}`
  const { error: upErr } = await admin.storage.from(BUCKET)
    .upload(path, bytes, { contentType: `image/${ext}`, upsert: true })
  if (upErr) return { error: upErr.message }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0].trim() ?? hdrs.get('x-real-ip') ?? null

  const { error: e } = await admin.from('vistorias').update({
    status: 'assinada',
    assinada_em: new Date().toISOString(),
    assinada_ip: ip,
    assinatura_inquilino_url: pub.publicUrl,
    inquilino_observacoes: input.observacoes?.trim() || null,
  }).eq('id', vist.id)
  if (e) return { error: e.message }

  return { ok: true }
}

export async function inquilinoRecusar(token: string, motivo: string) {
  const { vist, error } = await carregarPorToken(token)
  if (!vist || error) return { error: error ?? 'Erro.' }
  if (!motivo.trim()) return { error: 'Informe o motivo da recusa.' }

  const admin = createAdminClient()
  const { error: e } = await admin.from('vistorias').update({
    status: 'recusada',
    recusada_em: new Date().toISOString(),
    recusada_motivo: motivo.trim(),
  }).eq('id', vist.id)
  if (e) return { error: e.message }
  return { ok: true }
}
