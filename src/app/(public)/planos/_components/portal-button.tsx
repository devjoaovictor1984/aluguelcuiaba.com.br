'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface Props {
  className: string
  label: string
}

// Leva o usuário ao Portal do Stripe, onde ele troca de plano (upgrade/downgrade)
// ou cancela. A cobrança/proração é tratada pelo Stripe; o webhook
// (customer.subscription.updated) sincroniza o plano no banco.
export function PortalButton({ className, label }: Props) {
  const [loading, setLoading] = useState(false)

  async function irParaPortal() {
    setLoading(true)
    try {
      const res = await fetch('/api/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        return
      }
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }

  return (
    <button onClick={irParaPortal} disabled={loading} className={className}>
      {loading && <Loader2 size={15} className="animate-spin inline mr-2" />}
      {label}
    </button>
  )
}
