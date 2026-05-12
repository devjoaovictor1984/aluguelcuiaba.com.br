'use client'

import { useState, useTransition } from 'react'
import { salvarTemplate } from '../actions'
import { Check, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  chave: string
  titulo: string
  descricao: string
  variaveis: string[]
  assuntoInicial: string
  corpoInicial: string
}

export function TemplateForm({ chave, titulo, descricao, variaveis, assuntoInicial, corpoInicial }: Props) {
  const [assunto, setAssunto] = useState(assuntoInicial)
  const [corpo, setCorpo] = useState(corpoInicial)
  const [aberto, setAberto] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'erro'>('idle')
  const [isPending, startTransition] = useTransition()

  const handleSalvar = () => {
    startTransition(async () => {
      try {
        await salvarTemplate(chave, assunto, corpo)
        setStatus('ok')
        setTimeout(() => setStatus('idle'), 3000)
      } catch {
        setStatus('erro')
      }
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{titulo}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{descricao}</p>
        </div>
        {aberto ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>

      {aberto && (
        <div className="px-6 pb-6 space-y-4 border-t border-gray-50">
          <div className="pt-4">
            <p className="text-xs text-gray-500 mb-2 font-medium">Variáveis disponíveis:</p>
            <div className="flex flex-wrap gap-1.5">
              {variaveis.map(v => (
                <code key={v} className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded font-mono">{`{{${v}}}`}</code>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Assunto</label>
            <input
              value={assunto}
              onChange={e => setAssunto(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Corpo (HTML)</label>
            <textarea
              value={corpo}
              onChange={e => setCorpo(e.target.value)}
              rows={16}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900 font-mono resize-y"
            />
            <p className="text-xs text-gray-400">Use HTML completo. As variáveis serão substituídas antes do envio.</p>
          </div>

          {status === 'erro' && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">
              <AlertCircle size={15} />
              Erro ao salvar. Tente novamente.
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSalvar}
              disabled={isPending}
              className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : status === 'ok' ? <Check size={14} /> : null}
              {isPending ? 'Salvando...' : status === 'ok' ? 'Salvo!' : 'Salvar template'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
