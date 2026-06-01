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
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
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
