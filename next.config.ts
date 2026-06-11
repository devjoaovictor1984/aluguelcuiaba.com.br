import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Documentos do cadastro (RG/CPF/comprovante) chegam a 10MB cada.
      // O default de 1MB derrubava o submit do magic-link.
      bodySizeLimit: '25mb',
    },
  },
  images: {
    // Loader custom: imagens do Supabase são redimensionadas pelo próprio
    // Supabase (render/image), não pelo otimizador da Vercel — que estourou
    // cota e passou a responder 402. Ver src/lib/supabase-image-loader.ts.
    loader: 'custom',
    loaderFile: './src/lib/supabase-image-loader.ts',
    // Menos buckets de largura = menos transformações distintas no Supabase
    // (cada largura é uma transformação "fria" de ~1s na 1ª vez). Consolidar
    // mantém o cache quente e reduz o srcset.
    deviceSizes: [640, 828, 1080, 1920],
    imageSizes: [48, 96, 256],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/favicon.ico',
        destination: '/api/favicon',
        permanent: false,
      },
    ]
  },
  async headers() {
    // CSP em modo REPORT-ONLY: não bloqueia nada, só reporta violações em
    // /api/csp-report pra calibrar a política antes de virar enforce.
    // Domínios mapeados: Supabase, tiles OSM, Google Maps (iframe), GTM +
    // Facebook Pixel, Stripe, viaCEP. 'unsafe-inline' em script é necessário
    // enquanto não houver nonce do Next; revisar antes do enforce.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org https://www.googletagmanager.com https://www.google-analytics.com https://www.facebook.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://viacep.com.br https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://www.googletagmanager.com https://connect.facebook.net https://api.stripe.com",
      "frame-src 'self' https://maps.google.com https://www.google.com https://js.stripe.com https://hooks.stripe.com",
      "worker-src 'self' blob:",
      "report-uri /api/csp-report",
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Força HTTPS por 2 anos (sem preload pra não travar reversão futura).
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // Câmera liberada só pra mesma origem (selfie de vistoria/termo);
          // microfone bloqueado; geolocalização e pagamento só same-origin.
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(self), payment=(self), browsing-topics=()',
          },
          // REPORT-ONLY: observa violações sem bloquear. Trocar pra
          // 'Content-Security-Policy' (enforce) só após os relatórios zerarem.
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // Org + project da sua conta Sentry (vêm do wizard)
  org: 'aluguelcuiabacombr',
  project: 'javascript-nextjs',

  // Token só é necessário pro upload de source maps em build (Vercel/CI).
  // Em dev local, fica em silêncio se não tiver.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Logs do plugin no build — útil pra confirmar que source maps subiram
  silent: !process.env.CI,

  // Source maps: gerar e mandar pro Sentry, sem expor no client final
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Tunnel pra contornar adblockers (passa eventos pelo seu próprio domínio)
  tunnelRoute: '/monitoring',

  // Adiciona o React component annotation no client (mostra nome do componente)
  reactComponentAnnotation: { enabled: true },

  // Desativa o telemetry do plugin pra Sentry (não mistura com sua quota)
  telemetry: false,
})
