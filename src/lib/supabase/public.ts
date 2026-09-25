import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase SEM cookie (anônimo), pra LEITURAS PÚBLICAS.
 *
 * Por que existe: o cliente padrão (`./server`) lê o cookie de sessão via
 * `cookies()`, e isso faz o Next marcar a página como dinâmica → desliga o
 * cache. Como as páginas públicas (imóvel, blog, bairro) são iguais pra todo
 * mundo, usamos este cliente — que NÃO toca em cookies — pra liberar o
 * cache/ISR. Respeita a RLS como visitante anônimo (mesmos dados que o
 * público já vê), então não expõe nada a mais.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

/**
 * Etiquetas das leituras públicas em cache.
 *
 * Quem publica, edita ou pausa um imóvel chama `revalidateTag(TAG_IMOVEIS)`
 * e derruba só o que mudou, em vez de esperar o relógio. É o que permite
 * cache sem anúncio velho na vitrine.
 */
export const TAG_IMOVEIS = 'imoveis-publicos'
export const TAG_BAIRROS = 'bairros-publicos'
