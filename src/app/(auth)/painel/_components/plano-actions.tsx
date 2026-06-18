'use client'

import { useState } from 'react'
import { Loader2, ArrowUpCircle, Settings } from 'lucide-react'

interface Props {
  plano: string
}

export function PlanoActions({ plano }: Props) {
  const [loadingUpgrade, setLoadingUpgrade] = useState(false)
  const [loadingPortal, setLoadingPortal] = useState(false)

  // Troca de plano pago acontece no Portal do Stripe (evita assinatura
  // duplicada). O webhook customer.subscription.updated sincroniza o plano.
  const irParaPortal = async (setBusy: (v: boolean) => void) => {
    setBusy(true)
    try {
      const res = await fetch('/api/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        return
      }
      setBusy(false)
    } catch {
      setBusy(false)
    }
  }

  if (plano === 'basico') {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => irParaPortal(setLoadingUpgrade)}
          disabled={loadingUpgrade}
          className="flex items-center gap-1.5 text-xs font-semibold text-orange-700 hover:text-orange-800 border border-orange-200 hover:border-orange-400 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loadingUpgrade
            ? <Loader2 size={11} className="animate-spin" />
            : <ArrowUpCircle size={12} />}
          Upgrade
        </button>
        <button
          onClick={() => irParaPortal(setLoadingPortal)}
          disabled={loadingPortal}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loadingPortal
            ? <Loader2 size={11} className="animate-spin" />
            : <Settings size={11} />}
          Gerenciar
        </button>
      </div>
    )
  }

  if (plano === 'profissional') {
    return (
      <button
        onClick={() => irParaPortal(setLoadingPortal)}
        disabled={loadingPortal}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
      >
        {loadingPortal
          ? <Loader2 size={11} className="animate-spin" />
          : <Settings size={11} />}
        Gerenciar assinatura
      </button>
    )
  }

  return null
}
