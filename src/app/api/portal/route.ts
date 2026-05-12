import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: perfil } = await admin
    .from('perfis')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!perfil?.stripe_customer_id) {
    return NextResponse.json({ error: 'Sem assinatura ativa' }, { status: 400 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: perfil.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/painel`,
  })

  return NextResponse.json({ url: session.url })
}
