'use server'

import { randomBytes } from 'crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { subirSelfieBase64, SELFIE_BUCKET } from '@/lib/storage/selfies'

const BUCKET = 'termos-chaves'

function gerarToken(): string {
  return randomBytes(24).toString('base64url')
}

/** Decodifica um data URL de imagem e sobe no bucket. Retorna a URL pública. */
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

async function checarPosseTermo(termoId: string, userId: string): Promise<{ contratoId: string; status: string } | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('termos_entrega_chaves')
    .select('id, contrato_id, status')
    .eq('id', termoId)
    .eq('user_id', userId)
    .maybeSingle()
  return data ? { contratoId: data.contrato_id, status: data.status } : null
}

/** Cria o termo de entrega de chaves. Puxa dados da última vistoria de saída, se houver. */
export async function criarTermo(contratoId: string) {
  const acesso = await exigirAcessoCRM()
  if (!await checarPosseContrato(contratoId, acesso.userId)) return { error: 'Contrato não encontrado.' }

  const supabase = await createClient()

  // Puxa a vistoria de saída assinada mais recente pra pré-preencher.
  const { data: vistoria } = await supabase
    .from('vistorias')
    .select('id, qtd_chaves, qtd_controles, qtd_chaves_inquilino, qtd_controles_inquilino')
    .eq('contrato_id', contratoId)
    .eq('tipo', 'saida')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: termo, error } = await supabase
    .from('termos_entrega_chaves')
    .insert({
      user_id: acesso.userId,
      contrato_id: contratoId,
      vistoria_saida_id: vistoria?.id ?? null,
      status: 'rascunho',
      data_entrega: new Date().toISOString().slice(0, 10),
      qtd_chaves_entregues: vistoria?.qtd_chaves_inquilino ?? vistoria?.qtd_chaves ?? 0,
      qtd_controles_entregues: vistoria?.qtd_controles_inquilino ?? vistoria?.qtd_controles ?? 0,
    })
    .select('id')
    .single()
  if (error || !termo) return { error: error?.message ?? 'Falha ao criar termo.' }

  revalidatePath(`/painel/contratos/${contratoId}/termo-chaves`)
  redirect(`/painel/contratos/${contratoId}/termo-chaves/${termo.id}`)
}

export interface AtualizarTermoMetaInput {
  data_entrega?: string | null
  qtd_chaves_entregues?: number | null
  qtd_controles_entregues?: number | null
  estado_entrega?: string | null
  observacoes?: string | null
}

export async function atualizarTermoMeta(termoId: string, input: AtualizarTermoMetaInput) {
  const acesso = await exigirAcessoCRM()
  const posse = await checarPosseTermo(termoId, acesso.userId)
  if (!posse) return { error: 'Termo não encontrado.' }
  if (posse.status === 'assinado') return { error: 'Termo já assinado por ambas as partes.' }

  const sanitiza = (n: number | null | undefined): number => {
    if (n === null || n === undefined || !Number.isFinite(n) || n < 0 || n > 999) return 0
    return Math.floor(n)
  }

  const supabase = await createClient()
  const payload: Record<string, unknown> = {}
  if ('data_entrega' in input) payload.data_entrega = input.data_entrega || null
  if ('qtd_chaves_entregues' in input) payload.qtd_chaves_entregues = sanitiza(input.qtd_chaves_entregues)
  if ('qtd_controles_entregues' in input) payload.qtd_controles_entregues = sanitiza(input.qtd_controles_entregues)
  if ('estado_entrega' in input) payload.estado_entrega = input.estado_entrega?.trim() || null
  if ('observacoes' in input) payload.observacoes = input.observacoes?.trim() || null
  if (Object.keys(payload).length === 0) return { ok: true }

  const { error } = await supabase.from('termos_entrega_chaves').update(payload).eq('id', termoId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${posse.contratoId}/termo-chaves/${termoId}`)
  return { ok: true }
}

/** Gera token e marca como 'enviada' pro locatário assinar via magic link. */
export async function enviarTermo(termoId: string, diasValidade = 7) {
  const acesso = await exigirAcessoCRM()
  const posse = await checarPosseTermo(termoId, acesso.userId)
  if (!posse) return { error: 'Termo não encontrado.' }

  const dias = Math.max(1, Math.min(30, diasValidade))
  const token = gerarToken()
  const expira = new Date(Date.now() + dias * 86400000).toISOString()

  const supabase = await createClient()
  const { error } = await supabase.from('termos_entrega_chaves').update({
    status: 'enviada',
    token,
    enviada_em: new Date().toISOString(),
    expira_em: expira,
  }).eq('id', termoId)
  if (error) return { error: error.message }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  revalidatePath(`/painel/contratos/${posse.contratoId}/termo-chaves/${termoId}`)
  return { ok: true, token, url: `${baseUrl}/termo/${token}`, expira_em: expira }
}

export async function revogarEnvioTermo(termoId: string) {
  const acesso = await exigirAcessoCRM()
  const posse = await checarPosseTermo(termoId, acesso.userId)
  if (!posse) return { error: 'Termo não encontrado.' }
  if (posse.status === 'assinado' || posse.status === 'assinado_locatario') {
    return { error: 'O locatário já assinou — não dá pra revogar.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('termos_entrega_chaves').update({
    status: 'rascunho',
    token: null,
    enviada_em: null,
    expira_em: null,
  }).eq('id', termoId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${posse.contratoId}/termo-chaves/${termoId}`)
  return { ok: true }
}

/**
 * Administradora confirma o recebimento das chaves assinando no painel.
 * Só liberado depois que o locatário assinou. Ao concluir, fecha o termo
 * e grava chaves_entregues_em / qtd_chaves_entregues no contrato.
 */
export async function assinarComoLocador(termoId: string, input: {
  assinatura_dataurl: string
  selfie_dataurl?: string | null
}) {
  const acesso = await exigirAcessoCRM()
  const posse = await checarPosseTermo(termoId, acesso.userId)
  if (!posse) return { error: 'Termo não encontrado.' }
  if (posse.status !== 'assinado_locatario') {
    return { error: 'O locatário precisa assinar antes da administradora.' }
  }
  if (!input.assinatura_dataurl?.startsWith('data:image/')) {
    return { error: 'Assinatura inválida.' }
  }

  const admin = createAdminClient()

  const ass = await salvarImagemBase64(admin, input.assinatura_dataurl, `${acesso.userId}/${termoId}/assinatura-locador`)
  if (ass.error || !ass.url) return { error: ass.error ?? 'Falha ao salvar assinatura.' }

  let selfieUrl: string | null = null
  if (input.selfie_dataurl?.startsWith('data:image/')) {
    // Selfie no bucket privado; guardamos o caminho (não a URL).
    const s = await subirSelfieBase64(admin, input.selfie_dataurl, `${acesso.userId}/${termoId}/selfie-locador`)
    if (s.error) return { error: s.error }
    selfieUrl = s.path ?? null
  }

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0].trim() ?? hdrs.get('x-real-ip') ?? null

  // Lê os dados do termo pra propagar pro contrato.
  const { data: termo } = await admin
    .from('termos_entrega_chaves')
    .select('contrato_id, data_entrega, qtd_chaves_entregues')
    .eq('id', termoId)
    .maybeSingle()

  const { error } = await admin.from('termos_entrega_chaves').update({
    status: 'assinado',
    assinatura_locador_url: ass.url,
    selfie_locador_url: selfieUrl,
    assinado_locador_em: new Date().toISOString(),
    assinado_locador_ip: ip,
  }).eq('id', termoId)
  if (error) return { error: error.message }

  // Fecha o ciclo de encerramento no contrato.
  if (termo) {
    await admin.from('contratos_locacao').update({
      chaves_entregues_em: termo.data_entrega ?? new Date().toISOString().slice(0, 10),
      qtd_chaves_entregues: termo.qtd_chaves_entregues ?? null,
    }).eq('id', termo.contrato_id)
  }

  revalidatePath(`/painel/contratos/${posse.contratoId}/termo-chaves/${termoId}`)
  revalidatePath(`/painel/contratos/${posse.contratoId}`)
  return { ok: true }
}

export async function excluirTermo(termoId: string) {
  const acesso = await exigirAcessoCRM()
  const posse = await checarPosseTermo(termoId, acesso.userId)
  if (!posse) return { error: 'Termo não encontrado.' }

  const admin = createAdminClient()
  // Remove arquivos do storage antes de apagar a linha.
  // Assinaturas ficam no bucket termos-chaves; selfies no bucket privado.
  const pasta = `${acesso.userId}/${termoId}`
  const { data: arquivos } = await admin.storage.from(BUCKET).list(pasta)
  if (arquivos?.length) {
    await admin.storage.from(BUCKET).remove(arquivos.map(a => `${pasta}/${a.name}`))
  }
  const { data: selfies } = await admin.storage.from(SELFIE_BUCKET).list(pasta)
  if (selfies?.length) {
    await admin.storage.from(SELFIE_BUCKET).remove(selfies.map(a => `${pasta}/${a.name}`))
  }

  const supabase = await createClient()
  const { error } = await supabase.from('termos_entrega_chaves').delete().eq('id', termoId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${posse.contratoId}/termo-chaves`)
  redirect(`/painel/contratos/${posse.contratoId}/termo-chaves`)
}
