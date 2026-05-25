'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, AlertTriangle, X } from 'lucide-react'
import { excluirContrato } from '../../actions'

interface Props {
  contratoId: string
  contratoCodigo: string
}

export function BotaoExcluirContrato({ contratoId, contratoCodigo }: Props) {
  const router = useRouter()
  const [mostrarModal, setMostrarModal] = useState(false)
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const podeExcluir = confirmacao.trim().toUpperCase() === 'EXCLUIR'

  const onExcluir = () => {
    if (!podeExcluir) return
    setErro('')
    startTransition(async () => {
      const r = await excluirContrato(contratoId)
      if (r.error) { setErro(r.error); return }
      router.push('/painel/contratos?excluido=1')
    })
  }

  return (
    <>
      <div className="text-center pt-4">
        <button
          type="button"
          onClick={() => { setMostrarModal(true); setConfirmacao(''); setErro('') }}
          className="text-sm text-red-500 hover:text-red-700 hover:underline flex items-center gap-1.5 mx-auto"
        >
          <Trash2 size={13} /> Excluir este contrato
        </button>
      </div>

      {mostrarModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !isPending && setMostrarModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-gray-900">Excluir contrato</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {contratoCodigo} — o contrato vai pra <strong>Lixeira</strong> e pode ser restaurado por lá em até 30 dias.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModal(false)}
                disabled={isPending}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-xs text-red-800">
              <strong>Atenção:</strong> isso vai esconder o contrato da lista, parcelas e relatórios. Vistorias e gerações de PDF associadas continuam no banco, mas só ficam acessíveis se você restaurar pela lixeira.
            </div>

            <label className="block text-xs text-gray-600 mb-1.5">
              Pra confirmar, digite <strong className="font-mono text-red-700">EXCLUIR</strong> abaixo:
            </label>
            <input
              type="text"
              value={confirmacao}
              onChange={e => setConfirmacao(e.target.value)}
              placeholder="EXCLUIR"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-mono uppercase"
              disabled={isPending}
              autoFocus
            />

            {erro && (
              <p className="text-xs text-red-600 mt-2">{erro}</p>
            )}

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setMostrarModal(false)}
                disabled={isPending}
                className="flex-1 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 font-semibold py-2.5 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onExcluir}
                disabled={!podeExcluir || isPending}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold py-2.5 rounded-lg"
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
