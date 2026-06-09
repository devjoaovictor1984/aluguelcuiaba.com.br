import { NextRequest, NextResponse } from 'next/server'
import { limitePorIp } from '@/lib/rate-limit'

// Recebe relatórios de violação da CSP (modo Report-Only).
// Loga um resumo nos logs do servidor (Vercel) pra calibrar a política
// antes de virar pra enforce. Não persiste nada.
export async function POST(request: NextRequest) {
  // Relatórios podem vir em rajada — limita pra não inundar o log.
  if (!await limitePorIp('csp-report', 60, 60)) {
    return new NextResponse(null, { status: 204 })
  }

  try {
    const body = await request.json()
    // Dois formatos: legado {"csp-report": {...}} e Reporting API [{ body: {...} }]
    const relatorios = Array.isArray(body)
      ? body.map(r => r?.body ?? r)
      : [body?.['csp-report'] ?? body]

    for (const r of relatorios) {
      if (!r) continue
      const directive = r['violated-directive'] ?? r['effectiveDirective'] ?? r['effective-directive'] ?? '?'
      const blocked = r['blocked-uri'] ?? r['blockedURL'] ?? r['blocked-url'] ?? '?'
      const doc = r['document-uri'] ?? r['documentURL'] ?? '?'
      console.warn(`[csp-report] ${directive} bloquearia ${blocked} em ${doc}`)
    }
  } catch {
    // corpo inválido — ignora
  }

  return new NextResponse(null, { status: 204 })
}
