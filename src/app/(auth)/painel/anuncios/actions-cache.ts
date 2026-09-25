'use server'

import { updateTag } from 'next/cache'
import { TAG_IMOVEIS } from '@/lib/supabase/public'

/**
 * Derruba o cache das leituras públicas de imóveis.
 *
 * As páginas da vitrine passaram a ser servidas de cache: sem isto, um
 * anúncio novo levaria até um minuto pra aparecer na home. Chamando aqui
 * logo depois de publicar, editar ou apagar, a vitrine se atualiza na
 * hora — o cache deixa de depender do relógio e passa a depender do que
 * de fato mudou.
 *
 * Os formulários gravam direto pelo cliente do navegador, então esta
 * action existe só pra dar ao servidor a chance de invalidar.
 */
export async function invalidarVitrine() {
  // `updateTag`, e não `revalidateTag`: o anunciante acabou de salvar e vai
  // conferir o resultado agora. Este expira o cache na hora e a próxima
  // leitura espera o dado novo; o outro serve o velho enquanto atualiza
  // por baixo — que é ótimo pra robô e péssimo pra quem acabou de publicar.
  updateTag(TAG_IMOVEIS)
  return { ok: true }
}
