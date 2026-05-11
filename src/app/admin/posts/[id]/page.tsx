import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { EditorPost } from '../_components/editor-post'

export default async function EditarPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const [{ data: post }, { data: cats }] = await Promise.all([
    supabase.from('posts').select('*').eq('id', id).single(),
    supabase.from('categorias').select('id, label').order('ordem'),
  ])
  if (!post) notFound()
  return <EditorPost post={post} categorias={cats ?? []} />
}
