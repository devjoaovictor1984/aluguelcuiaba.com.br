'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function exigirAdmin(): Promise<{ id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: perfil } = await supabase.from('perfis').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'admin') throw new Error('Apenas admin')
  return { id: user.id }
}

export interface EditarPerfilInput {
  nome?: string | null
  tipo?: 'proprietario' | 'corretor' | 'imobiliaria' | null
  cpf?: string | null
  telefone?: string | null
  plano?: 'free' | 'basico' | 'profissional'
}

export async function editarPerfilAdmin(userId: string, input: EditarPerfilInput) {
  await exigirAdmin()
  const admin = createAdminClient()

  const payload: Record<string, unknown> = {}
  if ('nome' in input)     payload.nome = input.nome?.trim() || null
  if ('tipo' in input)     payload.tipo = input.tipo ?? null
  if ('cpf' in input)      payload.cpf = input.cpf?.trim() || null
  if ('telefone' in input) payload.telefone = input.telefone?.trim() || null
  if ('plano' in input)    payload.plano = input.plano

  const { error } = await admin.from('perfis').update(payload).eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/admin/usuarios')
  revalidatePath(`/admin/usuarios/${userId}`)
  return { ok: true }
}

export async function enviarResetSenhaAdmin(userId: string) {
  await exigirAdmin()
  const admin = createAdminClient()

  // Pega email do auth.users
  const { data: { user }, error: errUser } = await admin.auth.admin.getUserById(userId)
  if (errUser || !user?.email) return { error: errUser?.message ?? 'Usuário sem email' }

  // Dispara o email padrão de reset do Supabase
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/redefinir-senha`
  const { error } = await admin.auth.resetPasswordForEmail(user.email, {
    redirectTo: redirectTo || undefined,
  })
  if (error) return { error: error.message }

  return { ok: true, email: user.email }
}

export async function banirUsuarioAdmin(userId: string, motivo: string | null) {
  await exigirAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('perfis')
    .update({
      banido_em: new Date().toISOString(),
      banido_motivo: motivo?.trim() || null,
    })
    .eq('id', userId)
  if (error) return { error: error.message }

  // A próxima requisição autenticada cai no layout, que redireciona pra
  // /banido (e essa página faz signOut). Sessão ativa morre naturalmente.

  revalidatePath('/admin/usuarios')
  revalidatePath(`/admin/usuarios/${userId}`)
  return { ok: true }
}

export async function desbanirUsuarioAdmin(userId: string) {
  await exigirAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('perfis')
    .update({ banido_em: null, banido_motivo: null })
    .eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/admin/usuarios')
  revalidatePath(`/admin/usuarios/${userId}`)
  return { ok: true }
}

export async function excluirUsuarioAdmin(userId: string) {
  const me = await exigirAdmin()
  if (userId === me.id) return { error: 'Não dá pra excluir a própria conta admin.' }

  const admin = createAdminClient()
  // Apaga em auth.users — cascata via FK em perfis (ON DELETE CASCADE) cuida do resto.
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }

  revalidatePath('/admin/usuarios')
  redirect('/admin/usuarios')
}
