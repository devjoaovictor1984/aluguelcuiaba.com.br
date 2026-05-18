import Link from 'next/link'
import { AlertOctagon, ExternalLink } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { AlterarPlanoForm } from './_components/alterar-plano'

const PLANO_COR: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  basico: 'bg-blue-100 text-blue-700',
  profissional: 'bg-violet-100 text-violet-700',
}
const TIPO_LABEL: Record<string, string> = {
  proprietario: 'Proprietário', corretor: 'Corretor', imobiliaria: 'Imobiliária'
}

async function alterarPlano(userId: string, plano: string): Promise<{ erro?: string }> {
  'use server'
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('perfis').update({ plano }).eq('id', userId)
    if (error) return { erro: error.message }
    revalidatePath('/admin/usuarios')
    return {}
  } catch (e) {
    return { erro: String(e) }
  }
}

export default async function AdminUsuariosPage() {
  const supabase = createAdminClient()

  // Tenta com banido_em (v10). Se a migration ainda não rodou, faz fallback.
  type PerfilRow = {
    id: string; nome: string | null; tipo: string | null; plano: string | null
    role: string | null; banido_em: string | null; created_at: string
  }
  const tentar = await supabase
    .from('perfis')
    .select('id, nome, tipo, plano, role, banido_em, created_at')
    .order('created_at', { ascending: false })

  let perfis: PerfilRow[] | null = (tentar.data ?? null) as PerfilRow[] | null
  if (!perfis && tentar.error?.message?.includes('banido_em')) {
    const fb = await supabase
      .from('perfis')
      .select('id, nome, tipo, plano, role, created_at')
      .order('created_at', { ascending: false })
    perfis = (fb.data ?? []).map(p => ({ ...p, banido_em: null }) as PerfilRow)
  }

  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })

  const emailMap = new Map(users.map(u => [u.id, u.email ?? '']))

  const { data: counts } = await supabase
    .from('imoveis')
    .select('user_id')
    .in('user_id', (perfis ?? []).map(p => p.id))

  const countMap = new Map<string, number>()
  counts?.forEach(r => countMap.set(r.user_id, (countMap.get(r.user_id) ?? 0) + 1))

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
        <p className="text-sm text-gray-500">{perfis?.length ?? 0} cadastrados</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Desktop */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuário</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Imóveis</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Plano atual</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cadastro</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Alterar plano</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {perfis?.map(u => {
                const email = emailMap.get(u.id) ?? ''
                const initials = u.nome?.split(' ').slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join('') ?? '?'
                return (
                  <tr key={u.id} className={`hover:bg-gray-50/50 ${u.banido_em ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Link href={`/admin/usuarios/${u.id}`} className="font-medium text-gray-900 hover:text-violet-700 inline-flex items-center gap-1">
                              {u.nome ?? 'Sem nome'}
                              <ExternalLink size={11} className="text-gray-300" />
                            </Link>
                            {u.role === 'admin' && (
                              <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">admin</span>
                            )}
                            {u.banido_em && (
                              <span className="inline-flex items-center gap-1 text-xs bg-red-600 text-white px-1.5 py-0.5 rounded-full font-medium">
                                <AlertOctagon size={9} /> banido
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{TIPO_LABEL[u.tipo ?? ''] ?? u.tipo ?? '—'}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-700">{countMap.get(u.id) ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${PLANO_COR[u.plano ?? 'free'] ?? 'bg-gray-100 text-gray-600'}`}>
                        {u.plano ?? 'free'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <AlterarPlanoForm
                        userId={u.id}
                        planoAtual={u.plano ?? 'free'}
                        action={alterarPlano}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {(!perfis || perfis.length === 0) && (
            <p className="text-center text-gray-400 py-12">Nenhum usuário cadastrado.</p>
          )}
        </div>

        {/* Mobile */}
        <div className="lg:hidden divide-y divide-gray-100">
          {perfis?.map(u => {
            const email = emailMap.get(u.id) ?? ''
            const initials = u.nome?.split(' ').slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join('') ?? '?'
            return (
              <div key={u.id} className={`p-4 space-y-3 ${u.banido_em ? 'bg-red-50/40' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/admin/usuarios/${u.id}`} className="font-medium text-gray-900 text-sm truncate hover:text-violet-700 flex items-center gap-1">
                      {u.nome ?? 'Sem nome'}
                      {u.banido_em && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-medium">
                          <AlertOctagon size={9} /> banido
                        </span>
                      )}
                    </Link>
                    <p className="text-xs text-gray-400 truncate">{email}</p>
                    <p className="text-xs text-gray-400">{countMap.get(u.id) ?? 0} imóvel(is)</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${PLANO_COR[u.plano ?? 'free'] ?? ''}`}>
                    {u.plano ?? 'free'}
                  </span>
                </div>
                <AlterarPlanoForm
                  userId={u.id}
                  planoAtual={u.plano ?? 'free'}
                  action={alterarPlano}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
