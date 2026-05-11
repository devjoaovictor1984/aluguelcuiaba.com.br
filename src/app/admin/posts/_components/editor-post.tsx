'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Eye, EyeOff, Save, Upload, X } from 'lucide-react'
import { TipTapEditor } from './tiptap-editor'

interface Post {
  id?: string
  titulo?: string
  slug?: string
  descricao?: string
  conteudo?: string
  categoria?: string
  capa_url?: string | null
  publicado?: boolean
}

function gerarSlug(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
}

const CATEGORIAS = [
  { value: 'geral', label: 'Geral' },
  { value: 'dicas', label: 'Dicas' },
  { value: 'mercado', label: 'Mercado' },
  { value: 'legal', label: 'Legal' },
  { value: 'bairros', label: 'Bairros' },
  { value: 'financeiro', label: 'Financeiro' },
]

const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-gray-900 placeholder:text-gray-400 text-sm transition"

export function EditorPost({ post }: { post?: Post }) {
  const router = useRouter()
  const capaRef = useRef<HTMLInputElement>(null)

  const [titulo, setTitulo] = useState(post?.titulo ?? '')
  const [slug, setSlug] = useState(post?.slug ?? '')
  const [descricao, setDescricao] = useState(post?.descricao ?? '')
  const [capaUrl, setCapaUrl] = useState(post?.capa_url ?? '')
  const [conteudo, setConteudo] = useState(post?.conteudo ?? '')
  const [categoria, setCategoria] = useState(post?.categoria ?? 'geral')
  const [publicado, setPublicado] = useState(post?.publicado ?? false)
  const [preview, setPreview] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [uploadandoCapa, setUploadandoCapa] = useState(false)
  const [erro, setErro] = useState('')
  const [salvo, setSalvo] = useState(false)

  const uploadCapa = async (file: File) => {
    setUploadandoCapa(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `capas/${Date.now()}.${ext}`
    const { error, data } = await supabase.storage.from('post-images').upload(path, file, { upsert: true })
    setUploadandoCapa(false)
    if (error) { setErro(`Erro ao enviar capa: ${error.message}`); return }
    const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(data.path)
    setCapaUrl(publicUrl)
  }

  const handleSalvar = async () => {
    setErro('')
    if (!titulo.trim()) { setErro('Informe o título.'); return }
    if (!slug.trim()) { setErro('Informe o slug.'); return }

    setSalvando(true)
    const supabase = createClient()

    const payload = {
      titulo: titulo.trim(),
      slug: slug.trim(),
      descricao: descricao.trim(),
      capa_url: capaUrl.trim() || null,
      conteudo,
      categoria,
      publicado,
    }

    if (post?.id) {
      const { error } = await supabase.from('posts').update({
        ...payload, updated_at: new Date().toISOString(),
      }).eq('id', post.id)
      if (error) { setErro(error.message); setSalvando(false); return }
    } else {
      const { error } = await supabase.from('posts').insert(payload)
      if (error) { setErro(error.message); setSalvando(false); return }
    }

    setSalvo(true)
    setTimeout(() => { setSalvo(false); router.push('/admin/posts') }, 1200)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{post?.id ? 'Editar post' : 'Novo post'}</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPreview(v => !v)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-xl transition-colors">
            {preview ? <EyeOff size={14} /> : <Eye size={14} />}
            {preview ? 'Editar' : 'Preview'}
          </button>
          <button type="button" onClick={handleSalvar} disabled={salvando}
            className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {salvo ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Metadados */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Título</label>
          <input value={titulo}
            onChange={e => { setTitulo(e.target.value); if (!post?.id) setSlug(gerarSlug(e.target.value)) }}
            placeholder="Título do post" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Slug (URL)</label>
          <input value={slug} onChange={e => setSlug(e.target.value)}
            placeholder="titulo-do-post" className={`${inputCls} font-mono`} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Descrição (SEO)</label>
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
            placeholder="Breve descrição para SEO e compartilhamento..." rows={3}
            className={`${inputCls} resize-none`} />
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Categoria</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} className={`${inputCls} bg-white`}>
              {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => setPublicado(v => !v)}
            className="flex items-center justify-between w-full p-3 border-2 rounded-xl transition-colors"
            style={{ borderColor: publicado ? '#6D28D9' : '#E5E7EB', background: publicado ? '#EDE9FE' : 'white' }}>
            <span className="text-sm font-medium text-gray-700">{publicado ? '✓ Publicado' : 'Rascunho'}</span>
            <div className={`relative w-10 h-5 rounded-full transition-colors ${publicado ? 'bg-violet-600' : 'bg-gray-200'}`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${publicado ? 'translate-x-5' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Imagem de capa */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Imagem de capa</label>
        <div className="flex gap-3 items-start">
          <input
            value={capaUrl}
            onChange={e => setCapaUrl(e.target.value)}
            placeholder="Cole uma URL ou faça upload →"
            className={`${inputCls} flex-1`}
          />
          <button
            type="button"
            onClick={() => capaRef.current?.click()}
            disabled={uploadandoCapa}
            className="shrink-0 flex items-center gap-1.5 px-4 py-3 rounded-xl border-2 border-dashed border-violet-300 text-violet-700 text-sm font-medium hover:bg-violet-50 transition-colors disabled:opacity-50"
          >
            {uploadandoCapa ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploadandoCapa ? 'Enviando...' : 'Upload'}
          </button>
          <input ref={capaRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadCapa(f); e.target.value = '' }} />
        </div>
        {capaUrl && (
          <div className="relative inline-block">
            <img src={capaUrl} alt="Capa" className="h-32 rounded-xl object-cover border border-gray-200" />
            <button
              type="button"
              onClick={() => setCapaUrl('')}
              className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <p className="text-xs text-gray-400">Recomendado: 1200×630 px. Upload vai para o bucket <code className="bg-gray-100 px-1 rounded">post-images</code> do Supabase.</p>
      </div>

      {/* Editor */}
      {preview ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">{titulo || 'Sem título'}</h2>
          {descricao && <p className="text-gray-500 text-sm mb-6 italic">{descricao}</p>}
          <div
            className="prose prose-sm sm:prose-base max-w-none prose-headings:font-extrabold prose-a:text-violet-600 prose-blockquote:border-violet-400"
            dangerouslySetInnerHTML={{ __html: conteudo }}
          />
        </div>
      ) : (
        <TipTapEditor content={conteudo} onChange={setConteudo} />
      )}

      {erro && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">
          {erro}
        </div>
      )}
    </div>
  )
}
