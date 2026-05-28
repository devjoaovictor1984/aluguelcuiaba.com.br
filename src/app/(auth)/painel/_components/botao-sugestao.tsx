'use client'

import { useState, useTransition, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Lightbulb, X, Bug, MessageSquare, HelpCircle, Loader2, Check } from 'lucide-react'
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
      {/* FAB — botão flutuante (operador de atendimento com balãozinho) */}
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="fixed bottom-5 right-5 z-40 group"
        aria-label="Abrir formulário de sugestão"
      >
        {/* Balão flutuante "Sua sugestão?" — sempre visível */}
        <span className="absolute -top-2 right-full mr-2 bg-white text-violet-700 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md border border-violet-200 whitespace-nowrap before:content-[''] before:absolute before:top-1/2 before:-translate-y-1/2 before:-right-1 before:w-2 before:h-2 before:bg-white before:border-r before:border-b before:border-violet-200 before:rotate-[-45deg] group-hover:scale-105 transition-transform">
          Sua sugestão?
        </span>
        {/* Avatar circular do operador */}
        <span className="block w-14 h-14 rounded-full overflow-hidden bg-white shadow-lg border-2 border-violet-200 group-hover:border-violet-500 group-hover:scale-105 transition-all">
          <Image
            src="/helpline.png"
            alt="Atendimento — sugestões e melhorias"
            width={56}
            height={56}
            className="w-full h-full object-cover"
            unoptimized
          />
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
