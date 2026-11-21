import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Radio, AlertTriangle, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { COLUNAS_PORTAL, SITE_URL } from '@/lib/portais/consulta'
import { validarParaPortal, type ImovelPortal } from '@/lib/portais/vrsync'
import { UrlFeed } from './_components/url-feed'
import { LinhaPortal } from './_components/linha-portal'

export const dynamic = 'force-dynamic'

/**
 * Portais — escolhe o que vai pro OLX · ZAP Imóveis · Viva Real e mostra a
 * URL do feed pra cadastrar no Canal Pro. Ver docs/integracoes/portais/README.md.
 * Cada anunciante tem o próprio feed (o contrato no Canal Pro é dele).
 */
export default async function PortaisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const [{ data: feed, error: erroFeed }, { data: dados, error: erroImoveis }] = await Promise.all([
    createAdminClient().from('portais_feed').select('token, criado_em, lido_em, lido_por').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('imoveis')
      .select(`${COLUNAS_PORTAL}, status, expira_em, publicar_portais`)
      .eq('user_id', user.id)
      .in('status', ['ativo', 'pausado', 'alugado', 'expirado'])
      .order('created_at', { ascending: false }),
  ])

  // Migration v107 ainda não rodada: as colunas/tabela não existem.
  const faltaMigration = [erroFeed?.message, erroImoveis?.message].some(m => m && /portais|publicar_portais/i.test(m))
  if (faltaMigration) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-amber-50 ring-1 ring-amber-200 rounded-2xl p-5 text-sm text-amber-900">
          <p className="font-semibold mb-1">Falta rodar a migration v107 no Supabase</p>
          <p>Arquivo: <code>supabase/migrations/crm_v107_portais_feed.sql</code>. Depois disso esta tela liga sozinha.</p>
        </div>
      </main>
    )
  }

  // eslint-disable-next-line react-hooks/purity -- server component dinâmico; data do request
  const agora = Date.now()
  type Linha = ImovelPortal & { status: string; expira_em: string; publicar_portais: boolean }
  const imoveis = ((dados ?? []) as unknown as Linha[]).map(im => {
    const noAr = im.status === 'ativo' && new Date(im.expira_em).getTime() >= agora
    return { im, noAr, problemas: validarParaPortal(im) }
  })
  const noFeed = imoveis.filter(x => x.im.publicar_portais && x.noAr && !x.problemas.some(p => p.nivel === 'erro')).length
  const ligadosComErro = imoveis.filter(x => x.im.publicar_portais && x.noAr && x.problemas.some(p => p.nivel === 'erro')).length

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 pb-24">
      <Link href="/painel/anuncios" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-violet-700 mb-2">
        <ArrowLeft size={12} /> Meus anúncios
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Radio size={22} className="text-violet-600" /> Portais
      </h1>
      <p className="text-sm text-gray-500 mt-0.5 mb-5">
        Publique seus anúncios no <strong>OLX</strong>, <strong>ZAP Imóveis</strong> e <strong>Viva Real</strong> com um feed só.
      </p>

      <UrlFeed
        urlBase={`${SITE_URL}/api/portais/vrsync/`}
        token={feed?.token ?? null}
        lidoEm={feed?.lido_em ?? null}
        lidoPor={feed?.lido_por ?? null}
        noFeed={noFeed}
      />

      {ligadosComErro > 0 && (
        <div className="flex items-start gap-2 bg-red-50 ring-1 ring-red-200 text-red-800 text-sm rounded-xl px-4 py-3 mb-4">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{ligadosComErro} anúncio{ligadosComErro === 1 ? '' : 's'} marcado{ligadosComErro === 1 ? '' : 's'} para os portais não {ligadosComErro === 1 ? 'entra' : 'entram'} no feed até corrigir o que está em vermelho.</span>
        </div>
      )}

      {imoveis.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-2xl border border-gray-100 p-6 text-center">
          Nenhum anúncio ainda. <Link href="/painel/anuncios/novo" className="text-violet-700 font-semibold hover:underline">Publicar o primeiro</Link>
        </p>
      ) : (
        <ul className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {imoveis.map(({ im, noAr, problemas }) => (
            <LinhaPortal
              key={im.id}
              id={im.id}
              titulo={im.titulo}
              bairro={im.bairro?.nome ?? null}
              foto={im.fotos?.find(f => f.principal)?.url ?? im.fotos?.[0]?.url ?? null}
              noAr={noAr}
              publicar={im.publicar_portais}
              destaque={im.portais_destaque ?? 'STANDARD'}
              problemas={problemas}
            />
          ))}
        </ul>
      )}

      <p className="text-xs text-gray-400 mt-4 flex items-center gap-1">
        Como funciona e o que contratar no Canal Pro:
        <a href="https://canalpro.grupozap.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-violet-600 hover:underline">
          Canal Pro <ExternalLink size={10} />
        </a>
      </p>
    </main>
  )
}
