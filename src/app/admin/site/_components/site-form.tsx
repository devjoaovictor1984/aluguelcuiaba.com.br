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
      instagram_url: fd.get('instagram_url') as string || '',
      facebook_url: fd.get('facebook_url') as string || '',
      google_analytics_id: fd.get('google_analytics_id') as string || '',
      facebook_pixel_id: fd.get('facebook_pixel_id') as string || '',
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

        {/* Redes sociais */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Redes sociais</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-pink-500"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              Instagram
            </label>
            <input name="instagram_url" type="url" defaultValue={cfg.instagram_url}
              placeholder="https://instagram.com/aluguelcuiaba" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-blue-600"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook
            </label>
            <input name="facebook_url" type="url" defaultValue={cfg.facebook_url}
              placeholder="https://facebook.com/aluguelcuiaba" className={inputCls} />
          </div>
        </section>

        {/* Analytics & Pixel */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Analytics & Rastreamento</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Google Analytics 4 — Measurement ID</label>
            <input name="google_analytics_id" defaultValue={cfg.google_analytics_id}
              placeholder="G-XXXXXXXXXX" className={inputCls} />
            <p className="text-xs text-gray-400">Encontre em GA4 → Admin → Fluxos de dados → ID de medição.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Facebook Pixel ID</label>
            <input name="facebook_pixel_id" defaultValue={cfg.facebook_pixel_id}
              placeholder="123456789012345" className={inputCls} />
            <p className="text-xs text-gray-400">Encontre em Meta Business Suite → Gerenciador de eventos → Pixel ID.</p>
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
