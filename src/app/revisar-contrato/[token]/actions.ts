'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

export async function submitConsideracao(token: string, formData: FormData) {
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('contrato_revisao_links')
    .select('id, expira_em, revogado_em')
    .eq('token', token)
    .maybeSingle()

  if (!link) return { error: 'Link inválido ou não encontrado.' }
  if (link.revogado_em) return { error: 'Este link foi revogado pelo solicitante.' }
  if (new Date(link.expira_em).getTime() < Date.now()) return { error: 'Link expirado. Peça um novo.' }

  const texto = String(formData.get('texto') ?? '').trim()
  const autor = String(formData.get('autor_nome') ?? '').trim()
  if (texto.length < 3) return { error: 'Escreva sua consideração.' }
  if (texto.length > 5000) return { error: 'Texto muito longo (máx. 5000 caracteres).' }

  const hdrs = await headers()
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0].trim() ??
    hdrs.get('x-real-ip') ??
    null

  const { error } = await admin.from('contrato_revisao_consideracoes').insert({
    link_id: link.id,
    autor_nome: autor || null,
    texto,
    ip,
  })
  if (error) return { error: `Erro ao enviar: ${error.message}` }

  return { ok: true }
}
