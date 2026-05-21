// Roda 1x quando o servidor Next inicia. Carrega o Sentry server ou edge
// dependendo do runtime, e expõe onRequestError pra capturar erros de
// server components, server actions e route handlers automaticamente.
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
