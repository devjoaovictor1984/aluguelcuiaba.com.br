import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

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

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        )
        enviados += 1
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) idsMortos.push(s.id)
        else falhas += 1
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
  if (lista.length === 0) return { enviados: 0, removidos: 0, falhas: 0 }

  const body = JSON.stringify(payload)
  const idsMortos: string[] = []
  let enviados = 0
  let falhas = 0

  await Promise.allSettled(
    lista.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        )
        enviados += 1
        // last_seen atualiza, mas em batch pra evitar 1 UPDATE por push.
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          idsMortos.push(s.id)
        } else {
          falhas += 1
        }
      }
    })
  )

  if (idsMortos.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', idsMortos)
  }

  // Atualiza last_seen em lote pra quem sobreviveu (fire-and-forget — não bloqueia)
  if (enviados > 0) {
    const sobreviventes = lista.filter(s => !idsMortos.includes(s.id)).map(s => s.id)
    if (sobreviventes.length > 0) {
      admin
        .from('push_subscriptions')
        .update({ last_seen: new Date().toISOString() })
        .in('id', sobreviventes)
        .then(() => null)
    }
  }

  return { enviados, removidos: idsMortos.length, falhas }
}
