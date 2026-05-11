import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { Plus, Pencil, ExternalLink } from 'lucide-react'
import { ConfirmDeleteButton } from '../_components/confirm-delete-button'

async function togglePublicado(id: string, publicado: boolean) {
  'use server'
  const supabase = createAdminClient()
  await supabase.from('posts').update({ publicado: !publicado }).eq('id', id)
  revalidatePath('/admin/posts')
}

async function excluirPost(id: string) {
  'use server'
  const supabase = createAdminClient()
  await supabase.from('posts').delete().eq('id', id)
  revalidatePath('/admin/posts')
}

export default async function AdminPostsPage() {
  const supabase = createAdminClient()
  const { data: posts } = await supabase
    .from('posts')
    .select('id, titulo, categoria, publicado, created_at')
    .order('created_at', { ascending: false })

  const CAT_LABEL: Record<string, string> = {
    geral: 'Geral', dicas: 'Dicas', mercado: 'Mercado',
    legal: 'Legal', bairros: 'Bairros', financeiro: 'Financeiro',
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Posts do Blog</h1>
        <Link href="/admin/posts/novo"
          className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={15} />
          Novo post
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {(!posts || posts.length === 0) ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-3">Nenhum post publicado.</p>
            <Link href="/admin/posts/novo" className="text-violet-600 text-sm font-medium hover:underline">Criar primeiro post</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {posts.map(p => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{p.titulo}</p>
                  <p className="text-xs text-gray-400">
                    {CAT_LABEL[p.categoria] ?? p.categoria} · {new Date(p.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <form action={async () => {
                    'use server'
                    await togglePublicado(p.id, p.publicado)
                  }}>
                    <button type="submit"
                      className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                        p.publicado
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}>
                      {p.publicado ? 'Publicado' : 'Rascunho'}
                    </button>
                  </form>
                  <Link href={`/admin/posts/${p.id}`}
                    className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                    <Pencil size={14} />
                  </Link>
                  <Link href={`/blog/${p.slug}`} target="_blank"
                    className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                    <ExternalLink size={14} />
                  </Link>
                  <ConfirmDeleteButton
                    action={async () => { 'use server'; await excluirPost(p.id) }}
                    mensagem="Excluir este post permanentemente?"
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Excluir
                  </ConfirmDeleteButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
