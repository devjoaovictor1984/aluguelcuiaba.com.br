'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FileCheck, Loader2, X } from 'lucide-react'
import { marcarNfEmitida, desmarcarNfEmitida } from '../actions'

interface Props {
  parcelaIds: string[]
  jaEmitida: boolean
  totalComissao: number
  proprietarioNome: string
  numeroNfAtual?: string | null
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export function BotaoNfProprietario({ parcelaIds, jaEmitida, totalComissao, proprietarioNome, numeroNfAtual }: Props) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [numero, setNumero] = useState(numeroNfAtual ?? '')
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState('')

  if (jaEmitida) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-full">
          <CheckCircle2 size={12} /> NF emitida
          {numeroNfAtual && <span className="font-mono text-[10px] opacity-70">· #{numeroNfAtual}</span>}
        </span>
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Marcar a NF de ${proprietarioNome} como NÃO emitida?`)) return
            startTransition(async () => {
              const r = await desmarcarNfEmitida(parcelaIds)
              if (r.error) { alert(r.error); return }
              router.refresh()
            })
          }}
          disabled={isPending}
          className="text-[10px] text-gray-400 hover:text-red-600 transition-colors print:hidden"
          title="Desfazer marcação"
        >
          {isPending ? <Loader2 size={11} className="animate-spin" /> : 'desfazer'}
        </button>
      </div>
    )
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 text-xs font-semibold bg-violet-700 hover:bg-violet-800 text-white px-3 py-1.5 rounded-lg transition-colors print:hidden"
        title="Marcar nota fiscal como emitida"
      >
        <FileCheck size={12} /> Confirmar NF emitida
      </button>
    )
  }

  const confirmar = () => {
    setErro('')
    startTransition(async () => {
      const r = await marcarNfEmitida(parcelaIds, numero)
      if (r.error) { setErro(r.error); return }
      setAberto(false)
      router.refresh()
    })
  }

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 print:hidden w-full sm:w-auto sm:min-w-[280px]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-violet-900">
          NF de {fmtBRL(totalComissao)}
        </p>
        <button type="button" onClick={() => setAberto(false)} className="text-violet-500 hover:text-violet-700">
          <X size={13} />
        </button>
      </div>
      <input
        type="text"
        value={numero}
        onChange={e => setNumero(e.target.value)}
        placeholder="Nº da NF (opcional)"
        className="w-full px-2.5 py-1.5 rounded-lg border border-violet-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 mb-2 bg-white"
        maxLength={40}
      />
      {erro && <p className="text-[11px] text-red-600 mb-2">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="flex-1 text-xs text-gray-600 hover:text-gray-800 bg-white border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
        >
          {isPending ? <Loader2 size={11} className="animate-spin" /> : <FileCheck size={11} />}
          Confirmar
        </button>
      </div>
    </div>
  )
}
