import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { Tag, Plus, Pencil, Trash2 } from 'lucide-react'
import { ConfirmDeleteButton } from '../_components/confirm-delete-button'

const COR_CLASSES: Record<string, { bg: string; text: string }> = {
  violet:  { bg: 'bg-violet-100',  text: 'text-violet-700'  },
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-700'    },
  orange:  { bg: 'bg-orange-100',  text: 'text-orange-700'  },
  teal:    { bg: 'bg-teal-100',    text: 'text-teal-700'    },
  green:   { bg: 'bg-green-100',   text: 'text-green-700'   },
  yellow:  { bg: 'bg-yellow-100',  text: 'text-yellow-700'  },
  red:     { bg: 'bg-red-100',     text: 'text-red-700'     },
  pink:    { bg: 'bg-pink-100',    text: 'text-pink-700'    },
}
const CORES = Object.keys(COR_CLASSES)

async function criarCategoria(formData: FormData) {
  'use server'
  const id = (formData.get('id') as string).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const label = (formData.get('label') as string).trim()
  const descricao = (formData.get('descricao') as string).trim()
  const cor = (formData.get('cor') as string) || 'violet'
  const ordem = parseInt(formData.get('ordem') as string) || 0
  if (!id || !label) return
  const supabase = createAdminClient()
  await supabase.from('categorias').insert({ id, label, descricao, cor, ordem })
  revalidatePath('/admin/categorias')
}

async function editarCategoria(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const label = (formData.get('label') as string).trim()
  const descricao = (formData.get('descricao') as string).trim()
  const cor = (formData.get('cor') as string) || 'violet'
  const ordem = parseInt(formData.get('ordem') as string) || 0
  if (!id || !label) return
  const supabase = createAdminClient()
  await supabase.from('categorias').update({ label, descricao, cor, ordem }).eq('id', id)
  revalidatePath('/admin/categorias')
}

async function excluirCategoria(id: string) {
  'use server'
  const supabase = createAdminClient()
  await supabase.from('categorias').delete().eq('id', id)
  revalidatePath('/admin/categorias')
}

const inputCls = "w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-gray-900 placeholder:text-gray-400 text-sm transition"

export default async function AdminCategoriasPage() {
  const supabase = createAdminClient()
  const { data: cats } = await supabase
    .from('categorias')
    .select('id, label, descricao, cor, ordem')
    .order('ordem')

  const { data: contagens } = await supabase
    .from('posts')
    .select('categoria')

  const countCat: Record<string, number> = {}
  contagens?.forEach(p => { countCat[p.categoria] = (countCat[p.categoria] ?? 0) + 1 })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Categorias do Blog</h1>
        <p className="text-sm text-gray-500 mt-0.5">Crie, renomeie ou exclua as categorias dos posts.</p>
      </div>

      {/* Nova categoria */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Plus size={14} /> Nova categoria
        </h2>
        <form action={criarCategoria} className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">ID (slug) *</label>
            <input name="id" required placeholder="ex: noticias" className={inputCls} />
            <p className="text-xs text-gray-400">Identificador único, só letras e hífens.</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Nome *</label>
            <input name="label" required placeholder="ex: Notícias" className={inputCls} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-gray-600">Descrição</label>
            <input name="descricao" placeholder="Breve descrição da categoria" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Cor</label>
            <select name="cor" className={inputCls}>
              {CORES.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Ordem</label>
            <input name="ordem" type="number" defaultValue={cats?.length ?? 0} className={inputCls} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              <Plus size={14} /> Criar categoria
            </button>
          </div>
        </form>
      </section>

      {/* Lista */}
      <div className="grid sm:grid-cols-2 gap-4">
        {(cats ?? []).map(cat => {
          const cor = COR_CLASSES[cat.cor] ?? COR_CLASSES.violet
          const total = countCat[cat.id] ?? 0
          return (
            <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full ${cor.bg} ${cor.text}`}>
                  <Tag size={13} />
                  {cat.label}
                </span>
                <div className="text-right">
                  <p className="text-xl font-bold text-gray-900">{total}</p>
                  <p className="text-xs text-gray-400">posts</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-4">{cat.descricao}</p>

              {/* Edit inline form */}
              <details className="group">
                <summary className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-violet-600 cursor-pointer list-none transition-colors">
                  <Pencil size={11} /> Editar
                </summary>
                <form action={editarCategoria} className="mt-3 space-y-3 pt-3 border-t border-gray-100">
                  <input type="hidden" name="id" value={cat.id} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Nome</label>
                      <input name="label" defaultValue={cat.label} required className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Cor</label>
                      <select name="cor" defaultValue={cat.cor} className={inputCls}>
                        {CORES.map(c => (
                          <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Descrição</label>
                    <input name="descricao" defaultValue={cat.descricao ?? ''} className={inputCls} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Ordem</label>
                      <input name="ordem" type="number" defaultValue={cat.ordem} className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    </div>
                    <button type="submit"
                      className="text-sm font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors">
                      Salvar
                    </button>
                  </div>
                </form>
              </details>

              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs text-gray-400">ID: <code className="bg-gray-100 px-1 rounded">{cat.id}</code></span>
                {total === 0 && (
                  <ConfirmDeleteButton
                    action={async () => { 'use server'; await excluirCategoria(cat.id) }}
                    mensagem={`Excluir a categoria "${cat.label}"?`}
                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Trash2 size={11} /> Excluir
                  </ConfirmDeleteButton>
                )}
                {total > 0 && (
                  <span className="text-xs text-gray-400">{total} post{total > 1 ? 's' : ''} — não pode excluir</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {(!cats || cats.length === 0) && (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <p className="text-gray-400 text-sm">Nenhuma categoria cadastrada. Crie a primeira acima.</p>
        </div>
      )}
    </div>
  )
}
