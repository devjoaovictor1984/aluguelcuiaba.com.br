'use server'

import { createHash, randomInt } from 'crypto'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail } from '@/lib/email/sender'

function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

interface SignatarioRow {
  id: string
  assinatura_id: string
  nome: string
  email: string
  status: string
  otp_hash: string | null
  otp_expira_em: string | null
  assinatura: { status: string; titulo: string | null } | { status: string; titulo: string | null }[] | null
}

async function carregar(token: string): Promise<{ sig?: SignatarioRow; proc?: { status: string; titulo: string | null }; error?: string }> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('contrato_assinatura_signatarios')
    .select('id, assinatura_id, nome, email, status, otp_hash, otp_expira_em, assinatura:contrato_assinaturas!inner(status, titulo)')
    .eq('token', token)
    .maybeSingle()
  if (!data) return { error: 'Link inválido ou não encontrado.' }
  const proc = (Array.isArray(data.assinatura) ? data.assinatura[0] : data.assinatura) ?? undefined
  if (!proc) return { error: 'Processo não encontrado.' }
  if (proc.status === 'cancelado') return { error: 'Esta solicitação foi cancelada.' }
  return { sig: data as SignatarioRow, proc }
}

export async function solicitarOtp(token: string) {
  const { sig, error } = await carregar(token)
  if (!sig) return { error: error ?? 'Link inválido.' }
  if (sig.status === 'assinado') return { error: 'Você já assinou este contrato.' }

  const admin = createAdminClient()
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const expira = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error: upErr } = await admin
    .from('contrato_assinatura_signatarios')
    .update({ otp_hash: hashOtp(codigo), otp_expira_em: expira })
    .eq('id', sig.id)
  if (upErr) return { error: upErr.message }

  const r = await enviarEmail({
    to: sig.email,
    subject: 'Seu código de assinatura',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#1f2937">
        <p>Olá ${sig.nome},</p>
        <p>Seu código para assinar o contrato é:</p>
        <p style="font-size:30px;font-weight:bold;letter-spacing:6px;color:#6d28d9">${codigo}</p>
        <p style="font-size:12px;color:#6b7280">Válido por 10 minutos. Não compartilhe este código.</p>
      </div>
    `,
    canal: 'assinatura_otp',
  })
  if (r.error) return { error: `Falha ao enviar o código: ${r.error}` }
  return { ok: true, email: sig.email.replace(/^(.).*(@.*)$/, '$1***$2') }
}

export async function confirmarAssinatura(token: string, payload: {
  otp: string
  selfie_b64: string
  assinatura_b64: string
  consentimento: boolean
  geo?: string | null
}) {
  const { sig, error } = await carregar(token)
  if (!sig) return { error: error ?? 'Link inválido.' }
  if (sig.status === 'assinado') return { error: 'Você já assinou este contrato.' }

  if (!payload.consentimento) return { error: 'É preciso aceitar o termo de consentimento.' }
  if (!payload.selfie_b64?.startsWith('data:image')) return { error: 'Selfie obrigatória.' }
  if (!payload.assinatura_b64?.startsWith('data:image')) return { error: 'Assinatura obrigatória.' }

  // Verifica OTP
  if (!sig.otp_hash || !sig.otp_expira_em) return { error: 'Solicite o código primeiro.' }
  if (new Date(sig.otp_expira_em).getTime() < Date.now()) return { error: 'Código expirado. Solicite outro.' }
  if (hashOtp((payload.otp ?? '').trim()) !== sig.otp_hash) return { error: 'Código incorreto.' }

  const admin = createAdminClient()
  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0].trim() ?? hdrs.get('x-real-ip') ?? null
  const ua = hdrs.get('user-agent') ?? null
  const agora = new Date().toISOString()

  const { error: upErr } = await admin
    .from('contrato_assinatura_signatarios')
    .update({
      status: 'assinado',
      selfie_b64: payload.selfie_b64,
      assinatura_b64: payload.assinatura_b64,
      consentimento_em: agora,
      assinado_em: agora,
      otp_verificado_em: agora,
      ip, user_agent: ua, geo: payload.geo ?? null,
    })
    .eq('id', sig.id)
  if (upErr) return { error: upErr.message }

  // Todos assinaram? → conclui o processo e envia o contrato assinado às partes
  const { data: pendentes } = await admin
    .from('contrato_assinatura_signatarios')
    .select('id')
    .eq('assinatura_id', sig.assinatura_id)
    .neq('status', 'assinado')
  if ((pendentes?.length ?? 0) === 0) {
    await admin
      .from('contrato_assinaturas')
      .update({ status: 'concluido', concluido_em: agora })
      .eq('id', sig.assinatura_id)

    // Envia o link de download do contrato assinado pra cada signatário (best-effort)
    const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host')
    const proto = hdrs.get('x-forwarded-proto') ?? 'https'
    const base = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? '')
    const proc = (Array.isArray(sig.assinatura) ? sig.assinatura[0] : sig.assinatura)
    const titulo = proc?.titulo ?? 'Contrato'
    const { data: todos } = await admin
      .from('contrato_assinatura_signatarios')
      .select('nome, email, token')
      .eq('assinatura_id', sig.assinatura_id)
    for (const t of todos ?? []) {
      const dl = `${base}/api/assinaturas/${sig.assinatura_id}/pdf-final?st=${t.token}`
      await enviarEmail({
        to: t.email,
        subject: `Contrato assinado — ${titulo}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#1f2937">
            <h2 style="color:#16a34a">Contrato assinado por todas as partes ✅</h2>
            <p>Olá ${t.nome},</p>
            <p>O contrato <strong>${titulo}</strong> foi assinado por todos. Baixe a via final (contrato + certificado de assinatura):</p>
            <p style="margin:24px 0"><a href="${dl}" style="background:#6d28d9;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Baixar contrato assinado</a></p>
            <p style="font-size:12px;color:#6b7280">Se o botão não abrir, copie e cole:<br>${dl}</p>
          </div>
        `,
        canal: 'assinatura_concluida',
      })
    }
  }

  return { ok: true }
}
