'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Trash2, Loader2 } from 'lucide-react'
import {
  restaurarPessoa, excluirDefinitivoPessoa,
} from '../../clientes/actions'
import {
  restaurarContrato, excluirDefinitivoContrato,
} from '../../contratos/actions'

interface Props {
  id: string
  tipo: 'pessoa' | 'contrato'
  nome: string
}

export function AcoesLixeira({ id, tipo, nome }: Props) {
  const router = useRouter()
  const [acao, setAcao] = useState<'restaurar' | 'excluir' | null>(null)
  const [isPending, startTransition] = useTransition()

  const restaurar = () => {
    setAcao('restaurar')
    startTransition(async () => {
      const r = tipo === 'pessoa' ? await restaurarPessoa(id) : await restaurarContrato(id)
      setAcao(null)
      if (r.error) { alert(r.error); return }
      router.refresh()
    })
  }

  const excluir = () => {
    if (!confirm(`Excluir DEFINITIVAMENTE "${nome}"? Não tem volta.`)) return
    setAcao('excluir')
    startTransition(async () => {
      const r = tipo === 'pessoa' ? await excluirDefinitivoPessoa(id) : await excluirDefinitivoContrato(id)
      setAcao(null)
      if (r.error) { alert(r.error); return }
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={restaurar}
        disabled={isPending}
        title="Restaurar"
        className="flex items-center gap-1 text-xs text-green-700 hover:bg-green-50 px-2 py-1 rounded-lg disabled:opacity-50"
      >
        {acao === 'restaurar' ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
        Restaurar
      </button>
      <button
        type="button"
        onClick={excluir}
        disabled={isPending}
        title="Apagar definitivo"
        className="flex items-center gap-1 text-xs text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg disabled:opacity-50"
      >
        {acao === 'excluir' ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
        Apagar
      </button>
    </div>
  )
}
