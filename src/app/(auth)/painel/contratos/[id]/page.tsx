import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Home, User, Shield, Calendar, DollarSign,
  CheckCircle2, Clock, AlertTriangle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

const STATUS_COR: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  encerrado: 'bg-gray-100 text-gray-600',
  rescindido: 'bg-red-100 text-red-600',
  inadimplente: 'bg-orange-100 text-orange-700',
  rascunho: 'bg-gray-100 text-gray-500',
}

const GARANTIA_LABEL: Record<string, string> = {
  fiador: 'Fiador',
  caucao: 'Caução',
  seguro_fianca: 'Seguro fiança',
  sem_garantia: 'Sem garantia',
}

function fmtBRL(v: number | null): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtData(d: string | null): string {
  if (!d) return '—'
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR')
}

export default async function ContratoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const acesso = await exigirAcessoCRM()
  const { id } = await params
  const supabase = await createClient()

  const { data: contrato } = await supabase
    .from('contratos_locacao')
    .select(`
      *,
      imovel:imoveis(id, titulo, endereco_resumido, bairro:bairros(nome)),
      inquilino:pessoas!inquilino_id(id, nome, cpf_cnpj, telefone, whatsapp, email),
      proprietario:pessoas!proprietario_id(id, nome, cpf_cnpj, telefone, pix_tipo, pix_chave),
      fiador:pessoas!fiador_id(id, nome, cpf_cnpj, telefone)
    `)
    .eq('id', id)
    .eq('user_id', acesso.userId)
    .single()

  if (!contrato) notFound()

  const { data: parcelas } = await supabase
    .from('parcelas_aluguel')
    .select('*')
    .eq('contrato_id', id)
    .order('numero', { ascending: true })

  const lista = parcelas ?? []
  const pagas = lista.filter(p => p.status_pagamento === 'pago').length
  const atrasadas = lista.filter(p => {
    if (p.status_pagamento === 'pago') return false
    return new Date(p.vencimento) < new Date()
  }).length

  const imovel = Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel
  const inquilino = Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino
  const proprietario = Array.isArray(contrato.proprietario) ? contrato.proprietario[0] : contrato.proprietario
  const fiador = Array.isArray(contrato.fiador) ? contrato.fiador[0] : contrato.fiador
  const bairro = imovel && (Array.isArray(imovel.bairro) ? imovel.bairro[0] : imovel.bairro)

  return (
    <div className="p-6 space-y-5">
      <div>
        <Link href="/painel/contratos" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Contratos
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900 font-mono">{contrato.codigo}</h1>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COR[contrato.status]}`}>
            {contrato.status}
          </span>
          <span className="text-xs text-gray-400">
            {pagas}/{lista.length} parcelas pagas
            {atrasadas > 0 && <span className="text-red-600 font-semibold ml-2">· {atrasadas} atrasada{atrasadas === 1 ? '' : 's'}</span>}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Home size={11} /> IMÓVEL</p>
          <p className="font-semibold text-gray-900">{imovel?.titulo ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1">{bairro?.nome ?? ''} {imovel?.endereco_resumido && `· ${imovel.endereco_resumido}`}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><User size={11} /> INQUILINO</p>
          <p className="font-semibold text-gray-900">{inquilino?.nome ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1">{inquilino?.cpf_cnpj ?? ''} {inquilino?.telefone && `· ${inquilino.telefone}`}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><User size={11} /> PROPRIETÁRIO</p>
          <p className="font-semibold text-gray-900">{proprietario?.nome ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1">
            {proprietario?.pix_chave ? `PIX: ${proprietario.pix_chave}` : 'Sem PIX cadastrado'}
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 flex items-center gap-1 mb-1"><DollarSign size={11} /> ALUGUEL</p>
          <p className="text-lg font-bold text-gray-900">{fmtBRL(contrato.valor_aluguel)}</p>
          <p className="text-xs text-gray-400">+ seguro {fmtBRL(contrato.valor_seguro_fianca_mensal)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 flex items-center gap-1 mb-1"><Shield size={11} /> GARANTIA</p>
          <p className="text-sm font-semibold text-gray-900">{GARANTIA_LABEL[contrato.garantia_tipo]}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {contrato.garantia_tipo === 'fiador' && (fiador?.nome ?? '—')}
            {contrato.garantia_tipo === 'caucao' && fmtBRL(contrato.caucao_valor)}
            {contrato.garantia_tipo === 'seguro_fianca' && contrato.seguro_fianca_seguradora}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 flex items-center gap-1 mb-1"><Calendar size={11} /> PERÍODO</p>
          <p className="text-sm font-semibold text-gray-900">{contrato.duracao_meses} meses</p>
          <p className="text-xs text-gray-400 mt-0.5">{fmtData(contrato.data_inicio)} → {fmtData(contrato.data_termino)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 flex items-center gap-1 mb-1"><Calendar size={11} /> VENCIMENTO</p>
          <p className="text-sm font-semibold text-gray-900">Dia {contrato.dia_vencimento}</p>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">{contrato.forma_pagamento}</p>
        </div>
      </div>

      {/* Parcelas */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Parcelas ({lista.length})</h2>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left text-xs font-semibold text-gray-500">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Vencimento</th>
                <th className="px-4 py-2 text-right">Boleto</th>
                <th className="px-4 py-2 text-right">Comissão</th>
                <th className="px-4 py-2 text-right">Repasse</th>
                <th className="px-4 py-2 text-center">Pgto</th>
                <th className="px-4 py-2 text-center">Repasse</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(p => {
                const atrasada = p.status_pagamento !== 'pago' && new Date(p.vencimento) < new Date()
                return (
                  <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">{p.numero}</td>
                    <td className={`px-4 py-2 ${atrasada ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                      {fmtData(p.vencimento)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{fmtBRL(p.valor_total)}</td>
                    <td className="px-4 py-2 text-right text-violet-700">{fmtBRL(p.valor_comissao)}</td>
                    <td className="px-4 py-2 text-right text-green-700">{fmtBRL(p.valor_repasse_proprietario)}</td>
                    <td className="px-4 py-2 text-center">
                      {p.status_pagamento === 'pago' ? (
                        <CheckCircle2 size={14} className="text-green-600 inline" />
                      ) : atrasada ? (
                        <AlertTriangle size={14} className="text-red-500 inline" />
                      ) : (
                        <Clock size={14} className="text-gray-300 inline" />
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {p.status_repasse === 'pago'
                        ? <CheckCircle2 size={14} className="text-green-600 inline" />
                        : <Clock size={14} className="text-gray-300 inline" />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {contrato.observacoes && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-amber-700 mb-1">Observações</p>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{contrato.observacoes}</p>
        </div>
      )}
    </div>
  )
}
