import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, KeyRound, Plus, CheckCircle2, Clock, FileSignature, AlertOctagon, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { criarTermo } from './actions'

interface Props {
  params: Promise<{ id: string }>
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  enviada: 'Aguardando locatário',
  assinado_locatario: 'Aguardando administradora',
  assinado: 'Assinado pelas duas partes',
  recusada: 'Recusado',
}

const STATUS_COR: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-600',
  enviada: 'bg-amber-100 text-amber-700',
  assinado_locatario: 'bg-blue-100 text-blue-700',
  assinado: 'bg-green-100 text-green-700',
  recusada: 'bg-red-100 text-red-700',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  rascunho: <FileSignature size={11} />,
  enviada: <Clock size={11} />,
  assinado_locatario: <UserCheck size={11} />,
  assinado: <CheckCircle2 size={11} />,
  recusada: <AlertOctagon size={11} />,
}

export default async function TermosChavesPage({ params }: Props) {
  const { id } = await params
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: contrato } = await supabase
    .from('contratos_locacao')
    .select('id, codigo, inquilino:pessoas!inquilino_id(nome), imovel:imoveis(titulo)')
    .eq('id', id)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!contrato) notFound()

  const { data: termosRaw } = await supabase
    .from('termos_entrega_chaves')
    .select('id, status, data_entrega, assinado_locatario_em, assinado_locador_em, enviada_em, expira_em, created_at')
    .eq('contrato_id', id)
    .order('created_at', { ascending: false })

  const termos = termosRaw ?? []
  const inquilino = Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino
  const imovel = Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel

  async function novo() {
    'use server'
    await criarTermo(id)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-w-4xl mx-auto">
      <div>
        <Link href={`/painel/contratos/${id}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Contrato {contrato.codigo}
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <KeyRound size={20} className="text-violet-600" /> Termo de entrega de chaves
        </h1>
        <p className="text-sm text-gray-500">
          {inquilino?.nome ?? '—'} · {imovel?.titulo ?? '—'}
        </p>
      </div>

      {/* Ação */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <form action={novo}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold py-3 rounded-xl"
          >
            <Plus size={14} /> Novo termo de entrega
          </button>
        </form>
        <p className="text-[11px] text-gray-400 text-center mt-2">
          Se houver vistoria de saída, as quantidades de chaves e controles são puxadas dela.
        </p>
      </div>

      {/* Lista */}
      {termos.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
          <KeyRound size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-700 mb-1">Nenhum termo ainda</p>
          <p className="text-xs text-gray-500">Crie o termo quando o locatário for devolver as chaves no encerramento.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
          {termos.map(t => {
            const expirada = !!(t.expira_em && t.status === 'enviada' && new Date(t.expira_em).getTime() < Date.now())
            const statusEx = expirada ? 'expirada' : t.status
            return (
              <Link
                key={t.id}
                href={`/painel/contratos/${id}/termo-chaves/${t.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-violet-50 text-violet-700">
                  <KeyRound size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Termo de entrega de chaves</p>
                  <p className="text-xs text-gray-500">
                    {t.data_entrega ? new Date(t.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : 'sem data'}
                    {t.assinado_locador_em && <> · concluído {new Date(t.assinado_locador_em).toLocaleDateString('pt-BR')}</>}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  statusEx === 'expirada' ? 'bg-red-100 text-red-700' : (STATUS_COR[t.status] ?? 'bg-gray-100')
                }`}>
                  {STATUS_ICON[t.status]} {statusEx === 'expirada' ? 'Link expirou' : (STATUS_LABEL[t.status] ?? t.status)}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
