import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { limitePorIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const { imovelId } = await request.json()
    if (!imovelId || typeof imovelId !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    // Anti-inflação de contador: limite por IP.
    if (!await limitePorIp('views', 120, 60)) {
      return NextResponse.json({ ok: false }, { status: 429 })
    }

    const supabase = createAdminClient()

    const { data } = await supabase
      .from('imoveis')
      .select('visualizacoes')
      .eq('id', imovelId)
      .single()

    await supabase
      .from('imoveis')
      .update({ visualizacoes: (data?.visualizacoes ?? 0) + 1 })
      .eq('id', imovelId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[views]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
