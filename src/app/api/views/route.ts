import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { imovelId } = await request.json()
    if (!imovelId || typeof imovelId !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    const supabase = createAdminClient()
    await supabase.rpc('increment_imovel_views', { imovel_id: imovelId })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
