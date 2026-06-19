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

function emailConvite(nome: string, papel: string | null, titulo: string, url: string, emitente: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
      <h2 style="color:#6d28d9">Assinatura de contrato</h2>
      <p>Olá ${nome},</p>
      <p>${emitente} solicitou sua assinatura no contrato <strong>${titulo}</strong>${papel ? ` (como <strong>${papel}</strong>)` : ''}.</p>
      <p>É rápido e seguro: você confere o documento, recebe um código por e-mail, tira uma selfie e assina na tela.</p>
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
}

export async function criarProcessoAssinatura(input: CriarProcessoInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (!input.contrato_id) return { error: 'Contrato inválido.' }
  const signatarios = (input.signatarios ?? []).filter(s => s.nome?.trim() && /\S+@\S+\.\S+/.test(s.email ?? ''))
  if (signatarios.length === 0) return { error: 'Adicione pelo menos 1 signatário com nome e e-mail válido.' }

  const { data: proc, error } = await supabase
    .from('contrato_assinaturas')
    .insert({
      user_id: acesso.userId,
      tipo_contrato: input.tipo_contrato,
      contrato_id: input.contrato_id,
      titulo: input.titulo ?? null,
      status: 'enviado',
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
      html: emailConvite(s.nome, s.papel, input.titulo, url, emitente),
      canal: 'assinatura_convite',
    })
  }

  return { ok: true, id: proc.id }
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
