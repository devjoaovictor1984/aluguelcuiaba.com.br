'use client'

import { useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Loader2, Link as LinkIcon, X, ImagePlus } from 'lucide-react'
import { adicionarBanner } from '../actions'

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900 placeholder:text-gray-400"

export function BannerUpload() {
  const [open, setOpen] = useState(false)
  const [imagemUrl, setImagemUrl] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState('')
  const [preview, setPreview] = useState('')
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setErro('')
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `banners/${Date.now()}.${ext}`
    const { error, data } = await supabase.storage
      .from('site-assets')
      .upload(path, file, { upsert: false, cacheControl: '86400' })
    setUploading(false)
    if (error) { setErro(`Erro no upload: ${error.message}`); return }
    const { data: { publicUrl } } = supabase.storage.from('site-assets').getPublicUrl(data.path)
    setImagemUrl(publicUrl)
    setPreview(publicUrl)
  }

  const handleSalvar = () => {
    if (!imagemUrl) { setErro('Faça o upload de uma imagem.'); return }
    setErro('')
    const fd = new FormData()
    fd.set('imagem_url', imagemUrl)
    fd.set('link_url', linkUrl)
    startTransition(async () => {
      const res = await adicionarBanner(fd)
      if (res?.error) { setErro(res.error); return }
      setOpen(false)
      setImagemUrl('')
      setLinkUrl('')
      setPreview('')
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
      >
        <ImagePlus size={16} />
        Adicionar banner
      </button>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Novo banner</h3>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      {/* Upload */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Imagem (1080×1080 recomendado)</p>
        {preview ? (
          <div className="relative w-32 h-32">
            <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-xl border border-gray-200" />
            <button
              onClick={() => { setPreview(''); setImagemUrl('') }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
            >
              <X size={10} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-violet-300 text-violet-700 text-sm font-medium hover:bg-violet-50 transition-colors disabled:opacity-50 w-full justify-center"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? 'Enviando...' : 'Fazer upload'}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />
      </div>

      {/* Link */}
      <div>
        <label className="text-xs text-gray-500 mb-1.5 flex items-center gap-1"><LinkIcon size={11} /> Link de destino (opcional)</label>
        <input
          type="url"
          value={linkUrl}
          onChange={e => setLinkUrl(e.target.value)}
          placeholder="https://exemplo.com.br"
          className={inputCls}
        />
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSalvar}
          disabled={isPending || uploading || !imagemUrl}
          className="flex-1 flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
          {isPending ? 'Salvando...' : 'Salvar banner'}
        </button>
        <button onClick={() => setOpen(false)} className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}
