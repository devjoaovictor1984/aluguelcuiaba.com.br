'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

// Renovar / mudar status / excluir anúncio: ver ./anuncios/actions-crud.ts
// (conferem dono OU admin no servidor).
