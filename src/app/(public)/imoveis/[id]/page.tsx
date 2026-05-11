import { permanentRedirect, notFound } from 'next/navigation'
import { getImovelPorId } from '@/lib/supabase/queries'
import { buildImovelUrl } from '@/lib/utils'
import type { Imovel } from '@/types'

export default async function OldImovelRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: imovel } = await getImovelPorId(id)
  if (!imovel) notFound()
  permanentRedirect(buildImovelUrl(imovel as Imovel))
}
