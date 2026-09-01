'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ImovelCard } from '@/components/imovel-card'
import { useFavoritos } from '@/hooks/use-favoritos'
import { Heart, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import type { Imovel } from '@/types'

export function FavoritosContent() {
  const { ids, toggle, mounted } = useFavoritos()
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!mounted) return
    if (ids.length === 0) { setLoading(false); setImoveis([]); return }

    const supabase = createClient()
    supabase
      .from('imoveis')
      .select('*, bairro:bairros(*), fotos(*)')
      .in('id', ids)
      .eq('status', 'ativo')
      .order('ordem', { referencedTable: 'fotos' })
      .then(({ data }) => {
        setImoveis((data ?? []) as Imovel[])
        setLoading(false)
      })
  }, [mounted, ids.length])

  if (!mounted || loading) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-xl h-64 animate-pulse" />
        ))}
      </div>
    )
  }

  if (imoveis.length === 0) {
    return (
      <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
        <Heart size={36} className="mx-auto mb-3 text-gray-300" />
        <p className="text-base font-medium text-gray-700">Nenhum favorito ainda</p>
        <p className="mt-1 text-sm text-gray-400">
          Toque no coração nos cards para salvar imóveis
        </p>
        <Link
          href="/"
          className="inline-block mt-5 bg-violet-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-violet-800 transition-colors"
        >
          Ver imóveis
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-800">{imoveis.length}</span> imóvel{imoveis.length !== 1 ? 'is' : ''} salvo{imoveis.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => {
            if (confirm('Remover todos os favoritos?')) {
              ids.forEach(id => toggle(id))
            }
          }}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Limpar tudo
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {imoveis.map(imovel => (
          <ImovelCard key={imovel.id} imovel={imovel} />
        ))}
      </div>
    </div>
  )
}
