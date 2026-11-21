import { createAdminClient } from '@/lib/supabase/admin'
import { ehRoboDoPortal } from '@/lib/portais/vrsync'

export const dynamic = 'force-dynamic'

/**
 * Quem está usando a integração com OLX · ZAP · Viva Real: URL gerada,
 * anúncios ligados e se o Canal Pro já leu. Para suporte — o token NÃO
 * aparece aqui. Ver docs/integracoes/portais/README.md.
 */
export default async function AdminPortaisPage() {
  const db = createAdminClient()
  const [{ data: feeds, error }, { data: ligados }] = await Promise.all([
    db.from('portais_feed').select('user_id, criado_em, lido_em, lido_por'),
    db.from('imoveis').select('user_id').eq('publicar_portais', true).eq('status', 'ativo')
      .gte('expira_em', new Date().toISOString()).limit(10000),
  ])
  if (error) return <div className="p-6 text-rose-600">{error.message} (a migration v107 foi rodada?)</div>

  const porUser = new Map<string, number>()
  for (const l of ligados ?? []) porUser.set(l.user_id, (porUser.get(l.user_id) ?? 0) + 1)

  const ids = [...new Set([...(feeds ?? []).map(f => f.user_id), ...porUser.keys()])]
  const { data: perfis } = ids.length
    ? await db.from('perfis').select('id, nome').in('id', ids)
    : { data: [] as { id: string; nome: string | null }[] }
  const nome = new Map((perfis ?? []).map(p => [p.id, p.nome]))
  const feedDe = new Map((feeds ?? []).map(f => [f.user_id, f]))

  const linhas = ids.map(id => {
    const f = feedDe.get(id)
    return {
      id,
      nome: nome.get(id) || '(sem nome)',
      criado: f?.criado_em ?? null,
      lidoEm: f?.lido_em ?? null,
      portal: ehRoboDoPortal(f?.lido_por),
      lidoPor: f?.lido_por ?? null,
      ligados: porUser.get(id) ?? 0,
    }
  }).sort((a, b) => Number(b.portal) - Number(a.portal) || b.ligados - a.ligados)

  const conectados = linhas.filter(l => l.portal).length
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR') : '—')

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Portais — OLX · ZAP · Viva Real</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {linhas.length} anunciante{linhas.length === 1 ? '' : 's'} usando · {conectados} com o Canal Pro já lendo.
          A URL de cada um fica só com ele; aqui não aparece.
        </p>
      </header>

      {linhas.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-100 p-6 text-center">
          Ninguém gerou URL nem ligou anúncio ainda.
        </p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 bg-gray-50">
              <tr>
                <th className="text-left font-medium px-3 py-2">Anunciante</th>
                <th className="text-right font-medium px-3 py-2">Ligados</th>
                <th className="text-left font-medium px-3 py-2">URL gerada</th>
                <th className="text-left font-medium px-3 py-2">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linhas.map(l => (
                <tr key={l.id}>
                  <td className="px-3 py-2">
                    <span className="text-gray-900">{l.nome}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.ligados}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{fmt(l.criado)}</td>
                  <td className="px-3 py-2 text-xs">
                    {!l.criado ? (
                      <span className="text-amber-700">Ligou anúncios mas não gerou a URL</span>
                    ) : l.portal ? (
                      <span className="text-green-700">Canal Pro lendo · {fmt(l.lidoEm)}</span>
                    ) : l.lidoEm ? (
                      <span className="text-gray-600">Lido por outro programa · {fmt(l.lidoEm)}<span className="text-gray-400"> · {l.lidoPor?.slice(0, 30)}</span></span>
                    ) : (
                      <span className="text-gray-500">Aguardando o Canal Pro</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
