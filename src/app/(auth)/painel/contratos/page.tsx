import Link from 'next/link'
import { FileSignature, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

export default async function ContratosPage() {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: contratos } = await supabase
    .from('contratos_locacao')
    .select('id, codigo, status, valor_aluguel, data_inicio, inquilino:pessoas!inquilino_id(nome)')
    .eq('user_id', acesso.userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  const lista = contratos ?? []
  const totalAluguel = lista.reduce((s, c) => s + (c.valor_aluguel ?? 0), 0)
  const ativos = lista.filter(c => c.status === 'ativo')
  const totalAtivos = ativos.reduce((s, c) => s + (c.valor_aluguel ?? 0), 0)
  const fmtBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileSignature size={20} className="text-violet-600" />
            Contratos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {lista.length} contrato{lista.length === 1 ? '' : 's'} cadastrado{lista.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link
          href="/painel/contratos/novo"
          className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={15} />
          Novo contrato
        </Link>
      </div>

      {lista.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <FileSignature size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-700 mb-1">Nenhum contrato ainda</p>
          <p className="text-xs text-gray-500 mb-4">
            Comece cadastrando seus clientes em <Link href="/painel/clientes" className="text-violet-600 hover:underline">Clientes</Link>,
            depois crie o primeiro contrato.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {lista.map(c => {
              const inq = Array.isArray(c.inquilino) ? c.inquilino[0] : c.inquilino
              const inqNome = (inq as { nome?: string } | null)?.nome ?? '—'
              return (
                <Link key={c.id} href={`/painel/contratos/${c.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                  <span className="text-xs font-mono text-gray-400 w-24">{c.codigo}</span>
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">{inqNome}</span>
                  <span className="text-sm text-gray-600">
                    {fmtBRL(c.valor_aluguel)}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    c.status === 'ativo' ? 'bg-green-100 text-green-700' :
                    c.status === 'rascunho' ? 'bg-gray-100 text-gray-600' :
                    c.status === 'inadimplente' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {c.status}
                  </span>
                </Link>
              )
            })}
          </div>

          <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex items-center justify-between gap-4 text-sm">
            <span className="text-gray-500">
              Total da carteira <span className="text-gray-400">({lista.length} contrato{lista.length === 1 ? '' : 's'})</span>
            </span>
            <div className="flex items-center gap-4">
              {ativos.length > 0 && ativos.length !== lista.length && (
                <span className="text-xs text-gray-500">
                  Ativos: <span className="font-semibold text-green-700">{fmtBRL(totalAtivos)}</span>
                </span>
              )}
              <span className="font-bold text-violet-700">{fmtBRL(totalAluguel)}<span className="text-xs font-normal text-gray-400">/mês</span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
