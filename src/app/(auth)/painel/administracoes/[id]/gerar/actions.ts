'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

/** Obtém a geração existente do contrato de administração, ou cria uma nova
 *  com todas as cláusulas tipo='administracao' ativas do user. */
export async function obterOuCriarGeracaoAdm(contratoAdmId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  // Confirma posse
  const { data: c } = await supabase
    .from('contratos_administracao')
    .select('id, user_id')
    .eq('id', contratoAdmId)
    .eq('user_id', acesso.userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!c) return { error: 'Contrato de administração não encontrado.' }

  // Geração existente?
  const { data: existente } = await supabase
    .from('contrato_admin_geracoes')
    .select('*')
    .eq('contrato_admin_id', contratoAdmId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existente) return { ok: true, geracao: existente }

  // Pega TODAS cláusulas tipo='administracao' do user (em ordem)
  const { data: clausulas } = await supabase
    .from('contrato_clausulas')
    .select('id, numero')
    .eq('user_id', acesso.userId)
    .eq('tipo', 'administracao')
    .eq('ativa', true)
    .order('numero', { ascending: true })

  const clausulaIds = (clausulas ?? []).map(cl => cl.id)

  const { data: nova, error } = await supabase
    .from('contrato_admin_geracoes')
    .insert({
      user_id: acesso.userId,
      contrato_admin_id: contratoAdmId,
      clausula_ids: clausulaIds,
      testemunha_ids: [],
      anexo_documento_ids: [],
      status: 'rascunho',
    })
    .select('*')
    .single()

  if (error || !nova) return { error: error?.message ?? 'Falha ao criar geração.' }
  // Sem revalidatePath: essa função é chamada de dentro do render (page.tsx)
  // e o Next 16 proíbe revalidate durante render. A página já tem force-dynamic.
  return { ok: true, geracao: nova }
}

export async function atualizarOrdemClausulasAdm(geracaoId: string, novaOrdem: string[]) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (!Array.isArray(novaOrdem)) return { error: 'Ordem inválida.' }

  const { data: g } = await supabase
    .from('contrato_admin_geracoes')
    .select('id, contrato_admin_id')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }

  const { error } = await supabase
    .from('contrato_admin_geracoes')
    .update({ clausula_ids: novaOrdem })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/administracoes/${g.contrato_admin_id}/gerar`)
  return { ok: true }
}

export async function alternarClausulaNaGeracaoAdm(geracaoId: string, clausulaId: string, incluir: boolean) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: g } = await supabase
    .from('contrato_admin_geracoes')
    .select('id, contrato_admin_id, clausula_ids')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }

  const ids = (g.clausula_ids ?? []) as string[]
  const novaLista = incluir
    ? (ids.includes(clausulaId) ? ids : [...ids, clausulaId])
    : ids.filter(id => id !== clausulaId)

  const { error } = await supabase
    .from('contrato_admin_geracoes')
    .update({ clausula_ids: novaLista })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/administracoes/${g.contrato_admin_id}/gerar`)
  return { ok: true }
}

export async function atualizarTestemunhasAdm(geracaoId: string, ids: string[]) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const limitada = ids.slice(0, 2)
  const { data: g } = await supabase
    .from('contrato_admin_geracoes')
    .select('id, contrato_admin_id')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }

  const { error } = await supabase
    .from('contrato_admin_geracoes')
    .update({ testemunha_ids: limitada })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/administracoes/${g.contrato_admin_id}/gerar`)
  return { ok: true }
}

export async function atualizarAnexosDocumentosAdm(geracaoId: string, ids: string[]) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: g } = await supabase
    .from('contrato_admin_geracoes')
    .select('id, contrato_admin_id')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }

  const { error } = await supabase
    .from('contrato_admin_geracoes')
    .update({ anexo_documento_ids: ids })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/administracoes/${g.contrato_admin_id}/gerar`)
  return { ok: true }
}

export async function uploadAdmAssinado(geracaoId: string, formData: FormData) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Arquivo não enviado.' }
  if (file.size > 20 * 1024 * 1024) return { error: 'Arquivo maior que 20MB.' }
  if (file.type !== 'application/pdf') return { error: 'O arquivo precisa ser um PDF.' }

  const { data: g } = await supabase
    .from('contrato_admin_geracoes')
    .select('id, contrato_admin_id, pdf_assinado_path')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }

  if (g.pdf_assinado_path) {
    await supabase.storage.from('contratos-pdf').remove([g.pdf_assinado_path])
  }

  const path = `${acesso.userId}/${geracaoId}/admin-assinado-${Date.now()}.pdf`
  const bytes = await file.arrayBuffer()

  const { error: upErr } = await supabase.storage
    .from('contratos-pdf')
    .upload(path, new Uint8Array(bytes), { contentType: 'application/pdf', upsert: false })
  if (upErr) return { error: upErr.message }

  const { data: pub } = supabase.storage.from('contratos-pdf').getPublicUrl(path)

  const { error: dbErr } = await supabase
    .from('contrato_admin_geracoes')
    .update({
      pdf_assinado_url: pub.publicUrl,
      pdf_assinado_path: path,
      assinado_em: new Date().toISOString(),
      status: 'assinado',
    })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (dbErr) {
    await supabase.storage.from('contratos-pdf').remove([path])
    return { error: dbErr.message }
  }

  revalidatePath(`/painel/administracoes/${g.contrato_admin_id}/gerar`)
  return { ok: true, url: pub.publicUrl }
}
