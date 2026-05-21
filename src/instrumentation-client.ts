// Roda no navegador antes da hidratação do React.
// Captura erros JS, performance e session replay (em erros).
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  enabled: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SENTRY_DEV === '1',

  // Session Replay — só grava sessões que tiveram erro (economiza quota)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,        // não mascara texto comum
      blockAllMedia: false,      // não bloqueia imagens
      maskAllInputs: true,       // mascara TODOS os inputs (CPF, senha, etc.)
    }),
  ],

  // Scrub de PII (CPF, e-mail) antes de mandar
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

// Necessário pro Next.js capturar navegação no client (transitions)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

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
