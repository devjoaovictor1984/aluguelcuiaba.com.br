'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { criarSessao } from '@/lib/homologacao/sessao'

/**
 * Ações do painel de homologação. Só admin — a checagem é aqui e não só
 * na página: server action é endpoint POST público.
 */
async function exigirAdmin(): Promise<{ userId?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data: perfil } = await supabase
    .from('perfis').select('role').eq('id', user.id).maybeSingle()
  if (perfil?.role !== 'admin') return { error: 'Sem permissão.' }

  return { userId: user.id }
}

export async function abrirSessaoHomologacao(input: {
  nome: string
  organizacao?: string
  observacao?: string
  dias: number
}) {
  const auth = await exigirAdmin()
  if (auth.error || !auth.userId) return { error: auth.error }

  if (!input.nome.trim()) return { error: 'Informe para quem é o acesso.' }
  if (!(input.dias > 0) || input.dias > 90) return { error: 'O prazo deve ser de 1 a 90 dias.' }

  const r = await criarSessao({ criadoPor: auth.userId, ...input })
  if (r.error) return { error: r.error }

  revalidatePath('/admin/homologacao')
  return { ok: true, token: r.token }
}

export async function revogarSessaoHomologacao(sessaoId: string) {
  const auth = await exigirAdmin()
  if (auth.error) return { error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('sessoes_homologacao')
    .update({ revogada_em: new Date().toISOString() })
    .eq('id', sessaoId)
  if (error) return { error: error.message }

  revalidatePath('/admin/homologacao')
  return { ok: true }
}

/** Marca um apontamento como tratado, com o que foi feito. */
export async function resolverApontamento(id: string, resolucao: string) {
  const auth = await exigirAdmin()
  if (auth.error) return { error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin.from('homologacao_apontamentos').update({
    resolvido_em: new Date().toISOString(),
    resolucao: resolucao.trim() || null,
  }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/homologacao')
  return { ok: true }
}

export async function reabrirApontamento(id: string) {
  const auth = await exigirAdmin()
  if (auth.error) return { error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin.from('homologacao_apontamentos')
    .update({ resolvido_em: null, resolucao: null })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/homologacao')
  return { ok: true }
}
