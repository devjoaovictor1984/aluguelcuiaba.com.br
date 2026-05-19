import { Trash2, AlertCircle, User, FileSignature } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { formatarData } from '@/lib/formatters'
import { AcoesLixeira } from './_components/acoes-lixeira'

function diasAte(deletedAt: string): number {
  const apaga = new Date(deletedAt).getTime() + 30 * 86400000
  return Math.max(0, Math.ceil((apaga - Date.now()) / 86400000))
}

export default async function LixeiraPage() {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const [{ data: pessoasDeletadas }, { data: contratosDeletados }] = await Promise.all([
    supabase
      .from('pessoas')
      .select('id, tipo, nome, cpf_cnpj, deleted_at')
      .eq('user_id', acesso.userId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('contratos_locacao')
      .select(`
        id, codigo, status, valor_aluguel, data_inicio, deleted_at,
        inquilino:pessoas!inquilino_id(nome)
      `)
      .eq('user_id', acesso.userId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
  ])

  const pessoas = pessoasDeletadas ?? []
  const contratos = (contratosDeletados ?? []) as Array<{
    id: string; codigo: string; status: string; valor_aluguel: number
    data_inicio: string; deleted_at: string
    inquilino: { nome: string } | { nome: string }[] | null
  }>

  const total = pessoas.length + contratos.length

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Trash2 size={20} className="text-gray-500" /> Lixeira
        </h1>
        <p className="text-sm text-gray-500">
          Registros excluídos. Você pode restaurar ou apagar definitivamente. Itens com mais de 30 dias podem ser limpos automaticamente.
        </p>
      </div>

      {total === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Trash2 size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-700 mb-1">Lixeira vazia</p>
          <p className="text-xs text-gray-500">Nada foi excluído recentemente.</p>
        </div>
      ) : (
        <>
          {contratos.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <FileSignature size={14} className="text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-900">
                  Contratos excluídos <span className="text-gray-400 font-normal">({contratos.length})</span>
                </h2>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm min-w-[520px]">
                <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Inquilino</th>
                    <th className="px-3 py-2">Excluído em</th>
                    <th className="px-3 py-2 text-center">Apagamento</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contratos.map(c => {
                    const inq = Array.isArray(c.inquilino) ? c.inquilino[0] : c.inquilino
                    const dias = diasAte(c.deleted_at)
                    return (
                      <tr key={c.id} className="border-t border-gray-50">
                        <td className="px-3 py-2 font-mono text-xs text-gray-700">{c.codigo}</td>
                        <td className="px-3 py-2 text-gray-900">{inq?.nome ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{formatarData(c.deleted_at)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${dias <= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            em {dias}d
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <AcoesLixeira id={c.id} tipo="contrato" nome={c.codigo} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table></div>
            </section>
          )}

          {pessoas.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <User size={14} className="text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-900">
                  Pessoas excluídas <span className="text-gray-400 font-normal">({pessoas.length})</span>
                </h2>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm min-w-[520px]">
                <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">CPF/CNPJ</th>
                    <th className="px-3 py-2">Excluído em</th>
                    <th className="px-3 py-2 text-center">Apagamento</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pessoas.map(p => {
                    const dias = diasAte(p.deleted_at!)
                    return (
                      <tr key={p.id} className="border-t border-gray-50">
                        <td className="px-3 py-2 text-gray-900 font-medium">{p.nome}</td>
                        <td className="px-3 py-2 text-xs text-gray-600 capitalize">{p.tipo}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{p.cpf_cnpj ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{formatarData(p.deleted_at!)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${dias <= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            em {dias}d
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <AcoesLixeira id={p.id} tipo="pessoa" nome={p.nome} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table></div>
            </section>
          )}

          <div className="bg-amber-50 border border-amber-100 text-amber-900 text-xs rounded-xl px-3 py-2.5 flex items-start gap-2">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>
              <strong>Apagar definitivamente</strong> exclui o registro do banco junto com tudo que estiver vinculado a ele (parcelas, moradores, documentos do contrato).
              Esta ação <strong>não tem volta</strong>.
            </span>
          </div>
        </>
      )}
    </div>
  )
}
