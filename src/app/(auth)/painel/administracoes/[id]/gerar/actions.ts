'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

export interface ClausulaSnapshot {
  id: string
  titulo: string
  corpo: string
  categoria: string
}

type SB = Awaited<ReturnType<typeof createClient>>

/** Copia TODAS as cláusulas de administração do banco genérico para um snapshot novo. */
async function snapshotDoBanco(supabase: SB, userId: string): Promise<ClausulaSnapshot[]> {
  const { data } = await supabase
    .from('contrato_clausulas')
    .select('titulo, corpo, categoria')
    .eq('user_id', userId)
    .eq('tipo', 'administracao')
    .eq('ativa', true)
    .order('numero', { ascending: true })
  return (data ?? []).map(c => ({ id: randomUUID(), titulo: c.titulo, corpo: c.corpo, categoria: c.categoria }))
}

/** Obtém a geração do contrato de administração (com snapshot próprio de cláusulas),
 *  ou cria uma nova copiando o banco genérico. */
export async function obterOuCriarGeracaoAdm(contratoAdmId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: c } = await supabase
    .from('contratos_administracao')
    .select('id, user_id')
    .eq('id', contratoAdmId)
    .eq('user_id', acesso.userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!c) return { error: 'Contrato de administração não encontrado.' }

  const { data: existente } = await supabase
    .from('contrato_admin_geracoes')
    .select('*')
    .eq('contrato_admin_id', contratoAdmId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existente) {
    let clausulas = (existente.clausulas ?? []) as ClausulaSnapshot[]
    // Backfill: gerações antigas (antes do snapshot) copiam o conteúdo do banco
    // pelos clausula_ids; se nada, copiam todas as de administração.
    if (!Array.isArray(clausulas) || clausulas.length === 0) {
      const ids = (existente.clausula_ids ?? []) as string[]
      if (ids.length > 0) {
        const { data: bank } = await supabase
          .from('contrato_clausulas')
          .select('id, titulo, corpo, categoria')
          .in('id', ids)
          .eq('user_id', acesso.userId)
        const mapa = new Map((bank ?? []).map(b => [b.id, b]))
        clausulas = ids
          .map(id => mapa.get(id))
          .filter((b): b is NonNullable<typeof b> => !!b)
          .map(b => ({ id: randomUUID(), titulo: b.titulo, corpo: b.corpo, categoria: b.categoria }))
      }
      if (clausulas.length === 0) clausulas = await snapshotDoBanco(supabase, acesso.userId)
      await supabase.from('contrato_admin_geracoes')
        .update({ clausulas })
        .eq('id', existente.id).eq('user_id', acesso.userId)
    }
    return { ok: true, geracao: { ...existente, clausulas } }
  }

  const clausulas = await snapshotDoBanco(supabase, acesso.userId)
  const { data: nova, error } = await supabase
    .from('contrato_admin_geracoes')
    .insert({
      user_id: acesso.userId,
      contrato_admin_id: contratoAdmId,
      clausulas,
      clausula_ids: [],
      testemunha_ids: [],
      anexo_documento_ids: [],
      status: 'rascunho',
    })
    .select('*')
    .single()
  if (error || !nova) return { error: error?.message ?? 'Falha ao criar geração.' }
  return { ok: true, geracao: nova }
}

// ── Operações no snapshot de cláusulas DESTE contrato (não tocam o banco) ──
async function carregarSnap(supabase: SB, userId: string, geracaoId: string) {
  const { data: g } = await supabase
    .from('contrato_admin_geracoes')
    .select('id, contrato_admin_id, clausulas')
    .eq('id', geracaoId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' as const }
  return { g, clausulas: (g.clausulas ?? []) as ClausulaSnapshot[] }
}

async function salvarSnap(supabase: SB, userId: string, geracaoId: string, contratoAdmId: string, clausulas: ClausulaSnapshot[]) {
  const { error } = await supabase
    .from('contrato_admin_geracoes')
    .update({ clausulas })
    .eq('id', geracaoId)
    .eq('user_id', userId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/administracoes/${contratoAdmId}/gerar`)
  return { ok: true }
}

export async function editarClausulaGeracaoAdm(geracaoId: string, clausulaId: string, titulo: string, corpo: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const r = await carregarSnap(supabase, acesso.userId, geracaoId)
  if ('error' in r) return { error: r.error }
  const clausulas = r.clausulas.map(c => c.id === clausulaId ? { ...c, titulo: titulo.trim(), corpo: corpo.trim() } : c)
  return salvarSnap(supabase, acesso.userId, geracaoId, r.g.contrato_admin_id, clausulas)
}

export async function adicionarClausulaGeracaoAdm(geracaoId: string, clausula: { id?: string; titulo: string; corpo: string; categoria?: string }) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  if (!clausula.titulo?.trim() || !clausula.corpo?.trim()) return { error: 'Título e corpo são obrigatórios.' }
  const r = await carregarSnap(supabase, acesso.userId, geracaoId)
  if ('error' in r) return { error: r.error }
  const nova: ClausulaSnapshot = {
    id: clausula.id ?? randomUUID(),
    titulo: clausula.titulo.trim(),
    corpo: clausula.corpo.trim(),
    categoria: clausula.categoria ?? 'custom',
  }
  const res = await salvarSnap(supabase, acesso.userId, geracaoId, r.g.contrato_admin_id, [...r.clausulas, nova])
  return res.error ? res : { ok: true, id: nova.id }
}

export async function removerClausulaGeracaoAdm(geracaoId: string, clausulaId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const r = await carregarSnap(supabase, acesso.userId, geracaoId)
  if ('error' in r) return { error: r.error }
  return salvarSnap(supabase, acesso.userId, geracaoId, r.g.contrato_admin_id, r.clausulas.filter(c => c.id !== clausulaId))
}

export async function ordenarClausulasGeracaoAdm(geracaoId: string, ordemIds: string[]) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const r = await carregarSnap(supabase, acesso.userId, geracaoId)
  if ('error' in r) return { error: r.error }
  const mapa = new Map(r.clausulas.map(c => [c.id, c]))
  const reordenadas = ordemIds.map(id => mapa.get(id)).filter((c): c is ClausulaSnapshot => !!c)
  // mantém eventuais não listadas no fim (segurança)
  for (const c of r.clausulas) if (!ordemIds.includes(c.id)) reordenadas.push(c)
  return salvarSnap(supabase, acesso.userId, geracaoId, r.g.contrato_admin_id, reordenadas)
}

/** Marca/desmarca um item do checklist manual do contrato de administração. */
export async function marcarItemChecklistAdm(contratoAdmId: string, itemKey: string, feito: boolean) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: c } = await supabase
    .from('contratos_administracao')
    .select('checklist_manual')
    .eq('id', contratoAdmId)
    .eq('user_id', acesso.userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!c) return { error: 'Contrato não encontrado.' }

  const atual = (c.checklist_manual ?? {}) as Record<string, boolean>
  const novo = { ...atual }
  if (feito) novo[itemKey] = true
  else delete novo[itemKey]

  const { error } = await supabase
    .from('contratos_administracao')
    .update({ checklist_manual: novo })
    .eq('id', contratoAdmId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/administracoes/${contratoAdmId}/gerar`)
  return { ok: true }
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
