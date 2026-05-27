import Link from 'next/link'
import { Briefcase, Plus, Home, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { Breadcrumbs } from '@/components/breadcrumbs'

const STATUS_COR: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  encerrado: 'bg-gray-100 text-gray-600',
  rescindido: 'bg-red-100 text-red-600',
  rascunho: 'bg-gray-100 text-gray-500',
}

function fmtData(d: string | null): string {
  if (!d) return '—'
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR')
}

export default async function AdministracoesPage() {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: contratos } = await supabase
    .from('contratos_administracao')
    .select(`
      id, codigo, status, data_inicio, data_termino,
      taxa_tipo, taxa_valor, exclusividade,
      proprietario:pessoas!proprietario_id(id, nome),
      imovel:imoveis(id, titulo)
    `)
    .eq('user_id', acesso.userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const lista = contratos ?? []
  type Prop = { nome: string } | { nome: string }[] | null

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <Breadcrumbs items={[{ label: 'Contratos de administração' }]} />
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase size={20} className="text-violet-600 shrink-0" />
            Contratos de Administração
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {lista.length} contrato{lista.length === 1 ? '' : 's'} de administração com proprietários
          </p>
        </div>
        <Link
          href="/painel/administracoes/novo"
          className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-colors"
        >
          <Plus size={15} />
          <span>Novo contrato de admin</span>
        </Link>
      </div>

      {lista.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Briefcase size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-700 mb-1">Nenhum contrato de administração ainda</p>
          <p className="text-xs text-gray-500 mb-4">
            Cadastre o vínculo de administração com cada proprietário pra gerenciar prazos, taxas e gerar contratos próprios.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {lista.map(c => {
              const prop = (Array.isArray(c.proprietario) ? c.proprietario[0] : c.proprietario) as Prop extends infer T ? T extends { nome: string } ? T : { nome: string } | null : never
              const propNome = (prop as { nome?: string } | null)?.nome ?? '—'
              const imovel = Array.isArray(c.imovel) ? c.imovel[0] : c.imovel
              const imovelNome = (imovel as { titulo?: string } | null)?.titulo ?? '—'
              const taxa = c.taxa_tipo === 'fixo' ? `R$ ${c.taxa_valor}` : `${c.taxa_valor}%`
              const corStatus = STATUS_COR[c.status] ?? 'bg-gray-100 text-gray-600'
              return (
                <Link
                  key={c.id}
                  href={`/painel/administracoes/${c.id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 sm:px-5 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between sm:contents">
                    <span className="text-xs font-mono text-gray-400 sm:w-28">{c.codigo}</span>
                    <span className={`text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full sm:order-last ${corStatus}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 truncate">
                      <User size={12} className="text-gray-400 shrink-0" />
                      {propNome}
                    </p>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1.5 truncate mt-0.5">
                      <Home size={11} className="text-gray-400 shrink-0" />
                      {imovelNome}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">{fmtData(c.data_inicio)} {c.data_termino ? `→ ${fmtData(c.data_termino)}` : '· indeterminado'}</p>
                    <p className="text-sm font-bold text-violet-700 mt-0.5">{taxa}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
