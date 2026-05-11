import Image from 'next/image'
import Link from 'next/link'
import { Plus, User } from 'lucide-react'
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

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src={logoUrl}
            alt="AluguelCuiabá"
            width={200}
            height={28}
            className="h-6 w-auto max-w-[110px] sm:h-7 sm:max-w-none"
            priority
            unoptimized={logoUrl.startsWith('http')}
          />
        </Link>

        <nav className="flex items-center gap-3">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 hidden sm:block">
            Imóveis
          </Link>
          <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900 hidden sm:block">
            Blog
          </Link>
          <Link
            href="/painel/anuncios/novo"
            className="flex items-center gap-1.5 bg-violet-700 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-violet-800 transition-colors font-medium"
          >
            <Plus size={15} />
            Anunciar
          </Link>
          <Link href="/painel" className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors">
            <User size={18} />
          </Link>
        </nav>
      </div>
    </header>
  )
}
