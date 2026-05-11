'use client'

import { useState, useTransition } from 'react'
import { Trash2, ChevronUp, ChevronDown, Eye, EyeOff, ExternalLink, Loader2 } from 'lucide-react'
import { excluirBanner, toggleBannerAtivo, reordenarBanner } from '../actions'

interface Banner {
  id: string
  imagem_url: string
  link_url: string | null
  ordem: number
  ativo: boolean
}

export function BannerList({ banners: inicial }: { banners: Banner[] }) {
  const [banners, setBanners] = useState(inicial)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const run = (id: string, fn: () => Promise<{ ok?: boolean; error?: string }>) => {
    setLoadingId(id)
    startTransition(async () => {
      await fn()
      setLoadingId(null)
    })
  }

  if (!banners.length) {
    return (
      <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
        <p className="font-medium">Nenhum banner cadastrado</p>
        <p className="text-sm mt-1">Clique em "Adicionar banner" para começar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {banners.map((b, i) => (
        <div
          key={b.id}
          className={`bg-white border rounded-2xl p-4 flex items-center gap-4 shadow-sm transition-opacity ${!b.ativo ? 'opacity-50' : ''}`}
        >
          {/* Preview */}
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
            <img src={b.imagem_url} alt="" className="w-full h-full object-cover" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Banner #{b.ordem + 1}</p>
            {b.link_url ? (
              <a
                href={b.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-violet-600 hover:underline truncate mt-0.5"
              >
                <ExternalLink size={10} />
                {b.link_url}
              </a>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">Sem link</p>
            )}
          </div>

          {/* Ações */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Reordenar */}
            <button
              disabled={i === 0 || loadingId === b.id}
              onClick={() => run(b.id, () => reordenarBanner(b.id, 'up', b.ordem))}
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronUp size={15} />
            </button>
            <button
              disabled={i === banners.length - 1 || loadingId === b.id}
              onClick={() => run(b.id, () => reordenarBanner(b.id, 'down', b.ordem))}
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronDown size={15} />
            </button>

            {/* Toggle ativo */}
            <button
              disabled={loadingId === b.id}
              onClick={() => run(b.id, () => toggleBannerAtivo(b.id, !b.ativo))}
              title={b.ativo ? 'Pausar' : 'Ativar'}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              {loadingId === b.id
                ? <Loader2 size={13} className="animate-spin text-gray-400" />
                : b.ativo
                  ? <Eye size={14} className="text-green-600" />
                  : <EyeOff size={14} className="text-gray-400" />
              }
            </button>

            {/* Excluir */}
            <button
              disabled={loadingId === b.id}
              onClick={() => {
                if (!confirm('Excluir este banner?')) return
                run(b.id, () => excluirBanner(b.id, b.imagem_url))
                setBanners(prev => prev.filter(x => x.id !== b.id))
              }}
              className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
