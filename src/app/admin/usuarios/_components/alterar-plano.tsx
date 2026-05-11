'use client'

import { useState, useTransition } from 'react'
import { Loader2, Check, AlertCircle } from 'lucide-react'

interface Props {
  userId: string
  planoAtual: string
  action: (userId: string, plano: string) => Promise<{ erro?: string }>
}

export function AlterarPlanoForm({ userId, planoAtual, action }: Props) {
  const [plano, setPlano] = useState(planoAtual)
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'ok' | 'erro'>('idle')
  const [msg, setMsg] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('idle')
    startTransition(async () => {
      const result = await action(userId, plano)
      if (result?.erro) {
        setStatus('erro')
        setMsg(result.erro)
      } else {
        setStatus('ok')
        setTimeout(() => setStatus('idle'), 2000)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center gap-2">
        <select
          value={plano}
          onChange={e => setPlano(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white"
        >
          <option value="free">Gratuito</option>
          <option value="basico">Básico</option>
          <option value="profissional">Profissional</option>
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="text-xs bg-violet-700 text-white px-2.5 py-1.5 rounded-lg hover:bg-violet-800 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {isPending ? <Loader2 size={11} className="animate-spin" /> : status === 'ok' ? <Check size={11} /> : null}
          {isPending ? 'Salvando' : status === 'ok' ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
      {status === 'erro' && (
        <p className="flex items-center gap-1 text-[10px] text-red-600 mt-1">
          <AlertCircle size={10} /> {msg}
        </p>
      )}
    </form>
  )
}
