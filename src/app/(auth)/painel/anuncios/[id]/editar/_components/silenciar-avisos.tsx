'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BellOff, Bell, Loader2, Check } from 'lucide-react'
import { silenciarAvisosImovel, reativarAvisosImovel } from '../../../actions-avisos'

interface Props {
  imovelId: string
  silenciadoAte: string | null
}

export function SilenciarAvisos({ imovelId, silenciadoAte }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState('')

  const ativo = silenciadoAte && new Date(silenciadoAte).getTime() > Date.now()

  const silenciar = (dias: number) => {
    setMsg('')
    startTransition(async () => {
      const r = await silenciarAvisosImovel(imovelId, dias)
      if (r.error) { setMsg(r.error); return }
      setMsg(`Avisos silenciados até ${new Date(r.ate!).toLocaleDateString('pt-BR')}`)
      router.refresh()
    })
  }

  const reativar = () => {
    setMsg('')
    startTransition(async () => {
      const r = await reativarAvisosImovel(imovelId)
      if (r.error) { setMsg(r.error); return }
      setMsg('Avisos reativados')
      router.refresh()
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
          {ativo ? <BellOff size={16} /> : <Bell size={16} />}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">Avisos de anúncio parado</h3>
          <p className="text-xs text-gray-500">
            {ativo
              ? <>Silenciados até <strong>{new Date(silenciadoAte!).toLocaleDateString('pt-BR')}</strong>. Nem email nem push de "anúncio parado" são enviados.</>
              : <>Você recebe lembrete por email/push quando este anúncio fica 30 ou 60 dias sem atualização.</>
            }
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ativo ? (
          <button
            type="button"
            onClick={reativar}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs font-semibold bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
          >
            {isPending ? <Loader2 size={11} className="animate-spin" /> : <Bell size={11} />}
            Reativar avisos
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => silenciar(30)}
              disabled={isPending}
              className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              <BellOff size={11} /> 30 dias
            </button>
            <button
              type="button"
              onClick={() => silenciar(90)}
              disabled={isPending}
              className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              <BellOff size={11} /> 90 dias
            </button>
            <button
              type="button"
              onClick={() => silenciar(180)}
              disabled={isPending}
              className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              <BellOff size={11} /> 180 dias
            </button>
          </>
        )}
      </div>

      {msg && (
        <p className="flex items-center gap-1 text-xs text-green-700 mt-2">
          <Check size={11} /> {msg}
        </p>
      )}
    </section>
  )
}
