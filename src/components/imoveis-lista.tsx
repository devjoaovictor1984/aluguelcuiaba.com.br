'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ImovelCard } from './imovel-card'
import type { Imovel, FiltrosBusca } from '@/types'

interface Props {
  initialItems: Imovel[]
  total: number
  filtros: FiltrosBusca
}

function filtrosParaParams(filtros: FiltrosBusca): URLSearchParams {
  const p = new URLSearchParams()
  if (filtros.tipo) p.set('tipo', filtros.tipo)
  if (filtros.bairro_slug) p.set('bairro_slug', filtros.bairro_slug)
  if (filtros.preco_min != null) p.set('preco_min', String(filtros.preco_min))
  if (filtros.preco_max != null) p.set('preco_max', String(filtros.preco_max))
  if (filtros.quartos_min != null) p.set('quartos_min', String(filtros.quartos_min))
  if (filtros.aceita_pets) p.set('aceita_pets', 'true')
  if (filtros.mobiliado) p.set('mobiliado', 'true')
  if (filtros.taxa_condo_min != null) p.set('taxa_condo_min', String(filtros.taxa_condo_min))
  if (filtros.taxa_condo_max != null) p.set('taxa_condo_max', String(filtros.taxa_condo_max))
  if (filtros.iptu_min != null) p.set('iptu_min', String(filtros.iptu_min))
  if (filtros.iptu_max != null) p.set('iptu_max', String(filtros.iptu_max))
  if (filtros.tipo_anunciante) p.set('tipo_anunciante', filtros.tipo_anunciante)
  if (filtros.ordenar) p.set('ordenar', filtros.ordenar)
  return p
}

export function ImoveisLista({ initialItems, total, filtros }: Props) {
  const [items, setItems] = useState<Imovel[]>(initialItems)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  const restantes = total - items.length
  const temMais = restantes > 0

  async function carregarMais() {
    setLoading(true)
    const nextPage = page + 1
    const params = filtrosParaParams(filtros)
    params.set('pagina', String(nextPage))
    try {
      const res = await fetch(`/api/imoveis?${params}`)
      const json = await res.json()
      if (json.data) {
        setItems(prev => [...prev, ...json.data])
        setPage(nextPage)
      }
    } catch {}
    setLoading(false)
  }

  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {items.map(imovel => (
          <ImovelCard key={imovel.id} imovel={imovel} />
        ))}
      </div>

      {temMais && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            onClick={carregarMais}
            disabled={loading}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:border-violet-400 hover:text-violet-700 text-gray-600 font-semibold px-8 py-3 rounded-full shadow-sm transition-colors disabled:opacity-60 text-sm"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? 'Carregando...' : `Ver mais ${restantes} imóve${restantes === 1 ? 'l' : 'is'}`}
          </button>
          <p className="text-xs text-gray-400">
            {items.length} de {total} imóveis
          </p>
        </div>
      )}
    </>
  )
}
