import { permanentRedirect, notFound } from 'next/navigation'
import { getImovelPorId } from '@/lib/supabase/queries'
import { buildImovelUrl } from '@/lib/utils'
import type { Imovel } from '@/types'

// ISR — servida do cache e regerada no máximo a cada 60s.
// Listagem do bairro: muda quando entra ou sai anúncio.
// Só funciona porque as queries usam o cliente público (sem cookie).
export const revalidate = 60

// Sem generateStaticParams, rota com parâmetro é tratada como dinâmica.
// Retornar [] não pré-gera nada no build: cada página é renderizada na
// 1ª visita e cacheada a partir dali.
export async function generateStaticParams() {
  return []
}

// Fallback para URLs antigas no formato /imoveis/{id-ou-slug}.
// Se for um ID/slug válido de imóvel, redireciona para a URL SEO nova
// (/imoveis/{bairro}/{slug}). Caso contrário, 404.
export default async function ImovelLegacyRedirect({
  params,
}: {
  params: Promise<{ bairro: string }>
}) {
  const { bairro } = await params
  const { data: imovel } = await getImovelPorId(bairro)
  if (!imovel) notFound()
  permanentRedirect(buildImovelUrl(imovel as Imovel))
}
