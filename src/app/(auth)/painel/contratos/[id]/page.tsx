import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Home, User, Shield, Calendar, DollarSign, Pencil, Repeat, XCircle, FileSignature, FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { ParcelaRow, type Parcela } from './_components/parcela-row'
import { AcoesContrato } from './_components/acoes-contrato'
import { MoradoresSecao, type MoradorRow, type PessoaOpcao } from './_components/moradores-secao'
import { ReajusteSecao, type ReajusteRow } from './_components/reajuste-secao'
import { RegerarParcelasBotao } from './_components/regerar-parcelas'
import { TimelineEventos, type EventoRow } from './_components/timeline-eventos'
import { DocsPartesContrato } from './_components/docs-partes'

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

  const [
    { data: parcelas },
    { data: moradoresRaw },
    { data: pessoasUser },
    { data: reajustesRaw },
    { data: eventosRaw },
  ] = await Promise.all([
    supabase
      .from('parcelas_aluguel')
      .select('*')
      .eq('contrato_id', id)
      .order('numero', { ascending: true }),
    supabase
      .from('contratos_moradores')
      .select(`
        id, papel, parentesco, mora_no_imovel, observacao,
        pessoa:pessoas(id, nome, cpf_cnpj, telefone)
      `)
      .eq('contrato_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('pessoas')
      .select('id, nome, tipo, cpf_cnpj')
      .eq('user_id', acesso.userId)
      .is('deleted_at', null)
      .order('nome', { ascending: true }),
    supabase
      .from('reajustes_historico')
      .select('id, data_efetiva, valor_antigo, valor_novo, percentual, indice_usado, parcelas_afetadas, observacao, created_at')
      .eq('contrato_id', id)
      .order('data_efetiva', { ascending: false }),
    supabase
      .from('eventos_contrato')
      .select('id, tipo, descricao, metadata, created_at')
      .eq('contrato_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const moradores: MoradorRow[] = (moradoresRaw ?? []).map((m: {
    id: string
    papel: string
    parentesco: string | null
    mora_no_imovel: boolean
    observacao: string | null
    pessoa: { id: string; nome: string; cpf_cnpj: string | null; telefone: string | null } | { id: string; nome: string; cpf_cnpj: string | null; telefone: string | null }[] | null
  }) => ({
    id: m.id,
    papel: (m.papel as MoradorRow['papel']) ?? 'morador',
    parentesco: m.parentesco as MoradorRow['parentesco'],
    mora_no_imovel: m.mora_no_imovel ?? true,
    observacao: m.observacao,
    pessoa: Array.isArray(m.pessoa) ? m.pessoa[0] ?? null : m.pessoa,
  }))

  const pessoasDisponiveis: PessoaOpcao[] = (pessoasUser ?? []) as PessoaOpcao[]
  const reajustes: ReajusteRow[] = ((reajustesRaw ?? []) as ReajusteRow[]).map(r => ({
    ...r,
    percentual: Number(r.percentual),
    valor_antigo: Number(r.valor_antigo),
    valor_novo: Number(r.valor_novo),
  }))
  const eventos: EventoRow[] = (eventosRaw ?? []) as EventoRow[]

  const lista = parcelas ?? []
  const pagas = lista.filter(p => p.status_pagamento === 'pago').length
  const atrasadas = lista.filter(p => {
    if (p.status_pagamento === 'pago') return false
    return new Date(p.vencimento) < new Date()
  }).length
  const parcelasFuturas = lista.filter(p => p.status_pagamento !== 'pago').length
  const proximaParcela = lista.find(p => p.status_pagamento !== 'pago')

  const imovel = Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel
  const inquilino = Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino
  const proprietario = Array.isArray(contrato.proprietario) ? contrato.proprietario[0] : contrato.proprietario
  const fiador = Array.isArray(contrato.fiador) ? contrato.fiador[0] : contrato.fiador
  const bairro = imovel && (Array.isArray(imovel.bairro) ? imovel.bairro[0] : imovel.bairro)

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div>
        <Link href="/painel/contratos" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Contratos
        </Link>
        <div className="flex items-center justify-between gap-3 flex-wrap">
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
          <div className="flex items-center gap-2 flex-wrap">
            <RegerarParcelasBotao
              contratoId={id}
              contratoCodigo={contrato.codigo}
              diaVencimentoAtual={contrato.dia_vencimento}
              dataPrimeiroAluguelAtual={contrato.data_primeiro_aluguel}
              valorAluguelAtual={Number(contrato.valor_aluguel)}
              valorSeguroAtual={Number(contrato.valor_seguro_fianca_mensal ?? 0)}
              iptuAtual={Number(contrato.iptu_mensal ?? 0)}
              condominioAtual={Number(contrato.condominio_mensal ?? 0)}
              taxaAdminTipo={contrato.taxa_admin_tipo}
              taxaAdminValor={Number(contrato.taxa_admin_valor)}
              primeiraParcelaCheiaAtual={contrato.primeira_parcela_cheia}
              duracaoMeses={contrato.duracao_meses}
              parcelas={lista.map(p => ({ numero: p.numero, status_pagamento: p.status_pagamento, mes_referencia: p.mes_referencia }))}
            />
            <AcoesContrato
              contratoId={id}
              contratoCodigo={contrato.codigo}
              dataTerminoAtual={contrato.data_termino}
              valorAluguelAtual={contrato.valor_aluguel}
              valorSeguroAtual={contrato.valor_seguro_fianca_mensal ?? 0}
              duracaoMesesAtual={contrato.duracao_meses}
              diaVencimentoAtual={contrato.dia_vencimento}
              jaEncerrado={['encerrado', 'rescindido'].includes(contrato.status)}
            />
            <Link
              href={`/painel/contratos/${id}/vistorias`}
              className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-800 border border-amber-200 hover:border-amber-400 hover:bg-amber-50 px-3 py-1.5 rounded-xl transition-colors"
            >
              <FileSignature size={13} /> Vistorias
            </Link>
            <Link
              href={`/painel/contratos/${id}/gerar`}
              className="flex items-center gap-1.5 text-sm text-white bg-violet-700 hover:bg-violet-800 px-3 py-1.5 rounded-xl transition-colors font-semibold"
            >
              <FileText size={13} /> Gerar contrato
            </Link>
            <Link
              href={`/painel/contratos/${id}/editar`}
              className="flex items-center gap-1.5 text-sm text-violet-700 hover:text-violet-800 border border-violet-200 hover:border-violet-400 hover:bg-violet-50 px-3 py-1.5 rounded-xl transition-colors"
            >
              <Pencil size={13} /> Editar
            </Link>
          </div>
        </div>
      </div>

      {contrato.contrato_anterior_id && (
        <div className="bg-violet-50 border border-violet-100 text-violet-900 text-sm rounded-xl px-4 py-2.5 flex items-center gap-2">
          <Repeat size={14} className="text-violet-600" />
          <span>Este contrato é uma renovação. <Link href={`/painel/contratos/${contrato.contrato_anterior_id}`} className="font-semibold underline hover:no-underline">Ver contrato anterior</Link></span>
        </div>
      )}

      {contrato.motivo_encerramento && (
        <div className="bg-red-50 border border-red-100 text-red-900 text-sm rounded-xl px-4 py-2.5 flex items-center gap-2">
          <XCircle size={14} className="text-red-600" />
          <span>
            Encerrado em {fmtData(contrato.data_encerramento)} — motivo: <span className="font-semibold capitalize">{String(contrato.motivo_encerramento).replace(/_/g, ' ')}</span>
          </span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Home size={11} /> IMÓVEL</p>
          <p className="font-semibold text-gray-900">{imovel?.titulo ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1">{bairro?.nome ?? ''} {imovel?.endereco_resumido && `· ${imovel.endereco_resumido}`}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
            <User size={11} /> INQUILINO {contrato.inquilino_mora_no_imovel === false && <span className="text-amber-700 font-semibold">(não mora)</span>}
          </p>
          <p className="font-semibold text-gray-900">{inquilino?.nome ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1">{inquilino?.cpf_cnpj ?? ''} {inquilino?.telefone && `· ${inquilino.telefone}`}</p>
          {contrato.inquilino_mora_no_imovel === false && (
            <p className="text-[11px] text-amber-700 mt-1.5 italic">Assina o contrato, mas quem mora é alguém vinculado abaixo.</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><User size={11} /> PROPRIETÁRIO</p>
          <p className="font-semibold text-gray-900">{proprietario?.nome ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1">
            {proprietario?.pix_chave ? `PIX: ${proprietario.pix_chave}` : 'Sem PIX cadastrado'}
          </p>
        </div>
      </div>

      <DocsPartesContrato
        userId={acesso.userId}
        partes={[
          inquilino && { id: inquilino.id, nome: inquilino.nome, papel: 'inquilino' as const },
          proprietario && { id: proprietario.id, nome: proprietario.nome, papel: 'proprietario' as const },
          fiador && { id: fiador.id, nome: fiador.nome, papel: 'fiador' as const },
        ].filter((p): p is { id: string; nome: string; papel: 'inquilino' | 'proprietario' | 'fiador' } => !!p)}
      />

      <ReajusteSecao
        contratoId={id}
        contratoCodigo={contrato.codigo}
        valorAluguelAtual={contrato.valor_aluguel}
        dataProximoReajuste={contrato.data_proximo_reajuste}
        jaEncerrado={['encerrado', 'rescindido'].includes(contrato.status)}
        parcelasFuturas={parcelasFuturas}
        proximaParcelaMesRef={proximaParcela?.mes_referencia ?? null}
        reajustes={reajustes}
      />

      <MoradoresSecao
        contratoId={id}
        moradores={moradores}
        pessoasDisponiveis={pessoasDisponiveis}
        inquilinoId={inquilino?.id ?? ''}
        inquilinoEhPJ={(inquilino?.cpf_cnpj?.replace(/\D/g, '').length ?? 0) === 14}
      />

      <TimelineEventos eventos={eventos} />

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
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Parcelas ({lista.length})</h2>
          <p className="text-[11px] text-gray-400">Clique nos ícones para marcar/desmarcar</p>
        </div>
        <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="text-left text-xs font-semibold text-gray-500">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2 text-right">Boleto</th>
                <th className="px-3 py-2 text-right">Comissão</th>
                <th className="px-3 py-2 text-right">Repasse</th>
                <th className="px-2 py-2 text-center" title="Pagamento">Pgto</th>
                <th className="px-2 py-2 text-center" title="Repasse ao proprietário">Repasse</th>
                <th className="px-2 py-2 text-center" title="Seguro fiança">Seg.</th>
                <th className="px-2 py-2 text-center" title="Boleto enviado">Bol.</th>
                <th className="px-2 py-2 text-center" title="Recibo em PDF">Rec.</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(p => (
                <ParcelaRow key={p.id} parcela={p as unknown as Parcela} />
              ))}
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
