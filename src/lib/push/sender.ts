import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarEnvio } from '@/lib/envios/logger'

let configurado = false

function configurarUmaVez() {
  if (configurado) return
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!pub || !priv || !subject) {
    throw new Error('VAPID env não configurado (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).')
  }
  webpush.setVapidDetails(subject, pub, priv)
  configurado = true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  image?: string
  icon?: string
  tag?: string
  /** Identifica o canal do push pro log (ex: 'novo_imovel', 'anuncio_parado_30d'). */
  canal?: string
}

interface SubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

async function enviarPushParaSubs(subs: SubscriptionRow[], payload: PushPayload) {
  configurarUmaVez()
  const admin = createAdminClient()
  if (subs.length === 0) return { enviados: 0, removidos: 0, falhas: 0 }

  const body = JSON.stringify(payload)
  const idsMortos: string[] = []
  let enviados = 0
  let falhas = 0
  const canal = payload.canal ?? null
  const ctxBase = { title: payload.title.slice(0, 100), tag: payload.tag ?? null }

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        )
        enviados += 1
        registrarEnvio({
          tipo: 'push', canal, destinatario: s.endpoint.slice(0, 80) + '…',
          status: 'ok', contexto: ctxBase,
        }).catch(() => null)
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        const erroMsg = e instanceof Error ? e.message : String(e)
        if (status === 404 || status === 410) {
          idsMortos.push(s.id)
          registrarEnvio({
            tipo: 'push', canal, destinatario: s.endpoint.slice(0, 80) + '…',
            status: 'morta', erro_msg: `${status}: ${erroMsg}`, contexto: ctxBase,
          }).catch(() => null)
        } else {
          falhas += 1
          registrarEnvio({
            tipo: 'push', canal, destinatario: s.endpoint.slice(0, 80) + '…',
            status: 'erro', erro_msg: `${status ?? '—'}: ${erroMsg}`, contexto: ctxBase,
          }).catch(() => null)
        }
      }
    })
  )

  if (idsMortos.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', idsMortos)
  }
  return { enviados, removidos: idsMortos.length, falhas }
}

/**
 * Envia push para um user específico (todos os endpoints dele).
 */
export async function enviarPushParaUser(userId: string, payload: PushPayload) {
  configurarUmaVez()
  const admin = createAdminClient()
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (error) return { enviados: 0, removidos: 0, falhas: 0, erro: error.message }
  return enviarPushParaSubs((subs ?? []) as SubscriptionRow[], payload)
}

/**
 * Envia um push para TODAS as subscrições ativas. Subscrições mortas
 * (410 Gone, 404 Not Found) são removidas automaticamente.
 *
 * Retorna { enviados, removidos, falhas }.
 */
export async function enviarPushBroadcast(payload: PushPayload) {
  configurarUmaVez()
  const admin = createAdminClient()

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
  if (error) return { enviados: 0, removidos: 0, falhas: 0, erro: error.message }

  const lista = (subs ?? []) as SubscriptionRow[]
  const r = await enviarPushParaSubs(lista, { ...payload, canal: payload.canal ?? 'broadcast' })

  // Atualiza last_seen pra quem sobreviveu (fire-and-forget)
  if (r.enviados > 0) {
    admin
      .from('push_subscriptions')
      .update({ last_seen: new Date().toISOString() })
      .gte('created_at', '1970-01-01')
      .then(() => null)
  }

  return r
}
