'use client'

// Captura erros que escaparam de qualquer layout ou template (raiz do app).
// Precisa ser client component e renderizar html/body próprios.
import * as Sentry from '@sentry/nextjs'
import Error from 'next/error'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body>
        <Error statusCode={500} />
      </body>
    </html>
  )
}
