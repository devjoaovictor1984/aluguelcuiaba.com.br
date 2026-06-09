import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'

/**
 * Selfies de assinatura (vistoria e termo de entrega) ficam num bucket
 * PRIVADO. Guardamos o CAMINHO no banco e geramos URL assinada de curta
 * duração na hora de renderizar (PDF ou painel) — onde já há auth de admin.
 * Dado biométrico não deve ficar em bucket público (LGPD).
 */
export const SELFIE_BUCKET = 'selfies'

type Admin = ReturnType<typeof createAdminClient>

/** Sobe uma selfie (data URL base64) no bucket privado. Retorna o CAMINHO. */
export async function subirSelfieBase64(
  admin: Admin,
  dataUrl: string,
  basePath: string,
): Promise<{ path?: string; error?: string }> {
  const m = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!m) return { error: 'Formato de selfie inválido.' }
  const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()
  const bytes = Buffer.from(m[2], 'base64')
  if (bytes.length > 5 * 1024 * 1024) return { error: 'Selfie muito grande (máx. 5MB).' }

  const path = `${basePath}.${ext}`
  const { error } = await admin.storage.from(SELFIE_BUCKET)
    .upload(path, bytes, { contentType: `image/${ext}`, upsert: true })
  if (error) return { error: error.message }
  return { path }
}

/**
 * Resolve o valor guardado na coluna selfie_*_url numa URL exibível.
 * - caminho do bucket privado → URL assinada (expira em `expiraSeg`)
 * - valor legado começando com http → devolve como está (bucket público antigo)
 * - null/vazio → null
 */
export async function assinarUrlSelfie(
  admin: Admin,
  valor: string | null | undefined,
  expiraSeg = 3600,
): Promise<string | null> {
  if (!valor) return null
  if (valor.startsWith('http://') || valor.startsWith('https://')) return valor
  const { data } = await admin.storage.from(SELFIE_BUCKET).createSignedUrl(valor, expiraSeg)
  return data?.signedUrl ?? null
}
