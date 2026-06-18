'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface Props {
  plano: string
  className: string
  label: string
}

export function CheckoutButton({ plano, className, label }: Props) {
  const [loading, setLoading] = useState(false)

  async function iniciarCheckout() {
    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano }),
      })

      if (res.status === 401) {
        window.location.href = `/entrar?redirect=/planos`
        return
      }

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        return
      }
      // Já tem plano ativo → manda pro Portal pra trocar.
      if (data.portal) {
        const portal = await fetch('/api/portal', { method: 'POST' })
        const pd = await portal.json()
        if (pd.url) { window.location.href = pd.url; return }
      }
      if (data.error) alert(data.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={iniciarCheckout} disabled={loading} className={className}>
      {loading && <Loader2 size={15} className="animate-spin inline mr-2" />}
      {label}
    </button>
  )
}
