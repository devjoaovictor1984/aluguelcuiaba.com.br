import { createClient } from '@/lib/supabase/server'
import type { MetadataRoute } from 'next'

const BASE = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://aluguelcuiaba.com.br').replace(/\/$/, '')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  const [{ data: bairros }, { data: imoveis }, { data: posts }] = await Promise.all([
    supabase.from('bairros').select('slug, created_at'),
    supabase
      .from('imoveis')
      .select('id, slug, updated_at, bairro:bairros(slug)')
      .eq('status', 'ativo'),
    supabase.from('posts').select('slug, updated_at').eq('publicado', true),
  ])

  const now = new Date()

  const estaticas: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/planos`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/cadastrar`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/entrar`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/termos`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/privacidade`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]

  const bairroPages: MetadataRoute.Sitemap = (bairros ?? []).map(b => ({
    url: `${BASE}/bairros/${b.slug}`,
    lastModified: new Date(b.created_at ?? now),
    changeFrequency: 'weekly',
    priority: 0.85,
  }))

  // URLs SEO: /imoveis/{bairro}/{slug}. Fallback para /imoveis/{id} se faltar.
  const imovelPages: MetadataRoute.Sitemap = (imoveis ?? []).map(i => {
    const bairroObj = Array.isArray(i.bairro) ? i.bairro[0] : i.bairro
    const bairroSlug = (bairroObj as { slug?: string } | null | undefined)?.slug
    const url = bairroSlug && i.slug
      ? `${BASE}/imoveis/${bairroSlug}/${i.slug}`
      : `${BASE}/imoveis/${i.id}`
    return {
      url,
      lastModified: new Date(i.updated_at ?? now),
      changeFrequency: 'weekly',
      priority: 0.9,
    }
  })

  const postPages: MetadataRoute.Sitemap = (posts ?? []).map(p => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: new Date(p.updated_at ?? now),
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  return [...estaticas, ...bairroPages, ...imovelPages, ...postPages]
}
