import { createClient } from '@/lib/supabase/server'
import type { MetadataRoute } from 'next'

const BASE = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://aluguelcuiaba.com.br').replace(/\/$/, '')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  const [{ data: bairros }, { data: imoveis }, { data: posts }] = await Promise.all([
    supabase.from('bairros').select('slug, created_at'),
    supabase.from('imoveis').select('id, updated_at').eq('status', 'ativo'),
    supabase.from('posts').select('slug, updated_at').eq('publicado', true),
  ])

  const now = new Date()

  const estaticas: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/cadastrar`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ]

  const bairroPages: MetadataRoute.Sitemap = (bairros ?? []).map(b => ({
    url: `${BASE}/bairros/${b.slug}`,
    lastModified: new Date(b.created_at ?? now),
    changeFrequency: 'weekly',
    priority: 0.85,
  }))

  const imovelPages: MetadataRoute.Sitemap = (imoveis ?? []).map(i => ({
    url: `${BASE}/imoveis/${i.id}`,
    lastModified: new Date(i.updated_at ?? now),
    changeFrequency: 'weekly',
    priority: 0.9,
  }))

  const postPages: MetadataRoute.Sitemap = (posts ?? []).map(p => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: new Date(p.updated_at ?? now),
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  return [...estaticas, ...bairroPages, ...imovelPages, ...postPages]
}
