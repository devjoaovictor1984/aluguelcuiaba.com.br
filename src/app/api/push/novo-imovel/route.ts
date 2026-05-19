import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarPushBroadcast } from '@/lib/push/sender'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Disparado pelo cliente logo após publicar um imóvel novo (status='ativo').
 *
 * Envia push broadcast pra todos os subscribers. Anti-abuse: confere que
 * o requisitante é dono do imovel_id E que o imóvel é mesmo ativo.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  let payload: { imovel_id?: string }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  if (!payload.imovel_id) return NextResponse.json({ error: 'falta imovel_id' }, { status: 400 })

  const admin = createAdminClient()
  const { data: imovel } = await admin
    .from('imoveis')
    .select(`
      id, titulo, slug, preco, status, user_id,
      bairro:bairros(nome, slug),
      fotos(url, principal, ordem)
    `)
    .eq('id', payload.imovel_id)
    .single()

  if (!imovel) return NextResponse.json({ error: 'imóvel não encontrado' }, { status: 404 })
  if (imovel.user_id !== user.id) return NextResponse.json({ error: 'não é dono' }, { status: 403 })
  if (imovel.status !== 'ativo') return NextResponse.json({ ok: true, skipped: 'não-ativo' })

  type BairroLite = { nome: string; slug: string } | { nome: string; slug: string }[] | null
  type FotoLite = { url: string; principal?: boolean | null; ordem?: number | null }

  const bairroRaw = imovel.bairro as BairroLite
  const bairro = Array.isArray(bairroRaw) ? bairroRaw[0] : bairroRaw
  const fotos = (imovel.fotos as FotoLite[] | null) ?? []
  const fotoPrincipal =
    fotos.find(f => f.principal)?.url ??
    [...fotos].sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999))[0]?.url ??
    null

  const preco = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(imovel.preco)
  const url = bairro && imovel.slug
    ? `/imoveis/${bairro.slug}/${imovel.slug}`
    : `/imoveis/${imovel.slug ?? imovel.id}`

  const resultado = await enviarPushBroadcast({
    title: 'Novo imóvel disponível 🏠',
    body: `${imovel.titulo} — ${preco}${bairro ? ` · ${bairro.nome}` : ''}`,
    url,
    image: fotoPrincipal ?? undefined,
    tag: `imovel-${imovel.id}`,
  })

  return NextResponse.json({ ok: true, ...resultado })
}
