'use server'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { subirSelfieBase64 } from '@/lib/storage/selfies'

const BUCKET = 'termos-chaves'

interface TermoAuth {
  id: string
  user_id: string
  contrato_id: string
  status: string
  expira_em: string | null
}

async function carregarPorToken(token: string): Promise<{ termo?: TermoAuth; error?: string }> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('termos_entrega_chaves')
    .select('id, user_id, contrato_id, status, expira_em')
    .eq('token', token)
    .maybeSingle()
  if (!data) return { error: 'Link inválido ou não encontrado.' }
  if (data.status === 'assinado' || data.status === 'assinado_locatario') {
    return { error: 'Este termo já foi assinado.' }
  }
  if (data.status === 'recusada') return { error: 'Este termo foi recusado anteriormente.' }
  if (data.status !== 'enviada') return { error: 'Termo não está disponível pra assinatura.' }
  if (data.expira_em && new Date(data.expira_em).getTime() < Date.now()) {
    return { error: 'Link expirado. Peça um novo à administradora.' }
  }
  return { termo: data as TermoAuth }
}

async function salvarImagemBase64(
  admin: ReturnType<typeof createAdminClient>,
  dataUrl: string,
  path: string,
): Promise<{ url?: string; error?: string }> {
  const m = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!m) return { error: 'Formato de imagem inválido.' }
  const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()
  const bytes = Buffer.from(m[2], 'base64')
  if (bytes.length > 5 * 1024 * 1024) return { error: 'Imagem muito grande (máx. 5MB).' }
  const fullPath = `${path}.${ext}`
  const { error } = await admin.storage.from(BUCKET)
    .upload(fullPath, bytes, { contentType: `image/${ext}`, upsert: true })
  if (error) return { error: error.message }
  const { data } = admin.storage.from(BUCKET).getPublicUrl(fullPath)
  return { url: data.publicUrl }
}

export async function locatarioAssinar(token: string, input: {
  assinatura_dataurl: string
  selfie_dataurl: string
  observacoes?: string
}) {
  const { termo, error } = await carregarPorToken(token)
  if (!termo || error) return { error: error ?? 'Erro.' }

  if (!input.assinatura_dataurl?.startsWith('data:image/')) return { error: 'Assinatura inválida.' }
  if (!input.selfie_dataurl?.startsWith('data:image/')) return { error: 'A selfie é obrigatória.' }

  const admin = createAdminClient()

  const ass = await salvarImagemBase64(admin, input.assinatura_dataurl, `${termo.user_id}/${termo.id}/assinatura-locatario`)
  if (ass.error || !ass.url) return { error: ass.error ?? 'Falha ao salvar assinatura.' }

  // Selfie no bucket privado; guardamos o caminho (não a URL).
  const selfie = await subirSelfieBase64(admin, input.selfie_dataurl, `${termo.user_id}/${termo.id}/selfie-locatario`)
  if (selfie.error || !selfie.path) return { error: selfie.error ?? 'Falha ao salvar selfie.' }

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0].trim() ?? hdrs.get('x-real-ip') ?? null

  const { error: e } = await admin.from('termos_entrega_chaves').update({
    status: 'assinado_locatario',
    assinatura_locatario_url: ass.url,
    selfie_locatario_url: selfie.path,
    assinado_locatario_em: new Date().toISOString(),
    assinado_locatario_ip: ip,
    observacoes_locatario: input.observacoes?.trim() || null,
  }).eq('id', termo.id)
  if (e) return { error: e.message }

  return { ok: true }
}

export async function locatarioRecusar(token: string, motivo: string) {
  const { termo, error } = await carregarPorToken(token)
  if (!termo || error) return { error: error ?? 'Erro.' }
  if (!motivo.trim()) return { error: 'Informe o motivo da recusa.' }

  const admin = createAdminClient()
  const { error: e } = await admin.from('termos_entrega_chaves').update({
    status: 'recusada',
    recusada_em: new Date().toISOString(),
    recusada_motivo: motivo.trim(),
  }).eq('id', termo.id)
  if (e) return { error: e.message }
  return { ok: true }
}
