import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROTULO_STATUS } from '@/app/(auth)/painel/anuncios/importar/_components/historico'
import { ImportarPara } from './_components/importar-para'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Importações de XML de todas as contas, e importar PARA uma conta (o
 * serviço de migração feito pelo admin). A tela de cada importação é a
 * mesma do anunciante. Ver docs/integracoes/importacao/README.md.
 */
export default async function AdminImportacoesPage() {
  const db = createAdminClient()
  const [{ data: imps, error }, { data: perfis }, { data: fontes }, usuarios] = await Promise.all([
    db.from('importacoes').select('id, user_id, origem, url, arquivo_nome, status, resumo, total, criado_em, automatica, erro')
      .order('criado_em', { ascending: false }).limit(100),
    db.from('perfis').select('id, nome, tipo').order('nome').limit(5000),
    db.from('importacoes_fontes').select('id, user_id, url, sincronizar, ultima_sincronizacao_em, ultimo_erro'),
    db.auth.admin.listUsers({ perPage: 1000 }).then(r => r.data?.users ?? []).catch(() => []),
  ])
  if (error) return <div className="p-6 text-rose-600">{error.message} (a migration v108 foi rodada?)</div>

  const email = new Map(usuarios.map(u => [u.id, u.email ?? '']))
  const nome = new Map((perfis ?? []).map(p => [p.id, p.nome]))
  const contas = (perfis ?? []).map(p => ({ id: p.id, nome: p.nome ?? '(sem nome)', email: email.get(p.id) ?? '', tipo: p.tipo }))
  const sincronizando = (fontes ?? []).filter(f => f.sincronizar)

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Importações de XML</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Imóveis trazidos de outros sistemas (VRSync / ZAP). {sincronizando.length} URL{sincronizando.length === 1 ? '' : 's'} com atualização diária.
        </p>
      </header>

      <ImportarPara contas={contas} />

      {sincronizando.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Atualização diária ligada</h2>
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100 text-sm">
            {sincronizando.map(f => (
              <div key={f.id} className="px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-gray-900">{nome.get(f.user_id) || '(sem nome)'}</span>
                <span className="font-mono text-[11px] text-gray-500 truncate max-w-md">{f.url}</span>
                <span className={`text-xs ${f.ultimo_erro ? 'text-red-700' : 'text-gray-500'}`}>
                  {f.ultimo_erro ? `Erro: ${f.ultimo_erro.slice(0, 60)}` : f.ultima_sincronizacao_em ? new Date(f.ultima_sincronizacao_em).toLocaleString('pt-BR') : 'nunca'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Últimas 100</h2>
        {!imps?.length ? (
          <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-100 p-6 text-center">Nenhuma importação ainda.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 bg-gray-50">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Conta</th>
                  <th className="text-left font-medium px-3 py-2">Origem</th>
                  <th className="text-right font-medium px-3 py-2">No arquivo</th>
                  <th className="text-left font-medium px-3 py-2">Situação</th>
                  <th className="text-left font-medium px-3 py-2">Quando</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {imps.map(i => {
                  const st = ROTULO_STATUS[i.status] ?? ROTULO_STATUS.erro
                  const r = i.resumo as { no_arquivo?: number } | null
                  return (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900">{nome.get(i.user_id) || '(sem nome)'}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate">
                        <Link href={`/painel/anuncios/importar/${i.id}`} className="hover:text-violet-700 hover:underline">
                          {i.origem === 'url' ? i.url : (i.arquivo_nome ?? 'arquivo')}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r?.no_arquivo ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.texto}</span>
                        {i.automatica && <span className="text-[11px] text-gray-400 ml-1">auto</span>}
                        {i.erro && <p className="text-[11px] text-red-600 truncate max-w-xs">{i.erro}</p>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{new Date(i.criado_em).toLocaleString('pt-BR')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
