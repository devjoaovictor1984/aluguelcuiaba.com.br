'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import type { MotivoPendencia, EntidadePlaceholder } from '@/lib/contratos/montar'
import { TEXTO_MOTIVO, ROTULO_ENTIDADE } from '@/lib/contratos/pendencias-links'

interface Pendencia {
  chave: string
  rotulo: string
  motivo: MotivoPendencia
  entidade: EntidadePlaceholder
  nivel: 'obrigatorio' | 'importante' | 'opcional'
  ocorrencias: number
  corrigir: string | null
}

interface Resposta {
  motor: 'legado' | 'v2'
  pendencias: Pendencia[]
  travam: number
}

/**
 * Painel dos campos do texto que não puderam ser preenchidos. Lê a mesma
 * rota que gera o PDF (?pendencias=1), então o que aparece aqui é o que sai
 * em vermelho no documento — e o que trava o envio pra assinatura.
 *
 * Recarrega quando a janela volta ao foco: o "Corrigir" abre o cadastro em
 * outra aba, e ao voltar a lista já vem atualizada, sem perder nada do que
 * foi editado nas cláusulas.
 */
export function PainelPendencias({ url, versao = '' }: {
  url: string
  /** Muda quando as cláusulas mudam no editor: confere de novo logo depois de salvar. */
  versao?: string
}) {
  const [dados, setDados] = useState<Resposta | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [verOmitidos, setVerOmitidos] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const r = await fetch(url, { cache: 'no-store' })
      if (!r.ok) throw new Error(String(r.status))
      setDados(await r.json() as Resposta)
    } catch {
      setErro('Não consegui conferir os campos do contrato.')
    } finally {
      setCarregando(false)
    }
  }, [url])

  // Espera o salvamento da cláusula terminar antes de conferir de novo.
  useEffect(() => {
    const t = setTimeout(() => { void carregar() }, versao ? 900 : 0)
    return () => clearTimeout(t)
  }, [carregar, versao])

  useEffect(() => {
    const aoFocar = () => { void carregar() }
    window.addEventListener('focus', aoFocar)
    return () => window.removeEventListener('focus', aoFocar)
  }, [carregar])

  if (carregando && !dados) {
    return (
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-xs text-gray-500 flex items-center gap-2">
        <Loader2 size={12} className="animate-spin" /> Conferindo os campos do contrato…
      </section>
    )
  }
  if (erro && !dados) {
    return (
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-xs text-gray-500 flex items-center justify-between gap-2">
        <span>{erro}</span>
        <button type="button" onClick={() => void carregar()} className="text-violet-700 font-semibold">Tentar de novo</button>
      </section>
    )
  }
  if (!dados) return null

  const travam = dados.pendencias.filter(p => p.nivel !== 'opcional')
  const omitidos = dados.pendencias.filter(p => p.nivel === 'opcional')

  return (
    <section className={`rounded-2xl p-4 space-y-2 border ${travam.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${travam.length > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
          {travam.length > 0 ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
          {travam.length > 0 ? `Campos pendentes no texto (${travam.length})` : 'Campos do texto completos'}
        </h2>
        <button
          type="button"
          onClick={() => void carregar()}
          disabled={carregando}
          title="Conferir de novo"
          className="text-gray-400 hover:text-violet-700 p-1 disabled:opacity-50"
        >
          <RefreshCw size={12} className={carregando ? 'animate-spin' : ''} />
        </button>
      </div>

      {dados.motor === 'legado' && (
        <p className="text-[10px] text-gray-500">
          Este contrato entrou em assinatura antes da conferência de campos e é mantido exatamente como foi enviado.
          A lista é só informativa.
        </p>
      )}

      {travam.length > 0 && (
        <>
          <ul className="space-y-1.5">
            {travam.map(p => (
              <li key={p.chave} className="text-[11px] text-rose-800 bg-white/70 rounded-lg px-2.5 py-1.5 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">
                    {p.rotulo}
                    {p.ocorrencias > 1 && <span className="font-normal text-rose-500"> · {p.ocorrencias}×</span>}
                  </p>
                  <p className="text-[10px] text-rose-600">
                    {ROTULO_ENTIDADE[p.entidade]}: {TEXTO_MOTIVO[p.motivo]}
                  </p>
                </div>
                {p.corrigir && (
                  <a
                    href={p.corrigir}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-violet-700 hover:text-violet-900 mt-0.5"
                  >
                    Corrigir <ExternalLink size={9} />
                  </a>
                )}
              </li>
            ))}
          </ul>
          {dados.motor === 'v2' && (
            <p className="text-[10px] text-rose-600">
              Saem em vermelho no PDF, que vira minuta de conferência. O envio pra assinatura fica travado até completar.
              Corrija no cadastro (abre em outra aba) e volte: a lista atualiza sozinha.
            </p>
          )}
        </>
      )}

      {omitidos.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setVerOmitidos(v => !v)}
            className="text-[10px] font-semibold text-gray-500 hover:text-gray-700"
          >
            {verOmitidos ? '▾' : '▸'} {omitidos.length} campo(s) opcional(is) omitido(s) do texto
          </button>
          {verOmitidos && (
            <ul className="mt-1 space-y-0.5">
              {omitidos.map(p => (
                <li key={p.chave} className="text-[10px] text-gray-500 flex items-center gap-1.5">
                  <span className="flex-1">{p.rotulo} — {TEXTO_MOTIVO[p.motivo]}</span>
                  {p.corrigir && (
                    <a href={p.corrigir} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">
                      preencher
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
