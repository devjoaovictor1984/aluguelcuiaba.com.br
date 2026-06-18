import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe, planoDoPrice } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { aplicarLimiteImoveis } from '@/lib/planos'

// Na API 2026-04-22.dahlia o campo current_period_end pode não existir diretamente.
// Usamos fallback de 30 dias quando o valor não estiver disponível.
async function getSubscriptionExpiry(subscriptionId: string): Promise<string> {
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
    if (periodEnd && Number.isFinite(periodEnd)) {
      return new Date(periodEnd * 1000).toISOString()
    }
  } catch {
    // ignora e usa fallback
  }
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + 30)
  return expiry.toISOString()
}

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

    const expiraEm = await getSubscriptionExpiry(session.subscription as string)

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

  // Troca de plano pelo Portal (upgrade/downgrade) → sincroniza plano e
  // aplica o limite de imóveis quando for downgrade.
  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const novoPlano = planoDoPrice(sub.items.data[0]?.price?.id)
    if (!novoPlano) return NextResponse.json({ ok: true })

    const { data: perfil } = await admin
      .from('perfis')
      .select('id')
      .eq('stripe_subscription_id', sub.id)
      .single()

    if (perfil) {
      const expiraEm = await getSubscriptionExpiry(sub.id)
      await admin
        .from('perfis')
        .update({ plano: novoPlano, plano_expira_em: expiraEm })
        .eq('id', perfil.id)

      // Downgrade: pausa imóveis ativos além do limite (mantém os mais recentes).
      await aplicarLimiteImoveis(admin, perfil.id, novoPlano)
    }
  }

  // Renovação mensal → atualiza data de expiração
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice & { subscription?: string }
    const subscriptionId = invoice.subscription
    if (!subscriptionId) return NextResponse.json({ ok: true })

    const expiraEm = await getSubscriptionExpiry(subscriptionId)

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

      // Voltou pro free (limite 1): pausa imóveis ativos excedentes.
      await aplicarLimiteImoveis(admin, perfil.id, 'free')
    }
  }

  return NextResponse.json({ ok: true })
}
