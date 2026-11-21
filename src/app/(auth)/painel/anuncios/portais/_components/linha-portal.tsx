'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CircleAlert, Info, Pencil } from 'lucide-react'
import { thumbSupabase } from '@/lib/img-thumb'
import type { Problema } from '@/lib/portais/vrsync'
import { configurarPortal } from '../../actions-crud'

/** Um anúncio na tela de Portais: liga/desliga, tipo de destaque e o que falta. */
export function LinhaPortal({ id, titulo, bairro, foto, noAr, publicar, destaque, problemas }: {
  id: string; titulo: string; bairro: string | null; foto: string | null
  noAr: boolean; publicar: boolean; destaque: string; problemas: Problema[]
}) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [ligado, setLigado] = useState(publicar)
  const [erro, setErro] = useState('')
  const bloqueado = problemas.some(p => p.nivel === 'erro')

  const salvar = (config: { publicar?: boolean; destaque?: string }) => startTransition(async () => {
    setErro('')
    const r = await configurarPortal(id, config)
    if (r.error) {
      setErro(r.error)
      if (config.publicar !== undefined) setLigado(!config.publicar)
    }
    router.refresh()
  })

  // No lugar de "vai pro portal", diz por que não vai.
  const situacao = !ligado ? null
    : !noAr ? { txt: 'Fora do ar no site — não vai pro feed', cls: 'text-gray-500' }
    : bloqueado ? { txt: 'Não entra no feed até corrigir', cls: 'text-red-600' }
    : { txt: 'No feed', cls: 'text-green-700' }

  return (
    <li className="p-3 sm:p-4 flex gap-3">
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {foto ? <img src={thumbSupabase(foto, 160)} alt="" loading="lazy" className="w-full h-full object-cover" /> : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 line-clamp-1">{titulo}</p>
            <p className="text-xs text-gray-500">{bairro ?? 'sem bairro'}{!noAr && ' · fora do ar'}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={ligado}
            aria-label="Publicar nos portais"
            disabled={pendente}
            onClick={() => { const v = !ligado; setLigado(v); salvar({ publicar: v }) }}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${ligado ? 'bg-violet-600' : 'bg-gray-300'} disabled:opacity-60`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${ligado ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap mt-1.5">
          {situacao && (
            <span className={`text-xs font-medium ${situacao.cls}`}>
              {pendente ? <Loader2 size={12} className="inline animate-spin" /> : situacao.txt}
            </span>
          )}
          {ligado && (
            <select
              value={destaque}
              disabled={pendente}
              onChange={e => salvar({ destaque: e.target.value })}
              aria-label="Tipo de publicação"
              className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-700"
            >
              <option value="STANDARD">Padrão</option>
              <option value="PREMIUM">Destaque</option>
              <option value="SUPER_PREMIUM">Super destaque</option>
            </select>
          )}
        </div>

        {problemas.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {problemas.map(p => (
              <li key={p.texto} className={`text-[11px] flex items-start gap-1 ${p.nivel === 'erro' ? 'text-red-600' : 'text-gray-500'}`}>
                {p.nivel === 'erro'
                  ? <CircleAlert size={11} className="mt-0.5 shrink-0" />
                  : <Info size={11} className="mt-0.5 shrink-0" />}
                {p.texto}
              </li>
            ))}
            {bloqueado && (
              <li>
                <Link href={`/painel/anuncios/${id}/editar`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:underline mt-0.5">
                  <Pencil size={10} /> Corrigir no anúncio
                </Link>
              </li>
            )}
          </ul>
        )}
        {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
      </div>
    </li>
  )
}
