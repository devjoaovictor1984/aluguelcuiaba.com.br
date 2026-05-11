import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Assinatura ausente' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Webhook inválido' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Pagamento confirmado → ativa plano
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.client_reference_id
    const plano = session.metadata?.plano

    if (!userId || !plano) return NextResponse.json({ ok: true })

    const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
    const expiraEm = new Date(subscription.current_period_end * 1000).toISOString()

    await admin
      .from('perfis')
      .update({
        plano,
        plano_expira_em: expiraEm,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
      })
      .eq('id', userId)
  }

  // Renovação mensal → atualiza data de expiração
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice
    const subscriptionId = invoice.subscription as string
    if (!subscriptionId) return NextResponse.json({ ok: true })

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const expiraEm = new Date(subscription.current_period_end * 1000).toISOString()

    const { data: perfil } = await admin
      .from('perfis')
      .select('id')
      .eq('stripe_subscription_id', subscriptionId)
      .single()

    if (perfil) {
      await admin
        .from('perfis')
        .update({ plano_expira_em: expiraEm })
        .eq('id', perfil.id)
    }
  }

  // Assinatura cancelada → volta para free
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription

    const { data: perfil } = await admin
      .from('perfis')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single()

    if (perfil) {
      await admin
        .from('perfis')
        .update({ plano: 'free', plano_expira_em: null, stripe_subscription_id: null })
        .eq('id', perfil.id)
    }
  }

  return NextResponse.json({ ok: true })
}
