'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, AlertTriangle, X } from 'lucide-react'
import { excluirContratoAdmin } from '../../actions'

interface Props {
  contratoAdmId: string
  codigo: string
}

export function BotaoExcluirAdm({ contratoAdmId, codigo }: Props) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const pode = confirma.trim().toUpperCase() === 'EXCLUIR'

  const onConfirmar = () => {
    if (!pode) return
    setErro('')
    startTransition(async () => {
      const r = await excluirContratoAdmin(contratoAdmId)
      if (r.error) { setErro(r.error); return }
      router.push('/painel/administracoes?excluido=1')
    })
  }

  return (
    <>
      <div className="text-center pt-4">
        <button
          type="button"
          onClick={() => { setAberto(true); setConfirma(''); setErro('') }}
          className="text-sm text-red-500 hover:text-red-700 hover:underline flex items-center gap-1.5 mx-auto"
        >
          <Trash2 size={13} /> Excluir este contrato de administração
        </button>
      </div>

      {aberto && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !isPending && setAberto(false)}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-gray-900">Excluir contrato de administração</h2>
                <p className="text-xs text-gray-500 mt-0.5">{codigo} — vai pra lixeira (restaurável).</p>
              </div>
              <button type="button" onClick={() => setAberto(false)} disabled={isPending} className="p-1 text-gray-400 hover:text-gray-700">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-3">
              Pra confirmar, digite <strong className="font-mono text-red-700">EXCLUIR</strong>:
            </p>
            <input
              type="text"
              value={confirma}
              onChange={e => setConfirma(e.target.value)}
              placeholder="EXCLUIR"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-mono uppercase"
              disabled={isPending}
              autoFocus
            />

            {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setAberto(false)}
                disabled={isPending}
                className="flex-1 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 font-semibold py-2.5 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirmar}
                disabled={!pode || isPending}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 font-semibold py-2.5 rounded-lg"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
