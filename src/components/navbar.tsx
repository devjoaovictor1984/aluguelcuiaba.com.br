import Image from 'next/image'
import Link from 'next/link'
import { Plus, User, Heart } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

async function getLogoUrl(): Promise<string> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('site_config')
      .select('valor')
      .eq('chave', 'logo_url')
      .single()
    return data?.valor || '/logo.png'
  } catch {
    return '/logo.png'
  }
}

export async function Navbar() {
  const logoUrl = await getLogoUrl()

  const linkCls = 'px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors'
  const iconCls = 'p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors'

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100 hidden md:block">
      <div className="max-w-[1800px] mx-auto px-6 h-14 lg:h-24 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src={logoUrl}
            alt="AluguelCuiabá"
            width={480}
            height={80}
            className="h-10 w-auto max-w-[200px] lg:h-20 lg:max-w-[400px]"
            priority
            unoptimized={logoUrl.startsWith('http')}
          />
        </Link>

        <nav className="flex items-center gap-1">
          <Link href="/" className={linkCls}>Imóveis</Link>
          <Link href="/blog" className={linkCls}>Blog</Link>
          <Link href="/corretor" className={`${linkCls} hidden lg:block`}>Para corretores</Link>

          {/* Ícones de conta — discretos, separados por um respiro */}
          <Link href="/favoritos" aria-label="Favoritos" className={`${iconCls} ml-2 hover:text-red-500`}>
            <Heart size={18} />
          </Link>
          <Link href="/painel" aria-label="Minha conta" className={iconCls}>
            <User size={18} />
          </Link>

          {/* CTA primário único */}
          <Link
            href="/painel/anuncios/novo"
            className="ml-2 inline-flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            <span className="hidden lg:inline">Anunciar grátis</span>
            <span className="lg:hidden">Anunciar</span>
          </Link>
        </nav>
      </div>
    </header>
  )
}
