'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ChevronDown, X, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bairro } from '@/types'

const TIPOS = [
  { value: '', label: 'Todos' },
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'kitnet', label: 'Kitnet/Studio' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'terreno', label: 'Terreno' },
]

const QUARTOS_OPTS = [
  { value: '', label: 'Qualquer' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
  { value: '4', label: '4+' },
]

const ANUNCIANTES = [
  { value: '', label: 'Todos' },
  { value: 'proprietario', label: 'Particular' },
  { value: 'corretor', label: 'Corretor' },
  { value: 'imobiliaria', label: 'Imobiliária' },
]

function Secao({
  titulo,
  children,
  defaultOpen = true,
}: {
  titulo: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [aberta, setAberta] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-100 py-3.5">
      <button
        onClick={() => setAberta(!aberta)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="font-semibold text-gray-800 text-[13px]">{titulo}</span>
        <ChevronDown
          size={15}
          className={cn('text-gray-400 transition-transform duration-200', aberta && 'rotate-180')}
        />
      </button>
      {aberta && <div className="mt-3">{children}</div>}
    </div>
  )
}

function InputRange({
  labelMin,
  labelMax,
  valMin,
  valMax,
  onChangeMin,
  onChangeMax,
  onAplicar,
}: {
  labelMin: string
  labelMax: string
  valMin: string
  valMax: string
  onChangeMin: (v: string) => void
  onChangeMax: (v: string) => void
  onAplicar: () => void
}) {
  return (
    <>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          placeholder={labelMin}
          value={valMin}
          onChange={e => onChangeMin(e.target.value)}
          className="w-1/2 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
        />
        <input
          type="number"
          min={0}
          placeholder={labelMax}
          value={valMax}
          onChange={e => onChangeMax(e.target.value)}
          className="w-1/2 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
        />
      </div>
      <button
        onClick={onAplicar}
        className="mt-2 w-full py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-medium rounded-lg transition-colors"
      >
        Aplicar
      </button>
    </>
  )
}

interface FiltrosSidebarProps {
  inDrawer?: boolean
  onClose?: () => void
  bairros?: Bairro[]
}

export function FiltrosSidebar({ inDrawer = false, onClose, bairros = [] }: FiltrosSidebarProps = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [precoMin, setPrecoMin] = useState(searchParams.get('preco_min') ?? '')
  const [precoMax, setPrecoMax] = useState(searchParams.get('preco_max') ?? '')
  const [condoMin, setCondoMin] = useState(searchParams.get('condo_min') ?? '')
  const [condoMax, setCondoMax] = useState(searchParams.get('condo_max') ?? '')
  const [iptuMin, setIptuMin] = useState(searchParams.get('iptu_min') ?? '')
  const [iptuMax, setIptuMax] = useState(searchParams.get('iptu_max') ?? '')

  const atualizar = (novosFiltros: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(novosFiltros).forEach(([k, v]) => {
      if (v) params.set(k, v)
      else params.delete(k)
    })
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const limparTudo = () => {
    setPrecoMin(''); setPrecoMax('')
    setCondoMin(''); setCondoMax('')
    setIptuMin(''); setIptuMax('')
    startTransition(() => router.push(pathname))
  }

  const tipo = searchParams.get('tipo') ?? ''
  const quartos = searchParams.get('quartos') ?? ''
  const anunciante = searchParams.get('anunciante') ?? ''
  const ordenar = searchParams.get('ordenar') ?? ''
  const bairro = searchParams.get('bairro') ?? ''
  const temFiltros = searchParams.size > 0

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 px-4',
        isPending && 'opacity-60 pointer-events-none'
      )}
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between py-3.5 border-b border-gray-100">
        <span className="font-bold text-gray-900 flex items-center gap-1.5 text-sm">
          <SlidersHorizontal size={15} className="text-violet-600" />
          Filtros
        </span>
        {temFiltros && (
          <button
            onClick={limparTudo}
            className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium"
          >
            <X size={12} />
            Limpar tudo
          </button>
        )}
      </div>

      {/* Ordenar por */}
      <Secao titulo="Ordenar por">
        <select
          value={ordenar}
          onChange={e => atualizar({ ordenar: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-violet-200 bg-white"
        >
          <option value="">Mais relevantes</option>
          <option value="recentes">Mais recentes</option>
          <option value="menor_preco">Menor preço</option>
          <option value="maior_preco">Maior preço</option>
        </select>
      </Secao>

      {/* Bairro */}
      <Secao titulo="Bairro">
        <select
          value={bairro}
          onChange={e => atualizar({ bairro: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-violet-200 bg-white"
        >
          <option value="">Todos os bairros</option>
          {bairros.map(b => (
            <option key={b.id} value={b.slug}>{b.nome}</option>
          ))}
        </select>
      </Secao>

      {/* Tipo do imóvel */}
      <Secao titulo="Tipo do imóvel">
        <div className="flex flex-wrap gap-1.5">
          {TIPOS.map(t => (
            <button
              key={t.value}
              onClick={() => atualizar({ tipo: t.value })}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs border font-medium transition-colors',
                tipo === t.value
                  ? 'bg-violet-700 text-white border-violet-700'
                  : 'border-gray-200 text-gray-600 hover:border-violet-400 hover:text-violet-600'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Secao>

      {/* Aluguel */}
      <Secao titulo="Aluguel (R$/mês)">
        <InputRange
          labelMin="Mín"
          labelMax="Máx"
          valMin={precoMin}
          valMax={precoMax}
          onChangeMin={setPrecoMin}
          onChangeMax={setPrecoMax}
          onAplicar={() => atualizar({ preco_min: precoMin, preco_max: precoMax })}
        />
      </Secao>

      {/* Quartos */}
      <Secao titulo="Quartos">
        <div className="flex gap-1.5">
          {QUARTOS_OPTS.map(q => (
            <button
              key={q.value}
              onClick={() => atualizar({ quartos: q.value })}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs border font-medium text-center transition-colors',
                quartos === q.value
                  ? 'bg-violet-700 text-white border-violet-700'
                  : 'border-gray-200 text-gray-600 hover:border-violet-400 hover:text-violet-600'
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
      </Secao>

      {/* Condomínio */}
      <Secao titulo="Condomínio (R$/mês)" defaultOpen={false}>
        <InputRange
          labelMin="Mín"
          labelMax="Máx"
          valMin={condoMin}
          valMax={condoMax}
          onChangeMin={setCondoMin}
          onChangeMax={setCondoMax}
          onAplicar={() => atualizar({ condo_min: condoMin, condo_max: condoMax })}
        />
      </Secao>

      {/* IPTU */}
      <Secao titulo="IPTU (R$/ano)" defaultOpen={false}>
        <InputRange
          labelMin="Mín"
          labelMax="Máx"
          valMin={iptuMin}
          valMax={iptuMax}
          onChangeMin={setIptuMin}
          onChangeMax={setIptuMax}
          onAplicar={() => atualizar({ iptu_min: iptuMin, iptu_max: iptuMax })}
        />
      </Secao>

      {/* Tipo de anunciante */}
      <Secao titulo="Tipo de anunciante" defaultOpen={false}>
        <div className="space-y-2.5">
          {ANUNCIANTES.map(a => (
            <label key={a.value} className="flex items-center gap-2.5 cursor-pointer group">
              <div
                className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors shrink-0',
                  anunciante === a.value
                    ? 'border-violet-700 bg-violet-700'
                    : 'border-gray-300 group-hover:border-violet-400'
                )}
                onClick={() => atualizar({ anunciante: a.value })}
              >
                {anunciante === a.value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
              <span
                className="text-sm text-gray-700 select-none"
                onClick={() => atualizar({ anunciante: a.value })}
              >
                {a.label}
              </span>
            </label>
          ))}
        </div>
      </Secao>

      {inDrawer && onClose ? (
        <div className="py-3">
          <button
            onClick={onClose}
            className="w-full py-3 bg-violet-700 hover:bg-violet-800 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Ver resultados
          </button>
        </div>
      ) : (
        <div className="py-3" />
      )}
    </div>
  )
}
