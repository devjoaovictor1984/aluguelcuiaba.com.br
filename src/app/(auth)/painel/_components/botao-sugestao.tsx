'use client'

import { useState, useTransition, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Lightbulb, X, Bug, MessageSquare, MessageCircle, HelpCircle, Loader2, Check, UserCircle } from 'lucide-react'
import { criarSugestao, type CategoriaSugestao } from '../_actions/sugestoes'

const categorias: Array<{
  valor: CategoriaSugestao
  label: string
  icone: typeof Bug
  classesAtivo: string
}> = [
  { valor: 'sugestao', label: 'Sugestão', icone: Lightbulb,     classesAtivo: 'border-violet-600 bg-violet-50 text-violet-700' },
  { valor: 'bug',      label: 'Bug',      icone: Bug,           classesAtivo: 'border-rose-600 bg-rose-50 text-rose-700' },
  { valor: 'duvida',   label: 'Dúvida',   icone: HelpCircle,    classesAtivo: 'border-amber-600 bg-amber-50 text-amber-700' },
  { valor: 'outro',    label: 'Outro',    icone: MessageSquare, classesAtivo: 'border-gray-500 bg-gray-50 text-gray-700' },
]

export function BotaoSugestao() {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const [categoria, setCategoria] = useState<CategoriaSugestao>('sugestao')
  const [mensagem, setMensagem] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  // Reset state quando fecha
  useEffect(() => {
    if (!aberto) {
      setTimeout(() => { setMensagem(''); setEnviado(false); setErro('') }, 200)
    }
  }, [aberto])

  const enviar = () => {
    setErro('')
    if (!mensagem.trim()) {
      setErro('Escreve sua sugestão antes de enviar.')
      return
    }
    startTransition(async () => {
      const r = await criarSugestao({
        categoria,
        mensagem,
        pagina_url: pathname,
        pagina_titulo: typeof document !== 'undefined' ? document.title : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      })
      if (r.error) { setErro(r.error); return }
      setEnviado(true)
      setTimeout(() => setAberto(false), 1800)
    })
  }

  return (
    <>
      {/* FAB — botão flutuante (corretor com balão de fala) */}
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="fixed bottom-5 right-5 z-40 bg-violet-700 hover:bg-violet-800 text-white rounded-full shadow-lg p-3.5 transition-all hover:scale-105 group"
        title="Deixe sua sugestão de melhoria aqui"
        aria-label="Abrir formulário de sugestão"
      >
        <div className="relative">
          {/* Corretor */}
          <UserCircle size={22} strokeWidth={2} />
          {/* Balão de fala sobre a cabeça */}
          <span className="absolute -top-2.5 -right-2.5 bg-white text-violet-700 rounded-full p-0.5 shadow-md border border-violet-200 animate-pulse">
            <MessageCircle size={11} strokeWidth={2.5} fill="currentColor" />
          </span>
        </div>
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Deixe sua sugestão de melhoria aqui
        </span>
      </button>

      {/* Modal */}
      {aberto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center sm:items-center justify-center p-4" onClick={() => setAberto(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Lightbulb className="text-violet-700" size={20} />
                <h2 className="text-base font-semibold text-gray-900">Sugerir melhoria</h2>
              </div>
              <button type="button" onClick={() => setAberto(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-500" />
              </button>
            </header>

            {enviado ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mb-3">
                  <Check size={24} />
                </div>
                <p className="text-sm font-semibold text-gray-900">Recebido, obrigado!</p>
                <p className="text-xs text-gray-500 mt-1">Vou avaliar e voltar se precisar de mais detalhes.</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Categoria */}
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Categoria</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {categorias.map(c => {
                      const Icone = c.icone
                      const ativa = categoria === c.valor
                      return (
                        <button
                          key={c.valor}
                          type="button"
                          onClick={() => setCategoria(c.valor)}
                          className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border-2 text-[11px] font-medium transition-colors ${
                            ativa ? c.classesAtivo : 'border-gray-100 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <Icone size={16} />
                          {c.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Contexto */}
                <div className="bg-gray-50 rounded-lg p-2.5 text-[11px] text-gray-500">
                  <p>📍 Página: <span className="font-mono text-gray-700">{pathname}</span></p>
                </div>

                {/* Mensagem */}
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Descreva sua sugestão *
                  </label>
                  <textarea
                    value={mensagem}
                    onChange={e => setMensagem(e.target.value)}
                    rows={5}
                    autoFocus
                    placeholder={
                      categoria === 'bug'
                        ? 'O que está acontecendo? O que você esperava? Passos pra reproduzir...'
                        : categoria === 'duvida'
                        ? 'Qual a sua dúvida sobre esta página?'
                        : 'O que falta? O que poderia ser melhor?'
                    }
                    maxLength={4000}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900 resize-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 text-right">{mensagem.length} / 4000</p>
                </div>

                {erro && (
                  <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{erro}</p>
                )}

                <button
                  type="button"
                  onClick={enviar}
                  disabled={isPending || !mensagem.trim()}
                  className="w-full bg-violet-700 hover:bg-violet-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {isPending ? <Loader2 size={15} className="animate-spin" /> : <Lightbulb size={15} />}
                  Enviar sugestão
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
