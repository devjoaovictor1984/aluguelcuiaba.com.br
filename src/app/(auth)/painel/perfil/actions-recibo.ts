'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'crm-emitente'
const TAMANHO_MAX = 3 * 1024 * 1024 // 3MB
const MIMES = ['image/jpeg','image/jpg','image/png','image/webp']

export type ArquivoRecibo = 'logo' | 'assinatura'

function extensaoDe(nome: string): string {
  const idx = nome.lastIndexOf('.')
  if (idx === -1) return 'png'
  return nome.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'png'
}

async function userAtual(): Promise<{ id: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ? { id: user.id } : null
}

export async function uploadArquivoRecibo(formData: FormData) {
  const user = await userAtual()
  if (!user) return { error: 'Não autenticado.' }

  const tipo = formData.get('tipo')
  const file = formData.get('file')
  if (tipo !== 'logo' && tipo !== 'assinatura') return { error: 'Tipo inválido.' }
  if (!(file instanceof File) || file.size === 0) return { error: 'Arquivo não enviado.' }
  if (file.size > TAMANHO_MAX) return { error: 'Arquivo maior que 3MB.' }
  if (!MIMES.includes(file.type)) return { error: 'Use JPG, PNG ou WEBP.' }

  const admin = createAdminClient()

  // Remove arquivo anterior (qualquer extensão) antes de subir o novo
  const { data: existentes } = await admin.storage
    .from(BUCKET)
    .list(user.id, { search: tipo })
  if (existentes && existentes.length > 0) {
    const paths = existentes
      .filter(o => o.name.startsWith(tipo + '.'))
      .map(o => `${user.id}/${o.name}`)
    if (paths.length > 0) await admin.storage.from(BUCKET).remove(paths)
  }

  const ext = extensaoDe(file.name)
  const path = `${user.id}/${tipo}.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, new Uint8Array(bytes), { contentType: file.type, upsert: true })
  if (upErr) return { error: `Falha no upload: ${upErr.message}` }

  // URL pública (bucket é public)
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
  // cache-buster pra não pegar versão antiga
  const url = `${pub.publicUrl}?v=${Date.now()}`

  const campo = tipo === 'logo' ? 'recibo_logo_url' : 'recibo_assinatura_url'
  const { error: dbErr } = await admin
    .from('perfis')
    .update({ [campo]: url })
    .eq('id', user.id)
  if (dbErr) return { error: dbErr.message }

  revalidatePath('/painel/perfil/recibo')
  return { ok: true, url }
}

export async function removerArquivoRecibo(tipo: ArquivoRecibo) {
  const user = await userAtual()
  if (!user) return { error: 'Não autenticado.' }

  const admin = createAdminClient()

  const { data: existentes } = await admin.storage
    .from(BUCKET)
    .list(user.id, { search: tipo })
  if (existentes && existentes.length > 0) {
    const paths = existentes
      .filter(o => o.name.startsWith(tipo + '.'))
      .map(o => `${user.id}/${o.name}`)
    if (paths.length > 0) await admin.storage.from(BUCKET).remove(paths)
  }

  const campo = tipo === 'logo' ? 'recibo_logo_url' : 'recibo_assinatura_url'
  await admin.from('perfis').update({ [campo]: null }).eq('id', user.id)

  revalidatePath('/painel/perfil/recibo')
  return { ok: true }
}

export interface ConfigReciboInput {
  recibo_emitente_nome?: string | null
  recibo_mostrar_linha?: boolean
  recibo_assinatura_sobre_linha?: boolean
}

export async function salvarConfigRecibo(input: ConfigReciboInput) {
  const user = await userAtual()
  if (!user) return { error: 'Não autenticado.' }

  const supabase = await createClient()
  const payload: Record<string, unknown> = {}
  if ('recibo_emitente_nome' in input) {
    payload.recibo_emitente_nome = input.recibo_emitente_nome?.trim() || null
  }
  if ('recibo_mostrar_linha' in input) {
    payload.recibo_mostrar_linha = input.recibo_mostrar_linha
  }
  if ('recibo_assinatura_sobre_linha' in input) {
    payload.recibo_assinatura_sobre_linha = input.recibo_assinatura_sobre_linha
  }

  const { error } = await supabase.from('perfis').update(payload).eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/painel/perfil/recibo')
  return { ok: true }
}
