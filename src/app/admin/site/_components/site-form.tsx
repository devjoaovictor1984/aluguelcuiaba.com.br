'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogoUpload } from './logo-upload'
import { Loader2, Check, AlertCircle } from 'lucide-react'

interface Props {
  cfg: Record<string, string>
}

const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-gray-900 placeholder:text-gray-400 text-sm transition"

export function SiteForm({ cfg }: Props) {
  const [logoUrl, setLogoUrl] = useState(cfg.logo_url ?? '')
  const [faviconUrl, setFaviconUrl] = useState(cfg.favicon_url ?? '')
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'ok' | 'erro'>('idle')
  const [erro, setErro] = useState('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    // Override logo/favicon from state (managed by upload component)
    const valores: Record<string, string> = {
      logo_url: logoUrl,
      favicon_url: faviconUrl,
      contato_email: fd.get('contato_email') as string || '',
      contato_whatsapp: fd.get('contato_whatsapp') as string || '',
      home_titulo: fd.get('home_titulo') as string || '',
      home_descricao: fd.get('home_descricao') as string || '',
      home_seo_titulo: fd.get('home_seo_titulo') as string || '',
      home_seo_descricao: fd.get('home_seo_descricao') as string || '',
    }

    setStatus('idle')
    startTransition(async () => {
      const supabase = createClient()
      const upserts = Object.entries(valores).map(([chave, valor]) =>
        supabase.from('site_config').upsert(
          { chave, valor, updated_at: new Date().toISOString() },
          { onConflict: 'chave' }
        )
      )
      const results = await Promise.all(upserts)
      const err = results.find(r => r.error)?.error
      if (err) {
        setStatus('erro')
        setErro(err.message)
      } else {
        setStatus('ok')
        setTimeout(() => setStatus('idle'), 3000)
      }
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Configurações do Site</h1>
      <p className="text-sm text-gray-500 mb-6">Identidade visual, contato e textos da página inicial.</p>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Identidade visual */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Identidade visual</h2>

          <LogoUpload
            chave="logo_url"
            urlAtual={logoUrl}
            label="Logo do site"
            hint="PNG ou SVG transparente. Recomendado: 400×100 px. Será invertida para branco no fundo escuro."
            onUpload={setLogoUrl}
          />

          <LogoUpload
            chave="favicon_url"
            urlAtual={faviconUrl}
            label="Favicon"
            hint="ICO, PNG 32×32 px ou SVG. Aparece na aba do navegador."
            onUpload={setFaviconUrl}
          />
        </section>

        {/* Contato */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Contato</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">E-mail de contato</label>
            <input name="contato_email" type="email" defaultValue={cfg.contato_email}
              placeholder="contato@aluguelcuiaba.com.br" className={inputCls} />
            <p className="text-xs text-gray-400">Exibido no rodapé e usado para receber mensagens.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">WhatsApp de contato</label>
            <input name="contato_whatsapp" defaultValue={cfg.contato_whatsapp}
              placeholder="5565999999999" className={inputCls} />
            <p className="text-xs text-gray-400">Com DDI e DDD, sem espaços. Ex: 5565999999999</p>
          </div>
        </section>

        {/* Página inicial */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Página inicial</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Título principal (H1)</label>
            <input name="home_titulo" defaultValue={cfg.home_titulo}
              placeholder="Encontre seu imóvel para alugar em Cuiabá" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Subtítulo</label>
            <textarea name="home_descricao" defaultValue={cfg.home_descricao} rows={2}
              placeholder="O maior marketplace de aluguel..." className={`${inputCls} resize-none`} />
          </div>
        </section>

        {/* SEO */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">SEO (Google)</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Title tag <span className="text-gray-400 font-normal">(até 60 caracteres)</span>
            </label>
            <input name="home_seo_titulo" defaultValue={cfg.home_seo_titulo} maxLength={60}
              placeholder="AluguelCuiabá — Aluguel de Imóveis em Cuiabá/MT" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Meta description <span className="text-gray-400 font-normal">(até 160 caracteres)</span>
            </label>
            <textarea name="home_seo_descricao" defaultValue={cfg.home_seo_descricao} rows={2} maxLength={160}
              placeholder="Apartamentos, casas, kitnets..." className={`${inputCls} resize-none`} />
          </div>
        </section>

        {status === 'erro' && (
          <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle size={16} />
            {erro}
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={isPending}
            className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
            {isPending ? <Loader2 size={15} className="animate-spin" /> : status === 'ok' ? <Check size={15} /> : null}
            {isPending ? 'Salvando...' : status === 'ok' ? 'Salvo!' : 'Salvar configurações'}
          </button>
        </div>
      </form>
    </div>
  )
}
