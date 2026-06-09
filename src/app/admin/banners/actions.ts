'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function adicionarBanner(formData: FormData) {
  const imagem_url = formData.get('imagem_url') as string
  const link_url = (formData.get('link_url') as string) || null

  if (!imagem_url) return { error: 'Imagem obrigatória' }

  const supabase = createAdminClient()
  const { count, error: errCount } = await supabase
    .from('banners_sidebar')
    .select('*', { count: 'exact', head: true })

  if (errCount) {
    if (errCount.code === '42P01') {
      return { error: 'Tabela banners_sidebar não existe. Execute o SQL no Supabase SQL Editor (veja o aviso amarelo na página).' }
    }
    return { error: errCount.message }
  }

  const { error } = await supabase.from('banners_sidebar').insert({
    imagem_url,
    link_url,
    ordem: (count ?? 0),
    ativo: true,
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/banners')
  revalidatePath('/')
  revalidatePath('/blog')
  return { ok: true }
}

export async function excluirBanner(id: string, imagemUrl: string) {
  const supabase = createAdminClient()

  // Remove from storage if it's in site-assets/banners/
  try {
    const url = new URL(imagemUrl)
    const parts = url.pathname.split('/site-assets/')
    if (parts[1]) {
      await supabase.storage.from('site-assets').remove([parts[1]])
    }
  } catch {}

  const { error } = await supabase.from('banners_sidebar').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/banners')
  revalidatePath('/')
  return { ok: true }
}

export async function atualizarLinkBanner(id: string, linkUrl: string) {
  const supabase = createAdminClient()

  // Normaliza: vazio = sem link; domínio sem esquema vira https://
  let link: string | null = linkUrl.trim() || null
  if (link && !link.startsWith('http://') && !link.startsWith('https://') && !link.startsWith('/')) {
    link = `https://${link}`
  }

  const { error } = await supabase
    .from('banners_sidebar')
    .update({ link_url: link })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/banners')
  revalidatePath('/')
  revalidatePath('/blog')
  return { ok: true, link_url: link }
}

export async function toggleBannerAtivo(id: string, ativo: boolean) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('banners_sidebar')
    .update({ ativo })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/banners')
  revalidatePath('/')
  return { ok: true }
}

export async function reordenarBanner(id: string, direcao: 'up' | 'down', ordemAtual: number) {
  const supabase = createAdminClient()
  const novaOrdem = direcao === 'up' ? ordemAtual - 1 : ordemAtual + 1

  const { data: vizinho } = await supabase
    .from('banners_sidebar')
    .select('id, ordem')
    .eq('ordem', novaOrdem)
    .single()

  if (!vizinho) return { ok: true }

  await supabase.from('banners_sidebar').update({ ordem: novaOrdem }).eq('id', id)
  await supabase.from('banners_sidebar').update({ ordem: ordemAtual }).eq('id', vizinho.id)

  revalidatePath('/admin/banners')
  revalidatePath('/')
  return { ok: true }
}
