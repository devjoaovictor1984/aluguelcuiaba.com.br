import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { ArquivoRecebido } from './tipos'
import { TIPO_ARQUIVO } from './tabelas'

/**
 * Documentos de seguro (carta parecer, cotação, apólice) num bucket
 * PRIVADO — mesmo tratamento das selfies (v53). Trazem nome, CPF e
 * situação financeira do inquilino; não podem ficar em URL pública
 * adivinhável. Guardamos o caminho e assinamos na hora de exibir.
 */
export const SEGUROS_BUCKET = 'seguros-docs'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Persiste um PDF que chegou em base64 e registra o metadado.
 * Idempotente: o mesmo (análise, seguradora, tipo) sobrescreve.
 */
export async function salvarArquivo(
  admin: Admin,
  arquivo: ArquivoRecebido,
  ctx: { userId: string; analiseId: string },
): Promise<{ path?: string; error?: string }> {
  // Aceita tanto base64 puro quanto data URL.
  const limpo = arquivo.base64.replace(/^data:application\/pdf;base64,/, '').trim()
  if (!limpo) return { error: 'Arquivo vazio.' }

  let bytes: Buffer
  try {
    bytes = Buffer.from(limpo, 'base64')
  } catch {
    return { error: 'Base64 inválido.' }
  }
  if (bytes.length === 0) return { error: 'Arquivo vazio.' }
  if (bytes.length > 10 * 1024 * 1024) return { error: 'Arquivo maior que 10MB.' }

  const sigla = arquivo.seguradoraSigla ?? 'geral'
  const path = `${ctx.userId}/${ctx.analiseId}/${sigla}-${arquivo.codigoTipo}.pdf`

  const { error } = await admin.storage.from(SEGUROS_BUCKET)
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true })
  if (error) return { error: error.message }

  const descricao = arquivo.descricao
    ?? TIPO_ARQUIVO[arquivo.codigoTipo as keyof typeof TIPO_ARQUIVO]
    ?? null

  const { error: eDb } = await admin.from('seguro_arquivos').upsert({
    analise_id: ctx.analiseId,
    user_id: ctx.userId,
    seguradora_sigla: arquivo.seguradoraSigla,
    codigo_tipo: arquivo.codigoTipo,
    descricao,
    storage_path: path,
    tamanho_bytes: bytes.length,
    recebido_em: new Date().toISOString(),
  }, { onConflict: 'analise_id,seguradora_sigla,codigo_tipo' })
  if (eDb) return { error: eDb.message }

  return { path }
}

/** URL assinada de curta duração pra exibir/baixar o documento. */
export async function assinarUrlArquivo(
  admin: Admin,
  storagePath: string | null | undefined,
  expiraSeg = 3600,
): Promise<string | null> {
  if (!storagePath) return null
  const { data } = await admin.storage.from(SEGUROS_BUCKET)
    .createSignedUrl(storagePath, expiraSeg)
  return data?.signedUrl ?? null
}

/** Remove os documentos de uma análise (exclusão / limpeza). */
export async function removerArquivosDaAnalise(
  admin: Admin,
  userId: string,
  analiseId: string,
): Promise<void> {
  const pasta = `${userId}/${analiseId}`
  const { data, error } = await admin.storage.from(SEGUROS_BUCKET).list(pasta)
  // Falha ao listar deixaria documento do inquilino no bucket depois da
  // exclusão — resíduo de dado pessoal que ninguém mais vê pra apagar.
  if (error) throw new Error(`Falha ao listar documentos: ${error.message}`)
  if (data?.length) {
    await admin.storage.from(SEGUROS_BUCKET)
      .remove(data.map(a => `${pasta}/${a.name}`))
  }
}
