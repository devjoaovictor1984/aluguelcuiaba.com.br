// Configuração do Sentry pro Node.js runtime (server actions, API routes, RSC).
// Importado pelo src/instrumentation.ts quando NEXT_RUNTIME === 'nodejs'.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sample rate de tracing. 10% em prod, 100% em dev pra ver tudo.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Marca cada evento com o ambiente
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',

  // No dev, só liga se SENTRY_DSN_DEV=1 — evita ruído enquanto desenvolve
  enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_DSN_DEV === '1',

  // Scrub de PII antes de mandar pro Sentry (CPF, e-mail em URL/breadcrumbs)
  beforeSend(event) {
    return scrubEvent(event)
  },
  beforeBreadcrumb(crumb) {
    if (crumb.data?.url && typeof crumb.data.url === 'string') {
      crumb.data.url = scrubString(crumb.data.url)
    }
    return crumb
  },
})

// Helpers (mesmos no client/edge — duplicados pra cada bundle ficar isolado)
function scrubString(s: string): string {
  return s
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, '[cpf]')
    .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, '[cnpj]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
}

function scrubEvent<T extends { request?: { url?: string; query_string?: unknown }; user?: { email?: string } }>(event: T): T {
  if (event.request?.url) event.request.url = scrubString(event.request.url)
  if (typeof event.request?.query_string === 'string') {
    event.request.query_string = scrubString(event.request.query_string)
  }
  if (event.user?.email) event.user.email = '[email]'
  return event
}
