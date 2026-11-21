import { createClient } from '@/lib/supabase/server'
import { montarFeed } from '@/lib/portais/consulta'

/**
 * "Baixar arquivo de teste" — o mesmo XML que o portal leria, para o
 * anunciante subir no validador oficial (developers.grupozap.com/feeds/xml_validator/)
 * SEM precisar de plano no Canal Pro nem de ligar nada.
 *
 * ?todos=1 → todos os anúncios no ar que passam nas regras, ligados ou não.
 * Sem o parâmetro → só os ligados (exatamente o que o portal vê).
 */
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Faça login', { status: 401 })

  const todos = new URL(req.url).searchParams.get('todos') === '1'
  const { xml } = await montarFeed(user.id, { soLigados: !todos })

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="feed-portais${todos ? '-todos' : ''}.xml"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
