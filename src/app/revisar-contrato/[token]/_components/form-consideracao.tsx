'use client'

import { useState, useTransition } from 'react'
import { Loader2, Check, AlertCircle, Send } from 'lucide-react'
import { submitConsideracao } from '../actions'

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900'

export function FormConsideracao({ token }: { token: string }) {
  const [autor, setAutor] = useState('')
  const [texto, setTexto] = useState('')
  const [isPending, startTransition] = useTransition()
  const [estado, setEstado] = useState<'idle' | 'sucesso' | 'erro'>('idle')
  const [msgErro, setMsgErro] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setEstado('idle')
    setMsgErro('')
    const fd = new FormData()
    fd.set('autor_nome', autor)
    fd.set('texto', texto)
    startTransition(async () => {
      const r = await submitConsideracao(token, fd)
      if (r.error) { setEstado('erro'); setMsgErro(r.error); return }
      setEstado('sucesso')
      setTexto('')
    })
  }

  if (estado === 'sucesso') {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Check size={24} className="text-green-600" />
        </div>
        <h3 className="font-bold text-gray-900 mb-1">Considerações enviadas!</h3>
        <p className="text-sm text-gray-500 mb-4">O solicitante já pode ver suas observações.</p>
        <button
          type="button"
          onClick={() => setEstado('idle')}
          className="text-sm font-semibold text-violet-700 hover:underline"
        >
          Enviar outra
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Seu nome (opcional)</label>
        <input value={autor} onChange={e => setAutor(e.target.value)} className={inputCls} placeholder="Quem está revisando" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Considerações *</label>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          rows={5}
          required
          className={`${inputCls} resize-y`}
          placeholder="Ex.: revisar a cláusula de reajuste, corrigir meu CPF, ajustar a data de início..."
        />
      </div>

      {estado === 'erro' && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2.5">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{msgErro}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || texto.trim().length < 3}
        className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        Enviar considerações
      </button>
    </form>
  )
}
