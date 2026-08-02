import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { SEGUROS_BUCKET } from '../arquivos'

/**
 * Documentos do incêndio: certificado, proposta e boletos.
 *
 * Diferente da fiança, não chegam por webhook — pedimos via
 * imprimirProposta / imprimirBoleto. Guardamos no mesmo bucket privado
 * pra não repetir a chamada a cada visualização.
 */

type Admin = ReturnType<typeof createAdminClient>

interface ArquivoIncendio {
  tipo: 'certificado' | 'proposta' | 'boleto'
  base64: string
  numParcela?: number
  dataVencimento?: string | null
  dataPagamento?: string | null
}

export async function salvarArquivoIncendio(
  admin: Admin,
  ctx: { userId: string; apoliceId: string },
  arq: ArquivoIncendio,
): Promise<{ path?: string; error?: string }> {
  const limpo = arq.base64.replace(/^data:application\/pdf;base64,/, '').trim()
  if (!limpo) return { error: 'Arquivo vazio.' }

  let bytes: Buffer
  try {
    bytes = Buffer.from(limpo, 'base64')
  } catch {
    return { error: 'Base64 inválido.' }
  }
  if (bytes.length === 0) return { error: 'Arquivo vazio.' }
  if (bytes.length > 10 * 1024 * 1024) return { error: 'Arquivo maior que 10MB.' }

  const sufixo = arq.tipo === 'boleto' ? `boleto-${arq.numParcela ?? 1}` : arq.tipo
  const path = `${ctx.userId}/incendio/${ctx.apoliceId}/${sufixo}.pdf`

  const { error } = await admin.storage.from(SEGUROS_BUCKET)
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true })
  if (error) return { error: error.message }

  const { error: eDb } = await admin.from('seguro_incendio_documentos').upsert({
    apolice_id: ctx.apoliceId,
    user_id: ctx.userId,
    tipo: arq.tipo,
    // Certificado e proposta são únicos; boleto tem um por parcela. O
    // 0 mantém a unique consistente pra quem não é boleto.
    num_parcela: arq.tipo === 'boleto' ? (arq.numParcela ?? 1) : 0,
    data_vencimento: arq.dataVencimento ?? null,
    data_pagamento: arq.dataPagamento ?? null,
    storage_path: path,
    tamanho_bytes: bytes.length,
    baixado_em: new Date().toISOString(),
  }, { onConflict: 'apolice_id,tipo,num_parcela' })
  if (eDb) return { error: eDb.message }

  return { path }
}

export async function removerDocumentosIncendio(
  admin: Admin, userId: string, apoliceId: string,
): Promise<void> {
  const pasta = `${userId}/incendio/${apoliceId}`
  const { data, error } = await admin.storage.from(SEGUROS_BUCKET).list(pasta)
  // Ver comentário em ../arquivos.ts: resíduo de dado pessoal no bucket.
  if (error) throw new Error(`Falha ao listar documentos: ${error.message}`)
  if (data?.length) {
    await admin.storage.from(SEGUROS_BUCKET).remove(data.map(a => `${pasta}/${a.name}`))
  }
}
