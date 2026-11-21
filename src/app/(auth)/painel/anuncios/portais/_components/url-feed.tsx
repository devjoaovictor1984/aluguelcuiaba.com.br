'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, KeyRound, Loader2, RotateCcw, CircleCheck, CircleDashed } from 'lucide-react'
import { gerarTokenFeed } from '../../actions-crud'
import { ehRoboDoPortal } from '@/lib/portais/vrsync'

/** Caixa da URL do feed: gerar, copiar, trocar (revoga a anterior). */
export function UrlFeed({ urlBase, token, lidoEm, lidoPor, noFeed }: {
  urlBase: string; token: string | null; lidoEm: string | null; lidoPor: string | null; noFeed: number
}) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [copiado, setCopiado] = useState(false)
  const [confirmarTroca, setConfirmarTroca] = useState(false)
  const [erro, setErro] = useState('')
  const url = token ? `${urlBase}${token}` : null

  const gerar = () => startTransition(async () => {
    setErro('')
    const r = await gerarTokenFeed()
    if (r.error) setErro(r.error)
    setConfirmarTroca(false)
    router.refresh()
  })

  const copiar = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* navegador sem clipboard: o campo já fica selecionável */ }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">URL do feed (VRSync)</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Cadastre esta URL no Canal Pro, na área de integração por feed XML. Vale para OLX, ZAP e Viva Real ao mesmo tempo.
          </p>
        </div>
        <span className="text-xs font-semibold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full">
          {noFeed} anúncio{noFeed === 1 ? '' : 's'} no feed
        </span>
      </div>

      {url ? (
        <>
          <div className="flex gap-2">
            <input
              readOnly
              value={url}
              onFocus={e => e.currentTarget.select()}
              aria-label="URL do feed"
              className="flex-1 min-w-0 font-mono text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700"
            />
            <button
              type="button"
              onClick={copiar}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-700 hover:bg-violet-800 px-3 rounded-lg"
            >
              {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap mt-3 text-xs">
            <span className={`inline-flex items-center gap-1 ${lidoEm ? 'text-green-700' : 'text-gray-500'}`}>
              {lidoEm ? <CircleCheck size={13} /> : <CircleDashed size={13} />}
              {lidoEm
                ? <>
                    {ehRoboDoPortal(lidoPor) ? 'Portal conectado · última leitura' : 'Última leitura'}: {new Date(lidoEm).toLocaleString('pt-BR')}
                    {!ehRoboDoPortal(lidoPor) && lidoPor ? <span className="text-gray-400"> · {lidoPor.slice(0, 40)}</span> : null}
                  </>
                : 'Aguardando o portal ler pela primeira vez (abrir no navegador não conta)'}
            </span>
            {confirmarTroca ? (
              <span className="inline-flex items-center gap-2">
                <span className="text-red-700">A URL atual para de funcionar. Trocar?</span>
                <button type="button" onClick={() => setConfirmarTroca(false)} className="text-gray-500 hover:text-gray-800">Cancelar</button>
                <button type="button" onClick={gerar} disabled={pendente} className="font-semibold text-red-600 hover:text-red-800">
                  {pendente ? <Loader2 size={12} className="animate-spin inline" /> : 'Trocar'}
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmarTroca(true)} className="inline-flex items-center gap-1 text-gray-500 hover:text-red-600">
                <RotateCcw size={12} /> Trocar URL
              </button>
            )}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={gerar}
          disabled={pendente}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-violet-700 hover:bg-violet-800 px-4 py-2.5 rounded-xl disabled:opacity-60"
        >
          {pendente ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Gerar URL do feed
        </button>
      )}
      {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}
    </section>
  )
}
