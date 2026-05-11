'use client'

import { useEffect } from 'react'

const SESSION_KEY = 'aluguel_views'

export function RegistrarView({ imovelId }: { imovelId: string }) {
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      const vistos: string[] = raw ? JSON.parse(raw) : []
      if (vistos.includes(imovelId)) return
      fetch('/api/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imovelId }),
      })
      sessionStorage.setItem(SESSION_KEY, JSON.stringify([...vistos, imovelId]))
    } catch {}
  }, [imovelId])

  return null
}
