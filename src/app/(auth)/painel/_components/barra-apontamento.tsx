'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import {
  AlertTriangle, HelpCircle, Lightbulb, ThumbsUp, X, Loader2, Check, PenLine,
} from 'lucide-react'
import { registrarApontamento } from './actions-apontamento'

type Tipo = 'erro' | 'duvida' | 'sugestao' | 'ok'

const TIPOS: Array<{ valor: Tipo; label: string; ajuda: string; icone: typeof AlertTriangle; ativo: string }> = [
  { valor: 'erro',     label: 'Está errado', ajuda: 'não funciona ou o resultado não confere', icone: AlertTriangle, ativo: 'border-rose-600 bg-rose-50 text-rose-700' },
  { valor: 'duvida',   label: 'Dúvida',      ajuda: 'não deu pra entender o que deveria acontecer', icone: HelpCircle, ativo: 'border-amber-600 bg-amber-50 text-amber-700' },
  { valor: 'sugestao', label: 'Sugestão',    ajuda: 'funciona, mas poderia ser diferente', icone: Lightbulb, ativo: 'border-violet-600 bg-violet-50 text-violet-700' },
  { valor: 'ok',       label: 'Está certo',  ajuda: 'confirma que o comportamento está correto', icone: ThumbsUp, ativo: 'border-emerald-600 bg-emerald-50 text-emerald-700' },
]

/** Fora do componente: `Date.now()` no corpo do render viola react-hooks/purity. */
function diasAte(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000))
}

/**
 * A barra de apontamento da sessão de homologação.
 *
 * Fica visível o tempo todo de propósito: anotação que exige lembrar de
 * abrir um formulário depois não é feita. E o campo é curto porque o
 * contexto — rota, análise, seguradora, últimas chamadas à API — quem
 * anexa é o servidor, não quem escreve.
 *
 * O tipo "Está certo" existe pelo mesmo motivo que os outros três: é ele
 * que fecha pergunta em aberto do nosso lado.
 */
export function BarraApontamento({ expiraEm }: { expiraEm: string }) {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const [tipo, setTipo] = useState<Tipo>('erro')
  const [titulo, setTitulo] = useState('')
  const [detalhe, setDetalhe] = useState('')
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!aberto) {
      const t = setTimeout(() => {
        setTitulo(''); setDetalhe(''); setErro(''); setEnviado(false); setTipo('erro')
      }, 200)
      return () => clearTimeout(t)
    }
  }, [aberto])

  const enviar = () => {
    setErro('')
    if (!titulo.trim()) { setErro('Escreva do que se trata.'); return }
    startTransition(async () => {
      const r = await registrarApontamento({ tipo, titulo, detalhe, rota: pathname })
      if (r.error) { setErro(r.error); return }
      setEnviado(true)
      setTimeout(() => setAberto(false), 1200)
    })
  }

  const diasRestantes = diasAte(expiraEm)

  return (
    <>
      {/*
        Encostado na borda direita, na altura do meio da tela.
        
        Era uma faixa no rodapé, e ela cobria o botão "Salvar" das telas que
        têm ação no fim do formulário — que são quase todas. Rodapé fixo
        disputa espaço com rodapé de página; a lateral, não.
      */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-end gap-1.5">
        <span className="rounded-l-lg bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-1 ring-1 ring-amber-200">
          homologação · {diasRestantes}d
        </span>
        <button
          type="button"
          onClick={() => setAberto(true)}
          title={`Ambiente de teste — nada aqui vira apólice de verdade. Acesso por mais ${diasRestantes} dia(s).`}
          className="flex items-center gap-1.5 rounded-l-xl bg-violet-900 hover:bg-violet-800 text-white pl-3 pr-3.5 py-3 text-xs font-bold shadow-lg"
        >
          <PenLine size={14} /> Anotar
        </button>
      </div>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 p-4 pb-2">
              <div>
                <h2 className="text-base font-bold text-gray-900">Anotar sobre esta tela</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Registramos junto onde você está e as últimas chamadas à API — não
                  precisa descrever o passo a passo.
                </p>
              </div>
              <button type="button" onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={18} />
              </button>
            </div>

            {enviado ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <Check size={22} className="text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900">Anotado.</p>
                <p className="text-xs text-gray-500 mt-1">Pode seguir testando.</p>
              </div>
            ) : (
              <div className="p-4 pt-2 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS.map(t => {
                    const Icone = t.icone
                    const ativo = tipo === t.valor
                    return (
                      <button
                        key={t.valor}
                        type="button"
                        onClick={() => setTipo(t.valor)}
                        className={`text-left rounded-xl border-2 px-3 py-2.5 transition-colors ${
                          ativo ? t.ativo : 'border-gray-100 hover:border-gray-200 text-gray-700'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-xs font-bold">
                          <Icone size={13} /> {t.label}
                        </span>
                        <span className="block text-[10px] text-gray-500 mt-0.5 leading-snug">{t.ajuda}</span>
                      </button>
                    )
                  })}
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Do que se trata
                  </label>
                  <input
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Ex.: o limite aprovado não bate com o do nosso painel"
                    maxLength={160}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Detalhe <span className="text-gray-400">(opcional)</span>
                  </label>
                  <textarea
                    value={detalhe}
                    onChange={e => setDetalhe(e.target.value)}
                    rows={4}
                    placeholder="O que era esperado, o número certo, o nome do campo na tela de vocês…"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900 resize-none"
                  />
                </div>

                {erro && (
                  <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">{erro}</p>
                )}

                <button
                  type="button"
                  onClick={enviar}
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-700 hover:bg-violet-800 disabled:opacity-50 py-3 text-sm font-bold text-white"
                >
                  {isPending ? <Loader2 size={15} className="animate-spin" /> : <PenLine size={15} />}
                  {isPending ? 'Salvando…' : 'Salvar anotação'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
