'use client'

import { useEffect } from 'react'

/**
 * Registra o service worker na primeira visita. Roda só no client e
 * silencia erro em browsers que não suportam (Safari < 16.4, etc).
 */
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(err => console.warn('[sw] falhou:', err?.message))
  }, [])

  return null
}
