'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Pause, Play, X, Undo2, RotateCcw, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { OpcoesImportacao, Progresso } from '@/lib/importacao/motor'
import { cancelar, desfazer, pausarOsAusentes, processarProximoLote, tentarErrosDeNovo, verAusentes } from '../actions'

type Contagem = Omit<Progresso, 'mexeuNaVitrine'>

/**
 * Roda a fila: chama um lote (~50 s) atrás do outro até zerar. Fechar a aba
 * não perde nada — volta de onde parou (e o cron termina de madrugada).
 */
export function Andamento({ id, status, inicial, opcoes, ausentesNaAnalise }: {
  id: string; status: string; inicial: Contagem; opcoes: OpcoesImportacao | null; ausentesNaAnalise: number
}) {
  const router = useRouter()
  const [p, setP] = useState<Contagem>(inicial)
  const [rodando, setRodando] = useState(status === 'importando')
  const [erro, setErro] = useState('')
  const [pendente, start] = useTransition()
  const [confirmarDesfazer, setConfirmarDesfazer] = useState(false)
  const [aviso, setAviso] = useState('')
  const [ausentes, setAusentes] = useState<Array<{ id: string; titulo: string; codigo: string }> | null>(null)
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const ativo = useRef(true)

  useEffect(() => () => { ativo.current = false }, [])

  const loop = useCallback(async () => {
    let falhas = 0
    while (ativo.current) {
      try {
        const r = await processarProximoLote(id)
        if (r.error || !r.progresso) throw new Error(r.error ?? 'Sem resposta')
        falhas = 0
        setErro('')
        setP(r.progresso)
        if (r.progresso.status !== 'importando' || r.progresso.pendentes === 0) break
      } catch (e) {
        falhas++
        if (falhas >= 3) {
          setErro(`Parou: ${e instanceof Error ? e.message : 'falha de conexão'}. Clique em Continuar.`)
          break
        }
        await new Promise(res => setTimeout(res, 3000 * falhas))
      }
    }
    if (ativo.current) {
      setRodando(false)
      router.refresh()
    }
  }, [id, router])

  useEffect(() => {
    if (!rodando) return
    ativo.current = true
    const t = setTimeout(loop, 0)
    const sair = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', sair)
    return () => { clearTimeout(t); ativo.current = false; window.removeEventListener('beforeunload', sair) }
  }, [rodando, loop])

  const feitos = p.criados + p.atualizados + p.sem_mudanca + p.erros + p.ignorados
  const pct = p.total ? Math.round((feitos / p.total) * 100) : 100
  const concluida = status === 'concluida' || p.status === 'concluida'

  const acao = (f: () => Promise<{ error?: string } & Record<string, unknown>>, ok?: (r: Record<string, unknown>) => void) => start(async () => {
    setErro('')
    try {
      const r = await f()
      if (r.error) setErro(r.error)
      else ok?.(r)
    } catch {
      setErro('Falha de conexão. Tente de novo.')
    }
    router.refresh()
  })

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          {concluida ? <CheckCircle2 size={16} className="text-green-600" /> : rodando ? <Loader2 size={16} className="animate-spin text-violet-600" /> : <Pause size={16} className="text-gray-400" />}
          {concluida ? 'Importação concluída' : status === 'cancelada' ? 'Importação cancelada' : rodando ? 'Importando…' : 'Pausada'}
        </h2>
        <span className="text-xs text-gray-500 tabular-nums">{feitos} de {p.total}</span>
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center mb-3">
        <Mini v={p.criados} r="criados" c="text-green-700" />
        <Mini v={p.atualizados} r="atualizados" c="text-violet-700" />
        <Mini v={p.sem_mudanca} r="sem mudança" />
        <Mini v={p.ignorados} r="de fora" c="text-gray-500" />
        <Mini v={p.erros} r="com erro" c="text-red-700" />
        <Mini v={p.pendentes} r="na fila" c="text-amber-700" />
      </div>

      {rodando && (
        <p className="text-[11px] text-gray-400 mb-3">
          As fotos são copiadas uma a uma, então leva uns segundos por imóvel. Pode sair desta tela: a importação continua de onde parou quando você voltar, ou sozinha de madrugada.
        </p>
      )}

      {erro && (
        <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-xl px-3 py-2 mb-3" role="alert">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {erro}
        </p>
      )}
      {aviso && <p className="text-sm text-green-800 bg-green-50 ring-1 ring-green-200 rounded-xl px-3 py-2 mb-3">{aviso}</p>}

      <div className="flex items-center gap-2 flex-wrap">
        {!concluida && status !== 'cancelada' && (
          rodando ? (
            <button onClick={() => { ativo.current = false; setRodando(false) }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg">
              <Pause size={14} /> Pausar
            </button>
          ) : (
            <button onClick={() => setRodando(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-violet-700 hover:bg-violet-800 px-3 py-2 rounded-lg">
              <Play size={14} /> Continuar
            </button>
          )
        )}
        {!concluida && status !== 'cancelada' && !rodando && (
          <button onClick={() => acao(() => cancelar(id))} disabled={pendente} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg">
            <X size={14} /> Cancelar o resto
          </button>
        )}

        {concluida && p.erros > 0 && (
          <button onClick={() => acao(() => tentarErrosDeNovo(id), () => setRodando(true))} disabled={pendente} className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-lg">
            <RotateCcw size={14} /> Tentar os {p.erros} com erro de novo
          </button>
        )}

        {(concluida || status === 'cancelada') && ausentesNaAnalise > 0 && !opcoes?.pausarAusentes && ausentes === null && (
          <button onClick={() => acao(() => verAusentes(id), r => {
            const l = (r.ausentes ?? []) as Array<{ id: string; titulo: string; codigo: string }>
            setAusentes(l); setMarcados(new Set(l.map(a => a.id)))
          })} disabled={pendente} className="inline-flex items-center gap-1.5 text-sm text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-lg">
            <EyeOff size={14} /> Ver os que sumiram do arquivo
          </button>
        )}

        {(concluida || status === 'cancelada') && p.criados > 0 && (
          confirmarDesfazer ? (
            <span className="flex items-center gap-2 text-sm bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-1.5">
              Apagar os imóveis criados que ainda são rascunho?
              <button onClick={() => acao(() => desfazer(id), r => setAviso(`${r.apagados ?? 0} rascunho(s) apagado(s).`))} disabled={pendente} className="font-semibold text-red-700">Apagar</button>
              <button onClick={() => setConfirmarDesfazer(false)} className="text-gray-500">Não</button>
            </span>
          ) : (
            <button onClick={() => setConfirmarDesfazer(true)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg">
              <Undo2 size={14} /> Desfazer
            </button>
          )
        )}

        {concluida && (
          <Link href="/painel/anuncios?status=rascunho" className="ml-auto text-sm font-semibold text-violet-700 hover:underline">
            Ver rascunhos →
          </Link>
        )}
      </div>

      {ausentes && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          {ausentes.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum anúncio no ar sumiu do arquivo.</p>
          ) : (
            <>
              <p className="text-sm text-gray-700 mb-2">
                Estes estão no ar aqui, mas <strong>não vieram</strong> no arquivo (provavelmente alugaram ou saíram do sistema de origem):
              </p>
              <ul className="max-h-72 overflow-y-auto space-y-1 mb-3">
                {ausentes.map(a => (
                  <li key={a.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox" checked={marcados.has(a.id)} className="accent-violet-700"
                        onChange={e => setMarcados(s => { const n = new Set(s); if (e.target.checked) n.add(a.id); else n.delete(a.id); return n })}
                      />
                      <span className="text-gray-800 truncate">{a.titulo}</span>
                      <span className="text-[11px] text-gray-400 shrink-0">cód. {a.codigo}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => acao(() => pausarOsAusentes(id, [...marcados]), r => { setAviso(`${r.pausados ?? 0} anúncio(s) pausado(s).`); setAusentes(null) })}
                disabled={pendente || marcados.size === 0}
                className="text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 px-3 py-2 rounded-lg"
              >
                Pausar {marcados.size} selecionado{marcados.size === 1 ? '' : 's'}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function Mini({ v, r, c = 'text-gray-900' }: { v: number; r: string; c?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg py-2">
      <p className={`text-lg font-bold tabular-nums ${c}`}>{v}</p>
      <p className="text-[10px] text-gray-500">{r}</p>
    </div>
  )
}
