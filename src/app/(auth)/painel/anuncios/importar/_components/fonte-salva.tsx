'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw, Trash2, AlertTriangle } from 'lucide-react'
import { configurarSincronizacao, importarFonteDeNovo, removerFonte } from '../actions'

/** Uma URL salva: importar de novo, ligar a atualização diária, remover. */
export function FonteSalva(p: {
  id: string; nome: string | null; url: string; sincronizar: boolean; pausarAusentes: boolean
  ultima: string | null; ultimoErro: string | null; bloqueado: boolean
}) {
  const router = useRouter()
  const [pendente, start] = useTransition()
  const [importando, setImportando] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmarRemover, setConfirmarRemover] = useState(false)

  const sync = (sincronizar: boolean, pausar?: boolean) => start(async () => {
    setErro('')
    const r = await configurarSincronizacao(p.id, sincronizar, pausar)
    if (r.error) setErro(r.error)
    router.refresh()
  })

  const deNovo = async () => {
    setErro('')
    setImportando(true)
    try {
      const r = await importarFonteDeNovo(p.id)
      if (r.id) { router.push(`/painel/anuncios/importar/${r.id}`); return }
      setErro(r.error ?? 'Não deu certo.')
    } catch {
      setErro('Falha de conexão. Tente de novo.')
    } finally {
      setImportando(false)
    }
  }

  const remover = () => start(async () => {
    const r = await removerFonte(p.id)
    if (r.error) setErro(r.error)
    setConfirmarRemover(false)
    router.refresh()
  })

  return (
    <li className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{p.nome || 'URL salva'}</p>
          <p className="font-mono text-[11px] text-gray-500 break-all">{p.url}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {p.ultima ? `Última importação concluída: ${new Date(p.ultima).toLocaleString('pt-BR')}` : 'Ainda não importada até o fim'}
          </p>
          {p.ultimoErro && (
            <p className="text-[11px] text-red-700 mt-1 flex items-start gap-1"><AlertTriangle size={12} className="shrink-0 mt-0.5" /> Último erro: {p.ultimoErro}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={deNovo} disabled={importando || pendente || p.bloqueado}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 disabled:opacity-50 px-3 py-2 rounded-lg"
          >
            {importando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Importar de novo
          </button>
          {confirmarRemover ? (
            <span className="flex items-center gap-1 text-xs">
              <button onClick={remover} disabled={pendente} className="text-red-700 font-semibold px-2 py-2">Remover</button>
              <button onClick={() => setConfirmarRemover(false)} className="text-gray-500 px-2 py-2">Não</button>
            </span>
          ) : (
            <button onClick={() => setConfirmarRemover(true)} aria-label="Remover URL salva" className="text-gray-400 hover:text-red-600 p-2">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
        <label className="flex items-start gap-2 text-xs text-gray-700">
          <input type="checkbox" checked={p.sincronizar} disabled={pendente} onChange={e => sync(e.target.checked)} className="mt-0.5 accent-violet-700" />
          <span>
            <strong>Atualizar sozinho todo dia</strong> (de madrugada), com as mesmas opções da última importação.
            Imóvel novo no sistema de origem entra; preço e fotos que mudaram lá são atualizados aqui.
          </span>
        </label>
        {p.sincronizar && (
          <label className="flex items-start gap-2 text-xs text-gray-700 pl-6">
            <input type="checkbox" checked={p.pausarAusentes} disabled={pendente} onChange={e => sync(true, e.target.checked)} className="mt-0.5 accent-violet-700" />
            <span>Pausar aqui o anúncio que <strong>sumir do arquivo</strong> (alugou ou saiu do sistema de origem).</span>
          </label>
        )}
      </div>
      {erro && <p className="text-xs text-red-700 mt-2">{erro}</p>}
    </li>
  )
}
