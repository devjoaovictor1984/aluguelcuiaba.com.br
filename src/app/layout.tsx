import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { createAdminClient } from '@/lib/supabase/admin'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  let faviconUrl = '/favicon.ico'
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('site_config')
      .select('chave, valor')
      .in('chave', ['favicon_url', 'home_seo_titulo', 'home_seo_descricao'])
    const cfg = Object.fromEntries((data ?? []).map(c => [c.chave, c.valor ?? '']))
    if (cfg.favicon_url) faviconUrl = cfg.favicon_url
    return {
      ...BASE_METADATA,
      title: cfg.home_seo_titulo
        ? { template: `%s | ${cfg.home_seo_titulo.split('—')[0].trim() || 'AluguelCuiabá'}`, default: cfg.home_seo_titulo }
        : BASE_METADATA.title,
      description: cfg.home_seo_descricao || BASE_METADATA.description,
      icons: { icon: faviconUrl, shortcut: faviconUrl },
    }
  } catch {
    return { ...BASE_METADATA, icons: { icon: faviconUrl, shortcut: faviconUrl } }
  }
}

const BASE_METADATA: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://aluguelcuiaba.com.br'),
  title: {
    template: '%s | AluguelCuiabá',
    default: 'AluguelCuiabá — Imóveis para alugar em Cuiabá/MT',
  },
  description: 'O portal especializado em aluguel de imóveis em Cuiabá e região. Encontre apartamentos, casas, kitnets e imóveis comerciais para alugar.',
  keywords: [
    'aluguel cuiabá',
    'imóveis para alugar cuiabá',
    'aluguel de apartamento cuiabá mt',
    'aluguel de casa cuiabá',
    'aluguel cuiabá mt',
    'apartamento para alugar cuiabá',
    'casa para alugar cuiabá',
    'kitnet para alugar cuiabá',
    'imóvel para alugar cuiabá mato grosso',
  ],
  authors: [{ name: 'AluguelCuiabá' }],
  creator: 'AluguelCuiabá',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'AluguelCuiabá',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#6D28D9',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  )
}
