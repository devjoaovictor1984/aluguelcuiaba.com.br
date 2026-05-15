'use client'

import { useEffect } from 'react'

const SESSION_KEY = 'aluguel_post_views'

export function RegistrarViewPost({ postId }: { postId: string }) {
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      const vistos: string[] = raw ? JSON.parse(raw) : []
      if (vistos.includes(postId)) return
      fetch('/api/posts/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })
      sessionStorage.setItem(SESSION_KEY, JSON.stringify([...vistos, postId]))
    } catch {}
  }, [postId])

  return null
}
