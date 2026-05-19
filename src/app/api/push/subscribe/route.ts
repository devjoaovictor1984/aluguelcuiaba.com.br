import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let payload: { endpoint?: string; p256dh?: string; auth?: string; user_agent?: string }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { endpoint, p256dh, auth, user_agent } = payload
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Faltam endpoint/p256dh/auth' }, { status: 400 })
  }

  // user_id é opcional — convidado anônimo pode se inscrever
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { error } = await admin
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user?.id ?? null,
        endpoint,
        p256dh,
        auth,
        user_agent: user_agent?.slice(0, 200) ?? null,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
