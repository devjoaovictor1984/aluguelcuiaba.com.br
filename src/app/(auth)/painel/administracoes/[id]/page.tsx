import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Briefcase, User, Home, Calendar, Percent, FileDown, Eye, Pencil, ShieldCheck } from 'lucide-react'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { BotaoExcluirAdm } from './_components/botao-excluir-adm'
import { AditivosAdmSecao, type AditivoAdmRow } from './_components/aditivos-adm-secao'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import {
  GARANTIA_LABEL, MODO_INCENDIO_LABEL, podeContratarIncendio,
  type ModoSeguroIncendio,
} from '@/lib/seguros/preferencia-proprietario'

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

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export default async function DetalheAdmPage({ params }: { params: Promise<{ id: string }> }) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { id } = await params

  const { data: contrato } = await supabase
    .from('contratos_administracao')
    .select(`
      *,
      proprietario:pessoas!proprietario_id(id, nome, cpf_cnpj, telefone, email),
      imovel:imoveis(id, titulo, endereco_resumido, endereco_completo)
    `)
    .eq('id', id)
    .eq('user_id', acesso.userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!contrato) notFound()

  const { data: aditivos } = await supabase
    .from('contratos_administracao_aditivos')
    .select('id, numero, data_aditivo, tipo, titulo, objeto')
    .eq('contrato_id', id)
    .eq('user_id', acesso.userId)
    .order('numero', { ascending: true })

  const prop = unwrap(contrato.proprietario) as { nome: string; cpf_cnpj: string | null; telefone: string | null; email: string | null } | null
  const imovel = unwrap(contrato.imovel) as { titulo: string; endereco_resumido: string | null; endereco_completo: string | null } | null
  const cor = STATUS_COR[contrato.status] ?? 'bg-gray-100 text-gray-600'
  const taxa = contrato.taxa_tipo === 'fixo' ? `R$ ${contrato.taxa_valor}` : `${contrato.taxa_valor}%`

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <Breadcrumbs items={[
        { label: 'Contratos de administração', href: '/painel/administracoes' },
        { label: contrato.codigo },
      ]} />
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/painel/administracoes"
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 shrink-0"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Briefcase size={18} className="text-violet-600 shrink-0" />
              {contrato.codigo}
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cor}`}>
                {contrato.status}
              </span>
            </h1>
            <p className="text-xs text-gray-500 truncate">Contrato de Administração Imobiliária</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Link
            href={`/painel/administracoes/${id}/editar`}
            className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl border border-gray-200"
          >
            <Pencil size={14} /> Editar
          </Link>
          <Link
            href={`/painel/administracoes/${id}/gerar`}
            className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl"
          >
            <Briefcase size={14} /> Editor de cláusulas
          </Link>
          <a
            href={`/api/contratos-admin/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl"
          >
            <Eye size={14} /> PDF
          </a>
          <a
            href={`/api/contratos-admin/${id}/pdf`}
            download={`contrato-adm-${contrato.codigo}.pdf`}
            className="flex items-center gap-1.5 bg-white hover:bg-violet-50 text-violet-700 text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl border border-violet-200"
          >
            <FileDown size={14} />
          </a>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <User size={12} /> Proprietário
          </h2>
          {prop ? (
            <>
              <p className="text-sm font-semibold text-gray-900">{prop.nome}</p>
              {prop.cpf_cnpj && <p className="text-xs text-gray-500 font-mono">CPF {prop.cpf_cnpj}</p>}
              {prop.telefone && <p className="text-xs text-gray-500">{prop.telefone}</p>}
              {prop.email && <p className="text-xs text-gray-500">{prop.email}</p>}
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">não vinculado</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Home size={12} /> Imóvel administrado
          </h2>
          {imovel ? (
            <>
              <p className="text-sm font-semibold text-gray-900">{imovel.titulo}</p>
              <p className="text-xs text-gray-500">{imovel.endereco_completo ?? imovel.endereco_resumido ?? '—'}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">não vinculado</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Calendar size={12} /> Prazo
          </h2>
          <p className="text-sm">
            <span className="font-semibold">{fmtData(contrato.data_inicio)}</span>
            {contrato.data_termino ? (
              <> → <span className="font-semibold">{fmtData(contrato.data_termino)}</span></>
            ) : (
              <> · <span className="italic text-gray-500">indeterminado</span></>
            )}
          </p>
          {contrato.prazo_meses && (
            <p className="text-xs text-gray-500">{contrato.prazo_meses} meses</p>
          )}
          {contrato.renovacao_automatica && (
            <p className="text-xs text-violet-700">✓ Renovação automática</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Percent size={12} /> Taxa e repasse
          </h2>
          <p className="text-2xl font-bold text-violet-700">{taxa}</p>
          {contrato.dia_repasse && <p className="text-xs text-gray-500">Repasse no dia {contrato.dia_repasse}</p>}
          {contrato.primeira_parcela_cheia && (
            <p className="text-[11px] text-amber-700">1ª parcela 100% pra administradora</p>
          )}
        </div>
      </div>

      {/* Condições */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Condições</h2>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>· Exclusividade: <strong>{contrato.exclusividade ? 'Sim' : 'Não'}</strong></li>
          <li>· Aviso prévio: <strong>{contrato.aviso_previo_dias} dias</strong></li>
          <li>· Multa rescisória: <strong>{contrato.multa_rescisao_meses ?? '—'} meses de taxa</strong></li>
        </ul>
      </div>

      {/* Seguros — o que foi combinado com o proprietário */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-violet-600" /> Seguros
        </h2>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>
            · Incêndio:{' '}
            <strong>
              {MODO_INCENDIO_LABEL[
                (contrato.seguro_incendio_modo ?? 'a_definir') as ModoSeguroIncendio
              ] ?? '—'}
            </strong>
            {contrato.seguro_incendio_pagador && (
              <> · paga o <strong>{contrato.seguro_incendio_pagador}</strong></>
            )}
          </li>
          {contrato.seguro_incendio_apolice && (
            <li className="text-xs text-gray-500">
              &nbsp;&nbsp;apólice {contrato.seguro_incendio_apolice}
              {contrato.seguro_incendio_seguradora && <> · {contrato.seguro_incendio_seguradora}</>}
              {contrato.seguro_incendio_vencimento && (
                <> · vence {new Date(contrato.seguro_incendio_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</>
              )}
            </li>
          )}
          <li>
            · Garantias aceitas:{' '}
            <strong>
              {contrato.garantias_aceitas?.length
                ? contrato.garantias_aceitas
                    .map((g: string) => GARANTIA_LABEL[g as keyof typeof GARANTIA_LABEL] ?? g)
                    .join(', ')
                : 'sem restrição'}
            </strong>
          </li>
          <li>
            · Autoriza a administradora a contratar:{' '}
            <strong>{contrato.autoriza_cotacao_seguros ? 'Sim' : 'Não'}</strong>
          </li>
        </ul>
        {contrato.seguros_observacoes && (
          <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2 mt-1 whitespace-pre-wrap">
            {contrato.seguros_observacoes}
          </p>
        )}
        {podeContratarIncendio(contrato) && (
          <p className="text-[11px] text-green-800 bg-green-50 border border-green-100 rounded-lg px-2.5 py-2">
            Autorizado — a contratação de seguro por este imóvel fica liberada
            no sistema.
          </p>
        )}
      </div>

      {contrato.observacoes && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-amber-700 mb-1">Observações</p>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{contrato.observacoes}</p>
        </div>
      )}

      <AditivosAdmSecao contratoId={id} aditivos={(aditivos ?? []) as AditivoAdmRow[]} />

      <BotaoExcluirAdm contratoAdmId={id} codigo={contrato.codigo} />
    </div>
  )
}
