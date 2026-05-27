'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checarAcessoCRM } from '@/lib/crm/acesso'

export type CategoriaSugestao = 'bug' | 'sugestao' | 'duvida' | 'outro'
export type StatusSugestao = 'nova' | 'em_analise' | 'implementada' | 'descartada'

export interface NovaSugestaoInput {
  categoria: CategoriaSugestao
  mensagem: string
  pagina_url?: string | null
  pagina_titulo?: string | null
  user_agent?: string | null
}

export async function criarSugestao(input: NovaSugestaoInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  if (!input.mensagem?.trim()) return { error: 'Escreva sua sugestão antes de enviar.' }
  if (input.mensagem.length > 4000) return { error: 'Mensagem muito longa (máximo 4000 caracteres).' }

  const { error } = await supabase.from('sugestoes_usuario').insert({
    user_id: user.id,
    categoria: input.categoria,
    mensagem: input.mensagem.trim(),
    pagina_url: input.pagina_url?.slice(0, 500) ?? null,
    pagina_titulo: input.pagina_titulo?.slice(0, 200) ?? null,
    user_agent: input.user_agent?.slice(0, 500) ?? null,
  })

  if (error) return { error: error.message }
  return { ok: true }
}

/** Apenas admin. Lista todas as sugestões com info do usuário. */
export async function listarSugestoesAdmin(filtro?: { status?: StatusSugestao }) {
  const acesso = await checarAcessoCRM()
  if (!acesso || acesso.role !== 'admin') return { error: 'Acesso negado.' }

  const admin = createAdminClient()
  let q = admin
    .from('sugestoes_usuario')
    .select('*')
    .order('created_at', { ascending: false })

  if (filtro?.status) q = q.eq('status', filtro.status)

  const { data, error } = await q.limit(500)
  if (error) return { error: error.message }

  // Enriquece com nome/email do usuário (em paralelo)
  const userIds = Array.from(new Set((data ?? []).map(s => s.user_id)))
  const { data: perfis } = await admin
    .from('perfis')
    .select('id, nome, role')
    .in('id', userIds)

  const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const mapaEmail = new Map((usersData?.users ?? []).map(u => [u.id, u.email]))
  const mapaPerfil = new Map((perfis ?? []).map(p => [p.id, p]))

  const enriquecido = (data ?? []).map(s => ({
    ...s,
    user_email: mapaEmail.get(s.user_id) ?? null,
    user_nome: mapaPerfil.get(s.user_id)?.nome ?? null,
  }))

  return { ok: true, sugestoes: enriquecido }
}

export async function atualizarStatusSugestao(
  id: string,
  status: StatusSugestao,
  respostaAdmin?: string | null,
) {
  const acesso = await checarAcessoCRM()
  if (!acesso || acesso.role !== 'admin') return { error: 'Acesso negado.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('sugestoes_usuario')
    .update({
      status,
      resposta_admin: respostaAdmin?.trim() || null,
      respondido_em: respostaAdmin ? new Date().toISOString() : null,
      respondido_por: respostaAdmin ? acesso.userId : null,
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/painel/admin/sugestoes')
  return { ok: true }
}
