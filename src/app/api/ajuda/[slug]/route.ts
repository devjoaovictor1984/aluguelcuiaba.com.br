import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

// Endpoint leve pro <BotaoAjuda slug="..."> carregar conteúdo sob demanda.
// Respeita RLS — só authenticated. Cacheia 5 min no client.
export async function GET(_req: Request, { params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('ajuda_secoes')
    .select('titulo, resumo, conteudo_html, atualizado_em')
    .eq('slug', slug)
    .eq('publicado', true)
    .maybeSingle()

  if (error?.message?.includes('relation')) {
    return NextResponse.json({ error: 'migration_v23_pendente' }, { status: 503 })
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
}
