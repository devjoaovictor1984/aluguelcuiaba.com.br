import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { montarFeed } from '@/lib/portais/consulta'

/**
 * Feed VRSync de UM anunciante — a URL que se cadastra no Canal Pro
 * (OLX · ZAP Imóveis · Viva Real). Ver docs/integracoes/portais/README.md.
 *
 * Sem login (o portal não loga): quem protege é o token, um segredo de 43
 * caracteres guardado em `portais_feed` (RLS sem política). Token errado e
 * token inexistente respondem igual — 404 —, pra não servir de oráculo.
 */
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export async function GET(req: Request, { params }: Props) {
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return new Response('Not found', { status: 404 })

  const db = createAdminClient()
  const { data: feed } = await db.from('portais_feed').select('user_id').eq('token', token).maybeSingle()
  if (!feed) return new Response('Not found', { status: 404 })

  const { xml } = await montarFeed(feed.user_id)

  // Registra a leitura: responde "o portal já está puxando?" na tela.
  // Só conta robô: se o anunciante abre a URL no navegador pra conferir,
  // isso não pode parecer que o portal leu (nem apagar a leitura do portal).
  // `after`: roda depois de responder, sem atrasar o portal (e sem o risco
  // de a função congelar antes de gravar, que um `void promise` teria).
  const ua = (req.headers.get('user-agent') ?? '').slice(0, 200)
  const navegador = /mozilla/i.test(ua) && !/bot|crawler|spider/i.test(ua)
  if (!navegador) after(async () => {
    await db.from('portais_feed')
      .update({ lido_em: new Date().toISOString(), lido_por: ua })
      .eq('user_id', feed.user_id)
  })

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // O portal lê poucas vezes por dia; 15 min de CDN segura robô sem
      // atrasar de verdade uma alteração.
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
      'X-Robots-Tag': 'noindex',
    },
  })
}
