import type { Metadata } from 'next'
import Link from 'next/link'
import { Home, Search, FileText, ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Página não encontrada',
  description: 'A página que você procura não existe ou foi removida. Volte para a busca de imóveis em Cuiabá.',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">
        <p className="text-7xl font-extrabold text-violet-700 leading-none">404</p>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Página não encontrada</h1>
        <p className="mt-2 text-sm text-gray-500">
          A página que você procura não existe, foi movida ou o imóvel já foi alugado.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/"
            className="flex flex-col items-center gap-1.5 px-4 py-4 rounded-2xl bg-white border border-gray-100 hover:border-violet-300 hover:shadow-sm transition-all"
          >
            <Home size={18} className="text-violet-600" />
            <span className="text-xs font-semibold text-gray-700">Início</span>
          </Link>
          <Link
            href="/?tipo=apartamento"
            className="flex flex-col items-center gap-1.5 px-4 py-4 rounded-2xl bg-white border border-gray-100 hover:border-violet-300 hover:shadow-sm transition-all"
          >
            <Search size={18} className="text-violet-600" />
            <span className="text-xs font-semibold text-gray-700">Buscar imóveis</span>
          </Link>
          <Link
            href="/blog"
            className="flex flex-col items-center gap-1.5 px-4 py-4 rounded-2xl bg-white border border-gray-100 hover:border-violet-300 hover:shadow-sm transition-all"
          >
            <FileText size={18} className="text-violet-600" />
            <span className="text-xs font-semibold text-gray-700">Blog</span>
          </Link>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 mt-8 text-sm text-violet-700 hover:text-violet-900 font-medium"
        >
          <ArrowLeft size={14} />
          Voltar para a página inicial
        </Link>
      </div>
    </main>
  )
}
