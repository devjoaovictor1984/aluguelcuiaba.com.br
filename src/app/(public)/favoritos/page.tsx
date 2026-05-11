import type { Metadata } from 'next'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { FavoritosContent } from './_components/favoritos-content'
import { Heart } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Imóveis Favoritos',
  robots: { index: false, follow: false },
}

export default function FavoritosPage() {
  return (
    <>
      <Navbar />

      <div className="bg-violet-700 py-5 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Heart size={20} fill="currentColor" />
            Meus favoritos
          </h1>
          <p className="text-violet-200 text-sm mt-0.5">Imóveis que você salvou</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <FavoritosContent />
      </div>

      <Footer />
    </>
  )
}
