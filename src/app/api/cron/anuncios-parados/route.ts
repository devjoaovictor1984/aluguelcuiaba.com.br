import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail } from '@/lib/email/sender'
import { getTemplate, renderTemplate, type ChaveTemplate } from '@/lib/email/templates'
import { enviarPushParaUser } from '@/lib/push/sender'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Avisa anunciantes que têm imóveis ativos parados há 30+ ou 60+ dias
 * sem atualização. Idempotente: cada imóvel recebe cada aviso uma vez,
 * resetando quando o anunciante edita o imóvel (trigger no banco).
 *
 * Cron diário via Vercel:
 *   GET /api/cron/anuncios-parados (Authorization: Bearer $CRON_SECRET)
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 })
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const agora = new Date()
  const cutoff30 = new Date(agora.getTime() - 30 * 86400000).toISOString()
  const cutoff60 = new Date(agora.getTime() - 60 * 86400000).toISOString()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aluguelcuiaba.com.br'

  type ImovelRow = {
    id: string; titulo: string; user_id: string; updated_at: string
    aviso_30d_em: string | null; aviso_60d_em: string | null
  }

  // Busca elegíveis pra 30d (parados há 30+, sem aviso, não silenciados)
  const { data: para30 } = await admin
    .from('imoveis')
    .select('id, titulo, user_id, updated_at, aviso_30d_em, aviso_60d_em')
    .eq('status', 'ativo')
    .lt('updated_at', cutoff30)
    .gte('updated_at', cutoff60) // só 30-60d, deixa 60+ pro próximo
    .is('aviso_30d_em', null)
    .or(`avisos_silenciados_ate.is.null,avisos_silenciados_ate.lt.${agora.toISOString()}`)
    .limit(200)

  // Busca elegíveis pra 60d
  const { data: para60 } = await admin
    .from('imoveis')
    .select('id, titulo, user_id, updated_at, aviso_30d_em, aviso_60d_em')
    .eq('status', 'ativo')
    .lt('updated_at', cutoff60)
    .is('aviso_60d_em', null)
    .or(`avisos_silenciados_ate.is.null,avisos_silenciados_ate.lt.${agora.toISOString()}`)
    .limit(200)

  const lista30 = (para30 ?? []) as ImovelRow[]
  const lista60 = (para60 ?? []) as ImovelRow[]

  // Cache de email + nome por user_id pra não bater 1x por imóvel
  const userIds = Array.from(new Set([...lista30, ...lista60].map(i => i.user_id)))
  const emailsMap = new Map<string, string>()
  for (const uid of userIds) {
    const { data } = await admin.auth.admin.getUserById(uid)
    if (data.user?.email) emailsMap.set(uid, data.user.email)
  }
  const { data: perfis } = await admin
    .from('perfis').select('id, nome').in('id', userIds.length > 0 ? userIds : ['none'])
  const nomesMap = new Map((perfis ?? []).map(p => [p.id as string, p.nome as string | null]))

  async function processarLote(lista: ImovelRow[], chave: ChaveTemplate, coluna: 'aviso_30d_em' | 'aviso_60d_em') {
    if (lista.length === 0) return { enviadosEmail: 0, enviadosPush: 0 }
    const template = await getTemplate(chave)
    let enviadosEmail = 0
    let enviadosPush = 0
    const idsMarcar: string[] = []

    for (const im of lista) {
      const email = emailsMap.get(im.user_id)
      const nome = nomesMap.get(im.user_id) ?? email ?? 'anunciante'
      const dias = Math.floor((agora.getTime() - new Date(im.updated_at).getTime()) / 86400000)
      const vars = {
        nome: nome.split(' ')[0],
        titulo: im.titulo,
        dias: String(dias),
        painel_url: `${appUrl}/painel/anuncios/${im.id}/editar`,
      }

      // Email (se tiver)
      if (email) {
        const r = await enviarEmail({
          to: email,
          subject: renderTemplate(template.assunto, vars),
          html: renderTemplate(template.corpo, vars),
          canal: chave,
        })
        if (!r.error) enviadosEmail += 1
      }

      // Push (se anunciante tiver subscription)
      const pushTitulo = chave === 'anuncio_parado_60d'
        ? 'Anúncio há 60 dias sem update'
        : 'Anúncio precisa de uma renovada'
      const rp = await enviarPushParaUser(im.user_id, {
        title: pushTitulo,
        body: `"${im.titulo}" está parado há ${dias} dias. Toque para atualizar.`,
        url: `/painel/anuncios/${im.id}/editar`,
        tag: `parado-${im.id}`,
        canal: chave,
      })
      enviadosPush += rp.enviados

      idsMarcar.push(im.id)
    }

    // Marca todos em batch (1 UPDATE per coluna)
    if (idsMarcar.length > 0) {
      await admin.from('imoveis').update({ [coluna]: agora.toISOString() }).in('id', idsMarcar)
    }
    return { enviadosEmail, enviadosPush }
  }

  const r30 = await processarLote(lista30, 'anuncio_parado_30d', 'aviso_30d_em')
  const r60 = await processarLote(lista60, 'anuncio_parado_60d', 'aviso_60d_em')

  return NextResponse.json({
    ok: true,
    elegiveis_30d: lista30.length,
    elegiveis_60d: lista60.length,
    enviados_email_30d: r30.enviadosEmail,
    enviados_push_30d: r30.enviadosPush,
    enviados_email_60d: r60.enviadosEmail,
    enviados_push_60d: r60.enviadosPush,
  })
}
