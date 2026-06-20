'use server'

import { randomBytes } from 'crypto'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { enviarEmail } from '@/lib/email/sender'

function gerarToken(): string {
  return randomBytes(24).toString('base64url')
}

async function baseUrl(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  if (host) return `${proto}://${host}`
  return process.env.NEXT_PUBLIC_APP_URL ?? ''
}

function emailConvite(nome: string, papel: string | null, titulo: string, url: string, emitente: string, exigirOtp = true): string {
  const comoFunciona = exigirOtp
    ? 'É rápido e seguro: você confere o documento, informa seu e-mail e celular, recebe um código por e-mail, tira uma selfie e assina na tela.'
    : 'É rápido e seguro: você confere o documento, informa seu e-mail e celular, tira uma selfie e assina na tela.'
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
      <h2 style="color:#6d28d9">Assinatura de contrato</h2>
      <p>Olá ${nome},</p>
      <p>${emitente} solicitou sua assinatura no contrato <strong>${titulo}</strong>${papel ? ` (como <strong>${papel}</strong>)` : ''}.</p>
      <p>${comoFunciona}</p>
      <p style="margin:24px 0">
        <a href="${url}" style="background:#6d28d9;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Revisar e assinar</a>
      </p>
      <p style="font-size:12px;color:#6b7280">Se o botão não funcionar, copie e cole no navegador:<br>${url}</p>
    </div>
  `
}

export interface SignatarioInput {
  nome: string
  email: string
  papel?: string | null
}

export interface CriarProcessoInput {
  tipo_contrato: 'locacao' | 'administracao'
  contrato_id: string // chave do PDF (geração p/ locação, contrato p/ administração)
  titulo: string
  signatarios: SignatarioInput[]
  exigirOtp?: boolean // default true — quando false, assina só com selfie + assinatura
}

export async function criarProcessoAssinatura(input: CriarProcessoInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (!input.contrato_id) return { error: 'Contrato inválido.' }
  const signatarios = (input.signatarios ?? []).filter(s => s.nome?.trim() && /\S+@\S+\.\S+/.test(s.email ?? ''))
  if (signatarios.length === 0) return { error: 'Adicione pelo menos 1 signatário com nome e e-mail válido.' }
  const exigirOtp = input.exigirOtp !== false

  const { data: proc, error } = await supabase
    .from('contrato_assinaturas')
    .insert({
      user_id: acesso.userId,
      tipo_contrato: input.tipo_contrato,
      contrato_id: input.contrato_id,
      titulo: input.titulo ?? null,
      status: 'enviado',
      exigir_otp: exigirOtp,
    })
    .select('id')
    .single()
  if (error || !proc) return { error: error?.message ?? 'Falha ao criar processo.' }

  const rows = signatarios.map((s, i) => ({
    assinatura_id: proc.id,
    nome: s.nome.trim(),
    email: s.email.trim().toLowerCase(),
    papel: s.papel?.trim() || null,
    token: gerarToken(),
    ordem: i,
  }))

  const { data: inseridos, error: errS } = await supabase
    .from('contrato_assinatura_signatarios')
    .insert(rows)
    .select('nome, email, papel, token')
  if (errS) {
    await supabase.from('contrato_assinaturas').delete().eq('id', proc.id)
    return { error: errS.message }
  }

  // Nome do emitente pro e-mail
  const { data: perfil } = await supabase.from('perfis').select('razao_social, nome').eq('id', acesso.userId).maybeSingle()
  const emitente = perfil?.razao_social || perfil?.nome || 'AluguelCuiabá'

  const base = await baseUrl()
  for (const s of inseridos ?? []) {
    const url = `${base}/assinar/${s.token}`
    await enviarEmail({
      to: s.email,
      subject: `Assinatura — ${input.titulo}`,
      html: emailConvite(s.nome, s.papel, input.titulo, url, emitente, exigirOtp),
      canal: 'assinatura_convite',
    })
  }

  return { ok: true, id: proc.id }
}

// Corrige o e-mail de um signatário pendente (ex.: digitado errado) e, em
// seguida, reenvia o convite com o link de assinatura pro e-mail correto.
export async function atualizarEmailSignatario(signatarioId: string, email: string, reenviar = true) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const emailLimpo = (email ?? '').trim().toLowerCase()
  if (!/\S+@\S+\.\S+/.test(emailLimpo)) return { error: 'E-mail inválido.' }

  const { data: s } = await supabase
    .from('contrato_assinatura_signatarios')
    .select('id, nome, papel, token, status, assinatura:contrato_assinaturas!inner(user_id, titulo, status)')
    .eq('id', signatarioId)
    .maybeSingle()
  const a = (Array.isArray(s?.assinatura) ? s?.assinatura[0] : s?.assinatura) as { user_id: string; titulo: string | null; status: string } | undefined
  if (!s || a?.user_id !== acesso.userId) return { error: 'Signatário não encontrado.' }
  if (s.status === 'assinado') return { error: 'Este signatário já assinou.' }
  if (a?.status === 'cancelado') return { error: 'Processo cancelado.' }

  const { error } = await supabase
    .from('contrato_assinatura_signatarios')
    .update({ email: emailLimpo, otp_hash: null, otp_expira_em: null })
    .eq('id', signatarioId)
  if (error) return { error: error.message }

  if (reenviar) {
    const { data: perfil } = await supabase.from('perfis').select('razao_social, nome').eq('id', acesso.userId).maybeSingle()
    const emitente = perfil?.razao_social || perfil?.nome || 'AluguelCuiabá'
    const url = `${await baseUrl()}/assinar/${s.token}`
    await enviarEmail({
      to: emailLimpo,
      subject: `Assinatura — ${a?.titulo ?? 'Contrato'}`,
      html: emailConvite(s.nome, s.papel, a?.titulo ?? 'Contrato', url, emitente),
      canal: 'assinatura_convite',
    })
  }
  return { ok: true }
}

// Reenvia o convite (link de assinatura) pro e-mail atual do signatário.
export async function reenviarConviteSignatario(signatarioId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: s } = await supabase
    .from('contrato_assinatura_signatarios')
    .select('nome, email, papel, token, status, assinatura:contrato_assinaturas!inner(user_id, titulo, status)')
    .eq('id', signatarioId)
    .maybeSingle()
  const a = (Array.isArray(s?.assinatura) ? s?.assinatura[0] : s?.assinatura) as { user_id: string; titulo: string | null; status: string } | undefined
  if (!s || a?.user_id !== acesso.userId) return { error: 'Signatário não encontrado.' }
  if (s.status === 'assinado') return { error: 'Este signatário já assinou.' }
  if (a?.status === 'cancelado') return { error: 'Processo cancelado.' }

  const { data: perfil } = await supabase.from('perfis').select('razao_social, nome').eq('id', acesso.userId).maybeSingle()
  const emitente = perfil?.razao_social || perfil?.nome || 'AluguelCuiabá'
  const url = `${await baseUrl()}/assinar/${s.token}`
  const r = await enviarEmail({
    to: s.email,
    subject: `Assinatura — ${a?.titulo ?? 'Contrato'}`,
    html: emailConvite(s.nome, s.papel, a?.titulo ?? 'Contrato', url, emitente),
    canal: 'assinatura_convite',
  })
  if (r.error) return { error: `Falha ao enviar: ${r.error}` }
  return { ok: true }
}

export async function cancelarProcessoAssinatura(processoId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { error } = await supabase
    .from('contrato_assinaturas')
    .update({ status: 'cancelado' })
    .eq('id', processoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  return { ok: true }
}
