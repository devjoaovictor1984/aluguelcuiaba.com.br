'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { updateTag } from 'next/cache'
import { LABELS_DOC, TIPOS_DOC_VALIDOS } from '@/lib/crm/tipos-documento'
import { CHAVES_CAMPO_IMOVEL, dadosImovelParaColunas } from '@/lib/crm/campos-imovel'
import { TAG_IMOVEIS } from '@/lib/supabase/public'

const BUCKET = 'documentos-pessoas'
const MIMES_PERMITIDOS = ['image/jpeg','image/jpg','image/png','image/webp','image/heic','application/pdf']
const MAX_FILE = 10 * 1024 * 1024

interface Solicitacao {
  id: string
  user_id: string
  pessoa_id: string
  campos: string[]
  tipos_documento: string[]
  campos_imovel?: string[] | null
  imovel_id?: string | null
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
  let { data } = await admin
    .from('solicitacoes_cadastro')
    .select('id, user_id, pessoa_id, campos, tipos_documento, campos_imovel, imovel_id, expira_em, preenchido_em, revogado_em')
    .eq('token', token)
    .maybeSingle()
  if (!data) {
    // Banco sem a v100: lê sem as colunas do imóvel.
    const r = await admin
      .from('solicitacoes_cadastro')
      .select('id, user_id, pessoa_id, campos, tipos_documento, expira_em, preenchido_em, revogado_em')
      .eq('token', token)
      .maybeSingle()
    data = r.data ? { ...r.data, campos_imovel: [], imovel_id: null } : null
  }
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

  // 2. Bloco do imóvel: guarda tudo na solicitação e, se o imóvel já
  //    existe, leva pras colunas dele.
  const camposImovel = (sol.campos_imovel ?? []).filter(c => CHAVES_CAMPO_IMOVEL.includes(c))
  let dadosImovel: Record<string, string> | null = null
  if (camposImovel.length > 0) {
    dadosImovel = {}
    for (const campo of camposImovel) {
      const raw = formData.get(campo)
      if (typeof raw === 'string' && raw.trim() !== '') dadosImovel[campo] = raw.trim().slice(0, 2000)
    }
    if (sol.imovel_id) {
      const colunas = dadosImovelParaColunas(dadosImovel)
      if (Object.keys(colunas).length > 0) {
        const { error } = await admin
          .from('imoveis')
          .update(colunas)
          .eq('id', sol.imovel_id)
          .eq('user_id', sol.user_id)
        if (error) return { error: `Erro ao salvar dados do imóvel: ${error.message}` }
        updateTag(TAG_IMOVEIS)
      }
    }
  }

  // 3. Sobe os documentos liberados
  for (const tipo of sol.tipos_documento) {
    if (!TIPOS_DOC_VALIDOS.includes(tipo)) continue
    const file = formData.get(`doc_${tipo}`)
    if (!(file instanceof File) || file.size === 0) continue
    const nomeTipo = LABELS_DOC[tipo] ?? tipo
    if (file.size > MAX_FILE) return { error: `${nomeTipo}: arquivo maior que 10MB.` }
    if (!MIMES_PERMITIDOS.includes(file.type)) {
      return { error: `${nomeTipo}: formato não suportado. Envie JPG, PNG, WEBP, HEIC ou PDF.` }
    }

    const uuid = crypto.randomUUID()
    const ext = extensaoDe(file.name, file.type)
    const path = `${sol.user_id}/${sol.pessoa_id}/${uuid}.${ext}`

    const bytes = await file.arrayBuffer()
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, new Uint8Array(bytes), { contentType: file.type, upsert: false })
    if (upErr) return { error: `${nomeTipo}: ${upErr.message}` }

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
      return { error: `${nomeTipo}: ${dbErr.message}` }
    }
  }

  // 4. Marca como preenchido
  const hdrs = await headers()
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0].trim() ??
    hdrs.get('x-real-ip') ??
    null

  await admin
    .from('solicitacoes_cadastro')
    .update({
      preenchido_em: new Date().toISOString(),
      preenchido_ip: ip,
      ...(dadosImovel ? { dados_imovel: dadosImovel } : {}),
    })
    .eq('id', sol.id)

  return { ok: true }
}
