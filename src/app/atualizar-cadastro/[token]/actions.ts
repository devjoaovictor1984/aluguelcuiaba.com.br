'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

const BUCKET = 'documentos-pessoas'
const MIMES_PERMITIDOS = ['image/jpeg','image/jpg','image/png','image/webp','image/heic','application/pdf']
const MAX_FILE = 10 * 1024 * 1024
const TIPOS_DOC_VALIDOS = [
  'rg','cpf','cnh','passaporte',
  'comprovante_renda','comprovante_residencia',
  'contracheque','extrato_bancario','imposto_renda',
  'certidao_casamento','certidao_nascimento',
  'foto','outro',
]

interface Solicitacao {
  id: string
  user_id: string
  pessoa_id: string
  campos: string[]
  tipos_documento: string[]
  expira_em: string
  preenchido_em: string | null
  revogado_em: string | null
}

function extensaoDe(nome: string, mime: string): string {
  const idx = nome.lastIndexOf('.')
  if (idx !== -1) {
    const ext = nome.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
    if (ext) return ext
  }
  return mime.split('/')[1] ?? 'bin'
}

async function carregarSolicitacao(token: string): Promise<{ sol?: Solicitacao; error?: string }> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('solicitacoes_cadastro')
    .select('id, user_id, pessoa_id, campos, tipos_documento, expira_em, preenchido_em, revogado_em')
    .eq('token', token)
    .maybeSingle()
  if (!data) return { error: 'Link inválido ou não encontrado.' }
  if (data.revogado_em) return { error: 'Este link foi revogado pelo solicitante.' }
  if (data.preenchido_em) return { error: 'Este link já foi usado.' }
  if (new Date(data.expira_em).getTime() < Date.now()) return { error: 'Link expirado. Peça um novo ao solicitante.' }
  return { sol: data as Solicitacao }
}

export async function submitAtualizacaoCadastro(token: string, formData: FormData) {
  const { sol, error: erroLink } = await carregarSolicitacao(token)
  if (!sol || erroLink) return { error: erroLink ?? 'Link inválido.' }

  const admin = createAdminClient()

  // 1. Atualiza só os campos liberados na solicitação
  const payload: Record<string, unknown> = {}
  for (const campo of sol.campos) {
    const raw = formData.get(campo)
    if (typeof raw === 'string') {
      const trimmed = raw.trim()
      payload[campo] = trimmed === '' ? null : trimmed
    }
  }

  if (Object.keys(payload).length > 0) {
    const { error } = await admin
      .from('pessoas')
      .update(payload)
      .eq('id', sol.pessoa_id)
      .eq('user_id', sol.user_id)
    if (error) return { error: `Erro ao salvar dados: ${error.message}` }
  }

  // 2. Sobe os documentos liberados
  for (const tipo of sol.tipos_documento) {
    if (!TIPOS_DOC_VALIDOS.includes(tipo)) continue
    const file = formData.get(`doc_${tipo}`)
    if (!(file instanceof File) || file.size === 0) continue
    if (file.size > MAX_FILE) return { error: `${tipo}: arquivo maior que 10MB.` }
    if (!MIMES_PERMITIDOS.includes(file.type)) {
      return { error: `${tipo}: formato não suportado. Envie JPG, PNG, WEBP, HEIC ou PDF.` }
    }

    const uuid = crypto.randomUUID()
    const ext = extensaoDe(file.name, file.type)
    const path = `${sol.user_id}/${sol.pessoa_id}/${uuid}.${ext}`

    const bytes = await file.arrayBuffer()
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, new Uint8Array(bytes), { contentType: file.type, upsert: false })
    if (upErr) return { error: `${tipo}: ${upErr.message}` }

    const { error: dbErr } = await admin.from('pessoas_documentos').insert({
      pessoa_id: sol.pessoa_id,
      user_id: sol.user_id,
      tipo,
      arquivo_path: path,
      nome_original: file.name.slice(0, 255),
      tamanho_bytes: file.size,
      mime_type: file.type,
      observacao: 'Enviado via link de atualização',
    })
    if (dbErr) {
      await admin.storage.from(BUCKET).remove([path])
      return { error: `${tipo}: ${dbErr.message}` }
    }
  }

  // 3. Marca como preenchido
  const hdrs = await headers()
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0].trim() ??
    hdrs.get('x-real-ip') ??
    null

  await admin
    .from('solicitacoes_cadastro')
    .update({ preenchido_em: new Date().toISOString(), preenchido_ip: ip })
    .eq('id', sol.id)

  return { ok: true }
}
