import { createAdminClient } from '@/lib/supabase/admin'
import { EditorPost } from '../_components/editor-post'

export default async function NovoPostPage() {
  const supabase = createAdminClient()
  const { data: cats } = await supabase.from('categorias').select('id, label').order('ordem')
  return <EditorPost categorias={cats ?? []} />
}
