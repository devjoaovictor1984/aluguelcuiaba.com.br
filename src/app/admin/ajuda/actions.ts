'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function exigirAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erro: 'não autenticado' as const }
  const { data: perfil } = await supabase.from('perfis').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'admin') return { erro: 'só admin' as const }
  return { supabase }
}

export interface SalvarSecaoInput {
  id?: string
  slug: string
  titulo: string
  resumo: string | null
  icone: string | null
  ordem: number
  publicado: boolean
  conteudo_html: string
}

export async function salvarSecaoAjuda(input: SalvarSecaoInput) {
  const a = await exigirAdmin()
  if ('erro' in a) return { error: a.erro }
  const { supabase } = a

  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (!slug) return { error: 'slug inválido' }
  if (!input.titulo.trim()) return { error: 'título obrigatório' }

  const row = {
    slug,
    titulo: input.titulo.trim(),
    resumo: input.resumo?.trim() || null,
    icone: input.icone?.trim() || null,
    ordem: Number.isFinite(input.ordem) ? input.ordem : 100,
    publicado: input.publicado,
    conteudo_html: input.conteudo_html ?? '',
  }

  if (input.id) {
    const { error } = await supabase.from('ajuda_secoes').update(row).eq('id', input.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('ajuda_secoes').insert(row)
    if (error) return { error: error.message }
  }

  revalidatePath('/admin/ajuda')
  revalidatePath('/painel/ajuda')
  return { ok: true }
}

export async function apagarSecaoAjuda(id: string) {
  const a = await exigirAdmin()
  if ('erro' in a) return { error: a.erro }
  const { error } = await a.supabase.from('ajuda_secoes').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/ajuda')
  revalidatePath('/painel/ajuda')
  return { ok: true }
}
