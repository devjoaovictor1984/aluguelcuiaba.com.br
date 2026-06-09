import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { limitePorIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const { postId } = await request.json()
    if (!postId || typeof postId !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    // Anti-inflação de contador: limite por IP.
    if (!await limitePorIp('post-views', 120, 60)) {
      return NextResponse.json({ ok: false }, { status: 429 })
    }

    const supabase = createAdminClient()

    const { data } = await supabase
      .from('posts')
      .select('visualizacoes')
      .eq('id', postId)
      .single()

    await supabase
      .from('posts')
      .update({ visualizacoes: (data?.visualizacoes ?? 0) + 1 })
      .eq('id', postId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[posts/views]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
