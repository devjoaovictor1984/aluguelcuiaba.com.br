'use client'

import { Heart } from 'lucide-react'
import { useFavoritos } from '@/hooks/use-favoritos'

export function BotaoFavorito({ imovelId }: { imovelId: string }) {
  const { toggle, isFavorito, mounted } = useFavoritos()

  if (!mounted) return null

  const ativo = isFavorito(imovelId)

  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); toggle(imovelId) }}
      className={`absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center rounded-full shadow-sm transition-all active:scale-90 ${
        ativo
          ? 'bg-white text-red-500'
          : 'bg-white/80 text-gray-400 hover:text-red-400 hover:bg-white'
      }`}
      aria-label={ativo ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
    >
      <Heart size={15} fill={ativo ? 'currentColor' : 'none'} strokeWidth={2} />
    </button>
  )
}
