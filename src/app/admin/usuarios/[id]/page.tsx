import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, AlertOctagon } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLANOS } from '@/lib/constants'
import { FormPerfilAdmin } from './_components/form-perfil-admin'
import { AcoesAdmin } from './_components/acoes-admin'

const TIPO_LABEL: Record<string, string> = {
  proprietario: 'Proprietário', corretor: 'Corretor', imobiliaria: 'Imobiliária',
}

export default async function AdminUsuarioDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()

  // SELECT com as colunas do v10. Se a migration ainda não rodou, faz
  // fallback sem banido_em/banido_motivo para a página não quebrar.
  const BASE = `id, nome, tipo, plano, role, cpf, telefone,
    endereco_logradouro, endereco_numero, endereco_bairro,
    endereco_cidade, endereco_estado,
    crm_ativo, created_at`

  type PerfilDetalhe = {
    id: string; nome: string | null; tipo: string | null; plano: string | null
    role: string | null; cpf: string | null; telefone: string | null
    endereco_logradouro: string | null; endereco_numero: string | null
    endereco_bairro: string | null; endereco_cidade: string | null
    endereco_estado: string | null; crm_ativo: boolean | null
    created_at: string
    banido_em: string | null; banido_motivo: string | null
  }

  const tentar = await admin
    .from('perfis')
    .select(`${BASE}, banido_em, banido_motivo`)
    .eq('id', id)
    .maybeSingle()

  let perfil: PerfilDetalhe | null = tentar.data as PerfilDetalhe | null
  let v10Faltando = false
  if (!perfil && tentar.error?.message?.includes('banido_em')) {
    v10Faltando = true
    const fb = await admin.from('perfis').select(BASE).eq('id', id).maybeSingle()
    perfil = fb.data
      ? ({ ...fb.data, banido_em: null, banido_motivo: null } as PerfilDetalhe)
      : null
  }

  const [{ data: authData }, { count: imoveisCount }, { count: contratosCount }] = await Promise.all([
    admin.auth.admin.getUserById(id),
    admin.from('imoveis').select('id', { count: 'exact', head: true }).eq('user_id', id),
    admin.from('contratos_locacao').select('id', { count: 'exact', head: true })
      .eq('user_id', id).is('deleted_at', null),
  ])

  if (!perfil) notFound()

  const email = authData.user?.email ?? ''
  const ultimoLogin = authData.user?.last_sign_in_at ?? null
  const emailConfirmadoEm = authData.user?.email_confirmed_at ?? null
  const banido = !!perfil.banido_em

  const plano = (perfil.plano ?? 'free') as keyof typeof PLANOS
  const limiteImoveis = PLANOS[plano]?.imoveis ?? 1
  const ilimitado = limiteImoveis >= 999

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div>
        <Link href="/admin/usuarios" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Usuários
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              {perfil.nome ?? 'Sem nome'}
              {perfil.role === 'admin' && (
                <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">admin</span>
              )}
              {banido && (
                <span className="inline-flex items-center gap-1 text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-medium">
                  <AlertOctagon size={11} /> Banido
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500">{email}</p>
            <p className="text-xs text-gray-400">
              Cadastrado em {new Date(perfil.created_at).toLocaleDateString('pt-BR')}
              {ultimoLogin && ` · último login ${new Date(ultimoLogin).toLocaleDateString('pt-BR')}`}
              {!emailConfirmadoEm && ' · email não confirmado'}
            </p>
          </div>
        </div>
      </div>

      {banido && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-red-800 flex items-center gap-2">
            <AlertOctagon size={15} /> Conta suspensa em {new Date(perfil.banido_em!).toLocaleDateString('pt-BR')}
          </p>
          {perfil.banido_motivo && <p className="text-sm text-red-700 mt-1">Motivo: {perfil.banido_motivo}</p>}
        </div>
      )}

      {v10Faltando && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-amber-900 mb-1">⚠️ Migration pendente</p>
          <p className="text-xs text-amber-800 leading-relaxed">
            Banimento e motivo só funcionam após rodar <code className="bg-white px-1 rounded">supabase/migrations/crm_v10_admin_user_mgmt.sql</code> no Supabase SQL Editor. Sem isso, o botão "Banir" vai dar erro.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Imóveis" valor={imoveisCount ?? 0} sub={ilimitado ? 'plano ilimitado' : `cota ${limiteImoveis}`} />
        <Stat label="Contratos" valor={contratosCount ?? 0} sub={ilimitado ? 'plano ilimitado' : `cota ${limiteImoveis}`} />
        <Stat label="Plano" valor={PLANOS[plano]?.nome ?? plano} sub={`R$ ${PLANOS[plano]?.preco?.toFixed(2) ?? '—'}/mês`} />
        <Stat label="Tipo" valor={TIPO_LABEL[perfil.tipo ?? ''] ?? perfil.tipo ?? '—'} sub={perfil.crm_ativo ? 'CRM cortesia' : ''} />
      </div>

      {/* Formulário de edição */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Dados cadastrais</h2>
        <FormPerfilAdmin
          userId={id}
          nome={perfil.nome ?? ''}
          tipo={(perfil.tipo as 'proprietario' | 'corretor' | 'imobiliaria') ?? 'proprietario'}
          cpf={perfil.cpf ?? ''}
          telefone={perfil.telefone ?? ''}
          plano={plano}
        />
      </section>

      {/* Ações administrativas */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Ações administrativas</h2>
        <AcoesAdmin
          userId={id}
          email={email}
          banido={banido}
          motivoAtual={perfil.banido_motivo ?? ''}
          ehAdmin={perfil.role === 'admin'}
        />
      </section>
    </div>
  )
}

function Stat({ label, valor, sub }: { label: string; valor: number | string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-2xl font-extrabold text-gray-900 mt-1">{valor}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
