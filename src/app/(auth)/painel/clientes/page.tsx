import Link from 'next/link'
import { Users, Plus, Phone, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

const TIPO_COR: Record<string, string> = {
  inquilino:    'bg-blue-100 text-blue-700',
  proprietario: 'bg-green-100 text-green-700',
  fiador:       'bg-orange-100 text-orange-700',
  testemunha:   'bg-gray-100 text-gray-700',
  outro:        'bg-gray-100 text-gray-700',
}

const TIPO_LABEL: Record<string, string> = {
  inquilino: 'Inquilino', proprietario: 'Proprietário', fiador: 'Fiador',
  testemunha: 'Testemunha', outro: 'Outro',
}

interface Props {
  searchParams: Promise<{ tipo?: string; q?: string }>
}

export default async function ClientesPage({ searchParams }: Props) {
  const acesso = await exigirAcessoCRM()
  const { tipo, q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('pessoas')
    .select('id, tipo, nome, cpf_cnpj, telefone, whatsapp, email')
    .eq('user_id', acesso.userId)
    .is('deleted_at', null)
    .order('nome', { ascending: true })

  if (tipo) query = query.eq('tipo', tipo)
  if (q) {
    const termo = `%${q.replace(/[%_]/g, '')}%`
    query = query.or(`nome.ilike.${termo},cpf_cnpj.ilike.${termo},email.ilike.${termo}`)
  }

  const { data: pessoas } = await query.limit(200)
  const lista = pessoas ?? []

  // Contagens por tipo (independente do filtro de pesquisa)
  const { data: todasParaContagem } = await supabase
    .from('pessoas')
    .select('tipo')
    .eq('user_id', acesso.userId)
    .is('deleted_at', null)

  const contagem: Record<string, number> = {}
  todasParaContagem?.forEach(r => { contagem[r.tipo] = (contagem[r.tipo] ?? 0) + 1 })
  const total = todasParaContagem?.length ?? 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={20} className="text-violet-600" /> Clientes
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} pessoa{total === 1 ? '' : 's'} cadastrada{total === 1 ? '' : 's'}
          </p>
        </div>
        <Link href="/painel/clientes/novo" className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={15} /> Nova pessoa
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-2">
        <form action="/painel/clientes" className="flex-1 min-w-[200px]">
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Buscar por nome, CPF ou e-mail..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
          />
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
        </form>
        <div className="flex gap-1 flex-wrap">
          <Link href="/painel/clientes" className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${!tipo ? 'bg-violet-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Todos ({total})
          </Link>
          {(['inquilino','proprietario','fiador','testemunha','outro'] as const).map(t => (
            <Link key={t} href={`/painel/clientes?tipo=${t}`}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${tipo === t ? 'bg-violet-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {TIPO_LABEL[t]} ({contagem[t] ?? 0})
            </Link>
          ))}
        </div>
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Users size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-700 mb-1">Nenhuma pessoa cadastrada</p>
          <p className="text-xs text-gray-500">Comece cadastrando proprietários, inquilinos e fiadores.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {lista.map(p => (
              <Link key={p.id} href={`/painel/clientes/${p.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0">
                  {p.nome.split(' ').slice(0, 2).map((n: string) => n[0]?.toUpperCase()).join('') || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.nome}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {p.cpf_cnpj && <span>{p.cpf_cnpj}</span>}
                    {p.telefone && <span className="flex items-center gap-1"><Phone size={9} /> {p.telefone}</span>}
                    {p.email && <span className="flex items-center gap-1"><Mail size={9} /> {p.email}</span>}
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TIPO_COR[p.tipo]}`}>
                  {TIPO_LABEL[p.tipo]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
