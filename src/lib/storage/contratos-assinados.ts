import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'

/**
 * Via final assinada (contrato + certificado) num bucket PRIVADO (v84).
 *
 * O arquivo é congelado na primeira geração e servido sempre igual daí em
 * diante. É isso que dá sentido ao hash impresso no certificado: sem um
 * arquivo estável, "qualquer alteração resulta em hash diferente" não é
 * verificável por ninguém, porque cada download produzia bytes novos.
 *
 * Privado porque o certificado anexo traz selfie, IP e localização das
 * partes — quem baixa passa pela rota, que exige dono logado ou token de
 * signatário.
 */
export const VIA_FINAL_BUCKET = 'contratos-assinados'

type Admin = ReturnType<typeof createAdminClient>

/** Caminho estável por processo — regerar sobrescreve, não duplica. */
export function caminhoViaFinal(userId: string, assinaturaId: string): string {
  return `${userId}/${assinaturaId}/via-final.pdf`
}

export async function subirViaFinal(
  admin: Admin,
  caminho: string,
  bytes: Uint8Array,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await admin.storage.from(VIA_FINAL_BUCKET)
    .upload(caminho, bytes, { contentType: 'application/pdf', upsert: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Baixa a via congelada. Devolve null se o arquivo sumiu do bucket — aí a
 * rota remonta e congela de novo, em vez de falhar o download na cara do
 * usuário.
 */
export async function baixarViaFinal(
  admin: Admin,
  caminho: string,
): Promise<Uint8Array | null> {
  const { data, error } = await admin.storage.from(VIA_FINAL_BUCKET).download(caminho)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}
