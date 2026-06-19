'use server'

import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

function gerarToken(): string {
  return randomBytes(24).toString('base64url')
}

export interface GerarLinkRevisaoInput {
  tipo_contrato: 'locacao' | 'administracao'
  // chave do PDF: geração (locação) ou contrato de administração
  contrato_id: string
  titulo?: string | null
  horas_validade?: number
}

export async function gerarLinkRevisao(input: GerarLinkRevisaoInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (!input.contrato_id) return { error: 'Contrato inválido.' }
  if (!['locacao', 'administracao'].includes(input.tipo_contrato)) return { error: 'Tipo inválido.' }

  const horas = Math.max(1, Math.min(720, input.horas_validade ?? 168)) // até 30 dias
  const expira = new Date(Date.now() + horas * 3600 * 1000).toISOString()
  const token = gerarToken()

  const { error } = await supabase.from('contrato_revisao_links').insert({
    user_id: acesso.userId,
    tipo_contrato: input.tipo_contrato,
    contrato_id: input.contrato_id,
    token,
    titulo: input.titulo ?? null,
    expira_em: expira,
  })
  if (error) return { error: error.message }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
  return { ok: true, token, url: `${baseUrl}/revisar-contrato/${token}`, expira_em: expira }
}

export async function revogarLinkRevisao(linkId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { error } = await supabase
    .from('contrato_revisao_links')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', linkId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function marcarConsideracoesLidas(linkId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: l } = await supabase
    .from('contrato_revisao_links')
    .select('id')
    .eq('id', linkId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!l) return { error: 'Link não encontrado.' }

  const { error } = await supabase
    .from('contrato_revisao_consideracoes')
    .update({ lido_em: new Date().toISOString() })
    .eq('link_id', linkId)
    .is('lido_em', null)
  if (error) return { error: error.message }
  return { ok: true }
}
