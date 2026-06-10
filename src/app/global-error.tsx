'use client'

// Captura erros que escaparam de qualquer layout ou template (raiz do app).
// Precisa ser client component e renderizar html/body próprios.
//
// Usa estilos inline (não depende do globals.css, que pode não estar
// disponível quando a raiz quebra) e NÃO usa next/error (Pages Router),
// que podia estourar aqui e degradar pra um 500 cru irrecuperável.

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', background: '#f9fafb' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', background: '#fff', border: '1px solid #eef2ff', borderRadius: 16, padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '9999px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 26 }}>
              ⚠️
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
              Algo deu errado
            </h1>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>
              Tivemos um problema ao carregar esta página. Tente novamente — se persistir,
              feche e abra o app de novo.
            </p>
            <button
              onClick={() => reset()}
              style={{ background: '#7c3aed', color: '#fff', border: 0, borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Recarregar
            </button>
            <p style={{ marginTop: 16 }}>
              <a href="/" style={{ fontSize: 13, color: '#7c3aed', textDecoration: 'none' }}>
                Voltar para a página inicial
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
