'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { StatusImovel } from '@/types'

/**
 * Derruba o cache público de um imóvel depois que ele muda.
 *
 * A página do imóvel é ISR (`revalidate = 60` em
 * `(public)/imoveis/[bairro]/[slug]/page.tsx`) e os formulários de
 * anúncio escrevem direto do navegador com o supabase-js — nenhuma action
 * era chamada, então nada invalidava nada. O anúncio salvo continuava
 * servindo a versão anterior, e junto com ela o botão "Enviar", que monta
 * a mensagem do WhatsApp a partir do que a página tem em mãos: mudar de 1
 * pra 2 banheiros e compartilhar saía com 1.
 *
 * Recebe o id e resolve slug e bairro aqui no servidor — o caminho da
 * página não pode depender do que o cliente manda.
 */
export async function revalidarImovel(imovelId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('imoveis')
    .select('slug, bairro:bairros(slug)')
    .eq('id', imovelId)
    .single()

  const slug = data?.slug ?? imovelId
  const bairroSlug = (data?.bairro as { slug?: string } | null)?.slug

  // Os dois formatos que `buildImovelUrl` produz.
  if (bairroSlug) revalidatePath(`/imoveis/${bairroSlug}/${slug}`)
  else revalidatePath(`/imoveis/${slug}`)

  revalidatePath('/painel')
  revalidatePath('/')
  return { success: true }
}

export async function renovarAnuncio(imovelId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const expira_em = new Date()
  expira_em.setDate(expira_em.getDate() + 30)

  const { error } = await supabase
    .from('imoveis')
    .update({ expira_em: expira_em.toISOString(), status: 'ativo' })
    .eq('id', imovelId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  await revalidarImovel(imovelId)
  return { success: true }
}

export async function mudarStatusImovel(imovelId: string, status: StatusImovel) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('imoveis')
    .update({ status })
    .eq('id', imovelId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  await revalidarImovel(imovelId)
  return { success: true }
}
