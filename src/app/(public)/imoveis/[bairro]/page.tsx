import { permanentRedirect, notFound } from 'next/navigation'
import { getImovelPorId } from '@/lib/supabase/queries'
import { buildImovelUrl } from '@/lib/utils'
import type { Imovel } from '@/types'

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
