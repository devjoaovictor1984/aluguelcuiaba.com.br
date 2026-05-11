'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Loader2, X } from 'lucide-react'

interface Props {
  chave: 'logo_url' | 'favicon_url'
  urlAtual: string
  label: string
  hint: string
  onUpload: (url: string) => void
}

export function LogoUpload({ chave, urlAtual, label, hint, onUpload }: Props) {
  const [url, setUrl] = useState(urlAtual)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    setErro('')
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${chave}.${ext}`
    const { error, data } = await supabase.storage
      .from('site-assets')
      .upload(path, file, { upsert: true, cacheControl: '3600' })
    setUploading(false)
    if (error) { setErro(`Erro: ${error.message}`); return }
    const { data: { publicUrl } } = supabase.storage.from('site-assets').getPublicUrl(data.path)
    const final = `${publicUrl}?t=${Date.now()}`
    setUrl(final)
    onUpload(final)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-3 items-start flex-wrap">
        {url && (
          <div className="relative">
            <div className="h-12 min-w-[80px] px-3 flex items-center justify-center bg-gray-900 rounded-xl border border-gray-200">
              <img src={url} alt={label} className="h-8 max-w-[160px] w-auto object-contain" />
            </div>
            <button
              type="button"
              onClick={() => { setUrl(''); onUpload('') }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
            >
              <X size={10} />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-violet-300 text-violet-700 text-sm font-medium hover:bg-violet-50 transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? 'Enviando...' : url ? 'Trocar arquivo' : 'Fazer upload'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={chave === 'favicon_url' ? 'image/x-icon,image/png,image/svg+xml' : 'image/png,image/svg+xml,image/webp'}
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }}
        />
      </div>
      {/* Hidden input so the form value is submitted */}
      <input type="hidden" name={chave} value={url} />
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <p className="text-xs text-gray-400">{hint}</p>
    </div>
  )
}
