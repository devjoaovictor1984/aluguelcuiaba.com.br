'use client'

import { useState, useEffect, useCallback } from 'react'

const KEY = 'aluguel_favoritos'

export function useFavoritos() {
  const [ids, setIds] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setIds(JSON.parse(raw))
    } catch {}
  }, [])

  const toggle = useCallback((id: string) => {
    setIds(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const isFavorito = useCallback((id: string) => ids.includes(id), [ids])

  return { ids, toggle, isFavorito, mounted }
}
