'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

/**
 * Apólices anexadas ao contrato (v97).
 *
 * Enquanto a emissão não sai do nosso painel, o seguro é feito na
 * plataforma da seguradora e o PDF chega aqui pela mão do corretor.
 * Quando a emissão automática entrar, ela grava na MESMA tabela com
 * `origem = 'plataforma'` e a tela continua igual.
 *
 * Bucket privado — a apólice traz CPF, endereço e valores. Nada de URL
 * pública: só signed URL de curta duração, igual aos documentos das
 * pessoas (actions-documentos.ts).
 */

const BUCKET = 'contratos-docs'
const MAX_FILE = 20 * 1024 * 1024

export type TipoApolice = 'apolice_incendio' | 'apolice_fianca'
const TIPOS_VALIDOS: TipoApolice[] = ['apolice_incendio', 'apolice_fianca']

export interface DadosApolice {
  seguradora: string
  apolice_numero: string
  vigencia_inicio: string
  vigencia_fim: string
  observacoes: string
}

function limparTexto(v: FormDataEntryValue | null, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

function limparData(v: FormDataEntryValue | null): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

/** Confirma que o contrato é do usuário logado antes de qualquer escrita. */
async function contratoDoUsuario(contratoId: string, userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('contratos_locacao')
    .select('id, codigo')
    .eq('id', contratoId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function uploadApolice(formData: FormData) {
  const acesso = await exigirAcessoCRM()

  const contratoId = formData.get('contrato_id')
  const tipo = formData.get('tipo')
  const file = formData.get('file')

  if (typeof contratoId !== 'string' || !contratoId) return { error: 'Contrato inválido.' }
  if (typeof tipo !== 'string' || !TIPOS_VALIDOS.includes(tipo as TipoApolice)) {
    return { error: 'Tipo de apólice inválido.' }
  }
  if (!(file instanceof File) || file.size === 0) return { error: 'Arquivo não enviado.' }
  if (file.size > MAX_FILE) return { error: 'Arquivo maior que 20MB.' }
  if (file.type !== 'application/pdf') return { error: 'A apólice precisa ser um PDF.' }

  const contrato = await contratoDoUsuario(contratoId, acesso.userId)
  if (!contrato) return { error: 'Contrato não encontrado.' }

  const admin = createAdminClient()
  const path = `${acesso.userId}/${contratoId}/${tipo}-${crypto.randomUUID()}.pdf`
  const bytes = await file.arrayBuffer()

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, new Uint8Array(bytes), { contentType: 'application/pdf', upsert: false })
  if (upErr) return { error: `Falha no upload: ${upErr.message}` }

  // `nome` e `tamanho` são as colunas originais da tabela (crm_locacao.sql),
  // e `nome` é NOT NULL. Preenche as duas versões pra não deixar a linha
  // meio vazia enquanto o nome antigo não sai de cena.
  const { error: dbErr } = await admin.from('contratos_documentos').insert({
    contrato_id: contratoId,
    user_id: acesso.userId,
    tipo,
    origem: 'manual',
    nome: file.name.slice(0, 255),
    nome_original: file.name.slice(0, 255),
    arquivo_path: path,
    tamanho: file.size,
    tamanho_bytes: file.size,
    mime_type: 'application/pdf',
    seguradora: limparTexto(formData.get('seguradora'), 120),
    apolice_numero: limparTexto(formData.get('apolice_numero'), 60),
    vigencia_inicio: limparData(formData.get('vigencia_inicio')),
    vigencia_fim: limparData(formData.get('vigencia_fim')),
    observacoes: limparTexto(formData.get('observacoes'), 500),
  })

  if (dbErr) {
    // Rollback: sem a linha no banco, o arquivo vira lixo invisível no bucket.
    await admin.storage.from(BUCKET).remove([path])
    return { error: `Falha ao registrar: ${dbErr.message}` }
  }

  revalidatePath(`/painel/contratos/${contratoId}`)
  return { ok: true }
}

/** Edita só os dados cadastrais — o PDF em si é substituído por novo upload. */
export async function atualizarApolice(documentoId: string, dados: DadosApolice) {
  const acesso = await exigirAcessoCRM()
  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('contratos_documentos')
    .select('id, contrato_id, user_id, origem')
    .eq('id', documentoId)
    .maybeSingle()
  if (!doc || doc.user_id !== acesso.userId) return { error: 'Apólice não encontrada.' }
  if (doc.origem === 'plataforma') {
    return { error: 'Esta apólice foi emitida pelo painel — os dados vêm da seguradora.' }
  }

  const corta = (v: string, max: number) => (v.trim() ? v.trim().slice(0, max) : null)
  const data = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

  const { error } = await admin
    .from('contratos_documentos')
    .update({
      seguradora: corta(dados.seguradora, 120),
      apolice_numero: corta(dados.apolice_numero, 60),
      vigencia_inicio: data(dados.vigencia_inicio),
      vigencia_fim: data(dados.vigencia_fim),
      observacoes: corta(dados.observacoes, 500),
    })
    .eq('id', documentoId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${doc.contrato_id}`)
  return { ok: true }
}

export async function removerApolice(documentoId: string) {
  const acesso = await exigirAcessoCRM()
  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('contratos_documentos')
    .select('id, contrato_id, user_id, arquivo_path, origem')
    .eq('id', documentoId)
    .maybeSingle()
  if (!doc || doc.user_id !== acesso.userId) return { error: 'Apólice não encontrada.' }
  if (doc.origem === 'plataforma') {
    return { error: 'Apólice emitida pelo painel — cancele pelo módulo de seguros.' }
  }

  if (doc.arquivo_path) await admin.storage.from(BUCKET).remove([doc.arquivo_path])
  const { error } = await admin.from('contratos_documentos').delete().eq('id', documentoId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${doc.contrato_id}`)
  return { ok: true }
}

/** Signed URL curta pra abrir/baixar. O link morre em 5 minutos. */
export async function gerarUrlApolice(documentoId: string): Promise<{ url?: string; error?: string }> {
  const acesso = await exigirAcessoCRM()
  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('contratos_documentos')
    .select('arquivo_path, user_id, nome_original, nome')
    .eq('id', documentoId)
    .maybeSingle()
  if (!doc || doc.user_id !== acesso.userId) return { error: 'Apólice não encontrada.' }
  if (!doc.arquivo_path) return { error: 'Esta apólice não tem arquivo anexado.' }

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(doc.arquivo_path, 300, { download: doc.nome_original ?? doc.nome ?? 'apolice.pdf' })
  if (error || !data) return { error: error?.message ?? 'Falha ao gerar o link.' }

  return { url: data.signedUrl }
}
