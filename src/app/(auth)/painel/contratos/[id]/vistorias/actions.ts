'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { ITENS_PADRAO, type EstadoItem } from '@/lib/vistorias/modelos'

const ESTADOS_VALIDOS: EstadoItem[] = ['perfeito', 'bom', 'regular', 'danificado', 'nao_aplicavel']
const BUCKET = 'vistorias-fotos'
const MAX_FILE = 5 * 1024 * 1024
const MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']

function gerarToken(): string {
  return randomBytes(24).toString('base64url')
}

function extensaoDe(nome: string, mime: string): string {
  const idx = nome.lastIndexOf('.')
  if (idx !== -1) {
    const ext = nome.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
    if (ext) return ext
  }
  return mime.split('/')[1] ?? 'jpg'
}

async function checarPosseContrato(contratoId: string, userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('contratos_locacao')
    .select('id')
    .eq('id', contratoId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

async function checarPosseVistoria(vistoriaId: string, userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('vistorias')
    .select('id, contrato_id, status')
    .eq('id', vistoriaId)
    .eq('user_id', userId)
    .maybeSingle()
  return data?.contrato_id ?? null
}

/** Cria vistoria com os itens padrão do modelo. */
export async function criarVistoria(contratoId: string, tipo: 'entrada' | 'saida') {
  const acesso = await exigirAcessoCRM()
  if (!await checarPosseContrato(contratoId, acesso.userId)) return { error: 'Contrato não encontrado.' }

  const supabase = await createClient()
  const { data: vistoria, error } = await supabase
    .from('vistorias')
    .insert({
      user_id: acesso.userId,
      contrato_id: contratoId,
      tipo,
      status: 'rascunho',
      data_vistoria: new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single()
  if (error || !vistoria) return { error: error?.message ?? 'Falha ao criar vistoria.' }

  // Insere itens padrão
  const itens = ITENS_PADRAO.map((it, i) => ({
    vistoria_id: vistoria.id,
    comodo: it.comodo,
    item: it.item,
    estado: 'bom' as const,
    ordem: i,
  }))
  await supabase.from('vistoria_itens').insert(itens)

  revalidatePath(`/painel/contratos/${contratoId}/vistorias`)
  redirect(`/painel/contratos/${contratoId}/vistorias/${vistoria.id}`)
}

export async function atualizarVistoriaItem(itemId: string, input: {
  estado?: EstadoItem
  observacao?: string | null
}) {
  await exigirAcessoCRM()
  const supabase = await createClient()
  const payload: Record<string, unknown> = {}
  if (input.estado && ESTADOS_VALIDOS.includes(input.estado)) payload.estado = input.estado
  if ('observacao' in input) payload.observacao = input.observacao?.trim() || null
  if (Object.keys(payload).length === 0) return { ok: true }

  // RLS já filtra por vistoria.user_id; supabase regular client com RLS faz o filtro
  const { error } = await supabase.from('vistoria_itens').update(payload).eq('id', itemId)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function adicionarItemVistoria(vistoriaId: string, comodo: string, item: string) {
  const acesso = await exigirAcessoCRM()
  const contratoId = await checarPosseVistoria(vistoriaId, acesso.userId)
  if (!contratoId) return { error: 'Vistoria não encontrada.' }

  const supabase = await createClient()
  const { data: ult } = await supabase
    .from('vistoria_itens')
    .select('ordem')
    .eq('vistoria_id', vistoriaId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()
  const ordem = (ult?.ordem ?? 0) + 1

  const { error } = await supabase.from('vistoria_itens').insert({
    vistoria_id: vistoriaId,
    comodo: comodo.trim() || 'Outro',
    item: item.trim() || 'Item',
    estado: 'bom',
    ordem,
  })
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${contratoId}/vistorias/${vistoriaId}`)
  return { ok: true }
}

export async function removerItemVistoria(itemId: string) {
  await exigirAcessoCRM()
  const supabase = await createClient()
  const { error } = await supabase.from('vistoria_itens').delete().eq('id', itemId)
  if (error) return { error: error.message }
  return { ok: true }
}

export interface AtualizarVistoriaMetaInput {
  data_vistoria?: string | null
  observacoes_gerais?: string | null
  qtd_chaves?: number | null
  qtd_controles?: number | null
}

export async function atualizarVistoriaMeta(vistoriaId: string, input: AtualizarVistoriaMetaInput) {
  const acesso = await exigirAcessoCRM()
  const contratoId = await checarPosseVistoria(vistoriaId, acesso.userId)
  if (!contratoId) return { error: 'Vistoria não encontrada.' }

  const supabase = await createClient()
  const payload: Record<string, unknown> = {}
  if ('data_vistoria' in input) payload.data_vistoria = input.data_vistoria || null
  if ('observacoes_gerais' in input) payload.observacoes_gerais = input.observacoes_gerais?.trim() || null
  if ('qtd_chaves' in input) payload.qtd_chaves = input.qtd_chaves ?? 0
  if ('qtd_controles' in input) payload.qtd_controles = input.qtd_controles ?? 0

  const { error } = await supabase.from('vistorias').update(payload).eq('id', vistoriaId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${contratoId}/vistorias/${vistoriaId}`)
  return { ok: true }
}

export async function uploadFotoVistoria(formData: FormData) {
  const acesso = await exigirAcessoCRM()
  const vistoriaId = formData.get('vistoria_id')
  const itemId = formData.get('vistoria_item_id')
  const legenda = formData.get('legenda')
  const file = formData.get('file')

  if (typeof vistoriaId !== 'string' || !vistoriaId) return { error: 'Vistoria inválida.' }
  if (!(file instanceof File) || file.size === 0) return { error: 'Arquivo não enviado.' }
  if (file.size > MAX_FILE) return { error: 'Arquivo maior que 5MB.' }
  if (!MIMES.includes(file.type)) return { error: 'Use JPG, PNG, WEBP ou HEIC.' }

  const contratoId = await checarPosseVistoria(vistoriaId, acesso.userId)
  if (!contratoId) return { error: 'Vistoria não encontrada.' }

  const admin = createAdminClient()
  const uuid = crypto.randomUUID()
  const ext = extensaoDe(file.name, file.type)
  const path = `${acesso.userId}/${vistoriaId}/${uuid}.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: upErr } = await admin.storage.from(BUCKET)
    .upload(path, new Uint8Array(bytes), { contentType: file.type, upsert: false })
  if (upErr) return { error: `Upload: ${upErr.message}` }

  const { error: dbErr } = await admin.from('vistoria_fotos').insert({
    vistoria_id: vistoriaId,
    vistoria_item_id: typeof itemId === 'string' && itemId ? itemId : null,
    arquivo_path: path,
    origem: 'corretor',
    legenda: typeof legenda === 'string' ? legenda.slice(0, 200) : null,
  })
  if (dbErr) {
    await admin.storage.from(BUCKET).remove([path])
    return { error: dbErr.message }
  }

  revalidatePath(`/painel/contratos/${contratoId}/vistorias/${vistoriaId}`)
  return { ok: true }
}

export async function removerFotoVistoria(fotoId: string) {
  const acesso = await exigirAcessoCRM()
  const admin = createAdminClient()
  const { data: foto } = await admin
    .from('vistoria_fotos')
    .select('id, vistoria_id, arquivo_path, vistorias!inner(user_id, contrato_id)')
    .eq('id', fotoId)
    .maybeSingle()
  const row = foto as unknown as {
    id: string; vistoria_id: string; arquivo_path: string
    vistorias: { user_id: string; contrato_id: string } | { user_id: string; contrato_id: string }[]
  } | null
  if (!row) return { error: 'Foto não encontrada.' }
  const vist = Array.isArray(row.vistorias) ? row.vistorias[0] : row.vistorias
  if (vist.user_id !== acesso.userId) return { error: 'Sem permissão.' }

  await admin.storage.from(BUCKET).remove([row.arquivo_path])
  await admin.from('vistoria_fotos').delete().eq('id', fotoId)
  revalidatePath(`/painel/contratos/${vist.contrato_id}/vistorias/${row.vistoria_id}`)
  return { ok: true }
}

/** Gera token e marca como 'enviada' pra inquilino assinar via magic link. */
export async function enviarVistoria(vistoriaId: string, diasValidade = 7) {
  const acesso = await exigirAcessoCRM()
  const contratoId = await checarPosseVistoria(vistoriaId, acesso.userId)
  if (!contratoId) return { error: 'Vistoria não encontrada.' }

  const dias = Math.max(1, Math.min(30, diasValidade))
  const token = gerarToken()
  const expira = new Date(Date.now() + dias * 86400000).toISOString()

  const supabase = await createClient()
  const { error } = await supabase.from('vistorias').update({
    status: 'enviada',
    token,
    enviada_em: new Date().toISOString(),
    expira_em: expira,
  }).eq('id', vistoriaId)
  if (error) return { error: error.message }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  revalidatePath(`/painel/contratos/${contratoId}/vistorias/${vistoriaId}`)
  return { ok: true, token, url: `${baseUrl}/vistoria/${token}`, expira_em: expira }
}

export async function revogarEnvioVistoria(vistoriaId: string) {
  const acesso = await exigirAcessoCRM()
  const contratoId = await checarPosseVistoria(vistoriaId, acesso.userId)
  if (!contratoId) return { error: 'Vistoria não encontrada.' }
  const supabase = await createClient()
  const { error } = await supabase.from('vistorias').update({
    status: 'rascunho',
    token: null,
    enviada_em: null,
    expira_em: null,
  }).eq('id', vistoriaId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${contratoId}/vistorias/${vistoriaId}`)
  return { ok: true }
}

export async function excluirVistoria(vistoriaId: string) {
  const acesso = await exigirAcessoCRM()
  const contratoId = await checarPosseVistoria(vistoriaId, acesso.userId)
  if (!contratoId) return { error: 'Vistoria não encontrada.' }
  const supabase = await createClient()
  const { error } = await supabase.from('vistorias').delete().eq('id', vistoriaId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${contratoId}/vistorias`)
  redirect(`/painel/contratos/${contratoId}`)
}
