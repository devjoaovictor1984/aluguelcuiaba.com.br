import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { EditorAjuda } from '../_components/editor-ajuda'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarSecaoAjudaPage({ params }: Props) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('ajuda_secoes')
    .select('id, slug, titulo, resumo, icone, ordem, publicado, conteudo_html')
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()

  return <EditorAjuda inicial={data} />
}
