import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ClipboardCheck, Plus, CheckCircle2, Clock, FileSignature, AlertOctagon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { criarVistoria } from './actions'

interface Props {
  params: Promise<{ id: string }>
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  enviada: 'Aguardando inquilino',
  assinada: 'Assinada',
  recusada: 'Recusada',
}

const STATUS_COR: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-600',
  enviada: 'bg-amber-100 text-amber-700',
  assinada: 'bg-green-100 text-green-700',
  recusada: 'bg-red-100 text-red-700',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  rascunho: <FileSignature size={11} />,
  enviada: <Clock size={11} />,
  assinada: <CheckCircle2 size={11} />,
  recusada: <AlertOctagon size={11} />,
}

export default async function VistoriasPage({ params }: Props) {
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

  const { data: vistoriasRaw } = await supabase
    .from('vistorias')
    .select('id, tipo, status, data_vistoria, assinada_em, enviada_em, expira_em, created_at')
    .eq('contrato_id', id)
    .order('created_at', { ascending: false })

  const vistorias = vistoriasRaw ?? []
  const inquilino = Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino
  const imovel = Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel

  async function nova(tipo: 'entrada' | 'saida') {
    'use server'
    await criarVistoria(id, tipo)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-w-4xl mx-auto">
      <div>
        <Link href={`/painel/contratos/${id}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Contrato {contrato.codigo}
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardCheck size={20} className="text-violet-600" /> Vistorias
        </h1>
        <p className="text-sm text-gray-500">
          {inquilino?.nome ?? '—'} · {imovel?.titulo ?? '—'}
        </p>
      </div>

      {/* Ações */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 grid sm:grid-cols-2 gap-3">
        <form action={nova.bind(null, 'entrada')}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold py-3 rounded-xl"
          >
            <Plus size={14} /> Nova vistoria de entrada
          </button>
        </form>
        <form action={nova.bind(null, 'saida')}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-3 rounded-xl"
          >
            <Plus size={14} /> Nova vistoria de saída
          </button>
        </form>
      </div>

      {/* Lista */}
      {vistorias.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
          <ClipboardCheck size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-700 mb-1">Nenhuma vistoria ainda</p>
          <p className="text-xs text-gray-500">Crie a de entrada quando o inquilino assumir o imóvel, e a de saída no encerramento.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
          {vistorias.map(v => {
            const expirada = !!(v.expira_em && v.status === 'enviada' && new Date(v.expira_em).getTime() < Date.now())
            const statusEx = expirada ? 'expirada' : v.status
            return (
              <Link
                key={v.id}
                href={`/painel/contratos/${id}/vistorias/${v.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  v.tipo === 'entrada' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  <ClipboardCheck size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    Vistoria de {v.tipo === 'entrada' ? 'entrada' : 'saída'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {v.data_vistoria ? new Date(v.data_vistoria + 'T00:00:00').toLocaleDateString('pt-BR') : 'sem data'}
                    {v.assinada_em && <> · assinada {new Date(v.assinada_em).toLocaleDateString('pt-BR')}</>}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  statusEx === 'expirada' ? 'bg-red-100 text-red-700' : (STATUS_COR[v.status] ?? 'bg-gray-100')
                }`}>
                  {STATUS_ICON[v.status]} {statusEx === 'expirada' ? 'Link expirou' : (STATUS_LABEL[v.status] ?? v.status)}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
