'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

export type TipoDocumento =
  | 'rg' | 'cpf' | 'cnh' | 'passaporte'
  | 'comprovante_renda' | 'comprovante_residencia'
  | 'contracheque' | 'extrato_bancario' | 'imposto_renda'
  | 'certidao_casamento' | 'certidao_nascimento'
  | 'foto' | 'outro'

const BUCKET = 'documentos-pessoas'
const TIPOS_VALIDOS: TipoDocumento[] = [
  'rg','cpf','cnh','passaporte',
  'comprovante_renda','comprovante_residencia',
  'contracheque','extrato_bancario','imposto_renda',
  'certidao_casamento','certidao_nascimento',
  'foto','outro',
]

function extensaoDe(nome: string): string {
  const idx = nome.lastIndexOf('.')
  if (idx === -1) return ''
  return nome.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
}

export async function uploadDocumentoPessoa(formData: FormData) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const pessoaId = formData.get('pessoa_id')
  const tipo = formData.get('tipo')
  const file = formData.get('file')
  const validade = formData.get('validade')
  const observacao = formData.get('observacao')

  if (typeof pessoaId !== 'string' || !pessoaId) return { error: 'Pessoa inválida.' }
  if (typeof tipo !== 'string' || !TIPOS_VALIDOS.includes(tipo as TipoDocumento)) {
    return { error: 'Tipo de documento inválido.' }
  }
  if (!(file instanceof File) || file.size === 0) return { error: 'Arquivo não enviado.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'Arquivo maior que 10MB.' }

  const mime = file.type
  const permitidos = ['image/jpeg','image/jpg','image/png','image/webp','image/heic','application/pdf']
  if (!permitidos.includes(mime)) {
    return { error: 'Formato não suportado. Envie JPG, PNG, WEBP, HEIC ou PDF.' }
  }

  // Confirma posse da pessoa
  const { data: pessoa } = await supabase
    .from('pessoas')
    .select('id')
    .eq('id', pessoaId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!pessoa) return { error: 'Pessoa não encontrada.' }

  const admin = createAdminClient()
  const ext = extensaoDe(file.name) || mime.split('/')[1] || 'bin'
  const uuid = crypto.randomUUID()
  const path = `${acesso.userId}/${pessoaId}/${uuid}.${ext}`

  const bytes = await file.arrayBuffer()
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, new Uint8Array(bytes), {
      contentType: mime,
      upsert: false,
    })
  if (upErr) return { error: `Falha no upload: ${upErr.message}` }

  const { error: dbErr } = await admin
    .from('pessoas_documentos')
    .insert({
      pessoa_id: pessoaId,
      user_id: acesso.userId,
      tipo,
      arquivo_path: path,
      nome_original: file.name.slice(0, 255),
      tamanho_bytes: file.size,
      mime_type: mime,
      validade: typeof validade === 'string' && validade ? validade : null,
      observacao: typeof observacao === 'string' && observacao ? observacao.slice(0, 500) : null,
    })

  if (dbErr) {
    // Rollback do storage
    await admin.storage.from(BUCKET).remove([path])
    return { error: `Falha ao registrar: ${dbErr.message}` }
  }

  revalidatePath(`/painel/clientes/${pessoaId}`)
  return { ok: true }
}

export async function removerDocumentoPessoa(documentoId: string) {
  const acesso = await exigirAcessoCRM()
  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('pessoas_documentos')
    .select('id, pessoa_id, arquivo_path, user_id')
    .eq('id', documentoId)
    .maybeSingle()
  if (!doc || doc.user_id !== acesso.userId) return { error: 'Documento não encontrado.' }

  await admin.storage.from(BUCKET).remove([doc.arquivo_path])
  const { error } = await admin.from('pessoas_documentos').delete().eq('id', documentoId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/clientes/${doc.pessoa_id}`)
  return { ok: true }
}

export async function gerarUrlDocumento(documentoId: string): Promise<{ url?: string; error?: string }> {
  const acesso = await exigirAcessoCRM()
  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('pessoas_documentos')
    .select('arquivo_path, user_id, nome_original')
    .eq('id', documentoId)
    .maybeSingle()
  if (!doc || doc.user_id !== acesso.userId) return { error: 'Documento não encontrado.' }

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(doc.arquivo_path, 300, { download: doc.nome_original })

  if (error || !data) return { error: error?.message ?? 'Falha ao gerar URL.' }
  return { url: data.signedUrl }
}
