import Link from 'next/link'
import { ArrowLeft, ShieldCheck, AlertOctagon, FlaskConical } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoSeguros } from '@/lib/seguros/acesso'
import { assinarUrlArquivo } from '@/lib/seguros/arquivos'
import { formatarBRL } from '@/lib/formatters'
import { DetalheAnalise } from './_components/detalhe-analise'
import { HistoricoIntegracao } from './_components/historico-integracao'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AnalisePage({ params }: Props) {
  const { id } = await params
  const acesso = await exigirAcessoSeguros()
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: analise } = await supabase
    .from('seguro_analises')
    .select(`
      id, maximiza_id, status_resumo, ambiente, tipo_analise, finalidade,
      valor_aluguel, created_at, erro, contrato_id,
      inquilino:pessoas!inquilino_id(nome, cpf_cnpj),
      imovel:imoveis(titulo),
      contrato:contratos_locacao(codigo)
    `)
    .eq('id', id)
    .eq('user_id', acesso.userId)
    .maybeSingle()

  if (!analise) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Link href="/painel/seguros/fianca" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Seguro fiança
        </Link>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h1 className="text-lg font-bold text-amber-900 mb-2 flex items-center gap-2">
            <AlertOctagon size={18} /> Cotação não encontrada
          </h1>
          <p className="text-sm text-amber-900">Ela não existe ou pertence a outra conta.</p>
        </div>
      </div>
    )
  }

  const [{ data: pareceres }, { data: arquivos }, { data: contratacao }] = await Promise.all([
    supabase
      .from('seguro_analise_pareceres')
      .select('*')
      .eq('analise_id', id)
      .order('codigo_status', { ascending: true }),
    supabase
      .from('seguro_arquivos')
      .select('id, seguradora_sigla, codigo_tipo, descricao, storage_path, recebido_em')
      .eq('analise_id', id)
      .order('codigo_tipo', { ascending: true }),
    supabase
      .from('seguro_contratacoes')
      .select('id, seguradora_sigla, tipo_plano, forma_pagto, qtd_parcelas, valor_parcela, premio_total, inicio_vigencia, fim_vigencia, status, apolice_numero, proposta_numero, erro, created_at')
      .eq('analise_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // A conversa com a corretora. Vem pelo admin porque `seguro_eventos` é
  // trilha de auditoria e não é exposta por RLS ao usuário — a posse já foi
  // conferida na consulta da análise acima.
  const { data: eventos } = await admin
    .from('seguro_eventos')
    .select('id, created_at, endpoint, direcao, http_status, duracao_ms, erro, request, response')
    .eq('analise_id', id)
    .order('created_at', { ascending: false })
    .limit(40)

  // Bucket privado: assina na hora de exibir, como as selfies (v53).
  const arquivosComUrl = await Promise.all(
    (arquivos ?? []).map(async a => ({
      id: a.id,
      seguradoraSigla: a.seguradora_sigla,
      codigoTipo: a.codigo_tipo,
      descricao: a.descricao,
      recebidoEm: a.recebido_em,
      url: await assinarUrlArquivo(admin, a.storage_path),
    })),
  )

  // O join do PostgREST tipa como array; achatamos igual ao resto do CRM.
  const um = <T,>(v: unknown): T | null =>
    (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) as T | null

  const inq = um<{ nome: string; cpf_cnpj: string | null }>(analise.inquilino)
  const imovel = um<{ titulo: string }>(analise.imovel)
  const contrato = um<{ codigo: string }>(analise.contrato)

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto pb-32">
      <div>
        <Link href="/painel/seguros/fianca" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Seguro fiança
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck size={20} className="text-violet-600" />
          {inq?.nome ?? 'Cotação'}
          {analise.ambiente === 2 && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <FlaskConical size={10} /> homologação
            </span>
          )}
        </h1>
        <p className="text-sm text-gray-500">
          {imovel?.titulo ?? '—'}
          {contrato?.codigo && <> · Contrato {contrato.codigo}</>}
          {analise.valor_aluguel != null && <> · {formatarBRL(analise.valor_aluguel)}</>}
          {analise.maximiza_id && <> · nº {analise.maximiza_id}</>}
        </p>
      </div>

      <DetalheAnalise
        analiseId={id}
        contratoId={analise.contrato_id}
        transmitida={!!analise.maximiza_id}
        erro={analise.erro}
        pareceres={(pareceres ?? []).map(p => ({
          id: p.id,
          analiseId: id,
          seguradoraSigla: p.seguradora_sigla,
          seguradoraNome: p.seguradora_nome,
          codigoStatus: p.codigo_status,
          descricaoStatus: p.descricao_status,
          codigoAnalise: p.codigo_analise,
          limiteAprovado: p.limite_aprovado,
          statusBiometria: p.status_biometria,
          linkBiometria: p.link_biometria,
          msg: p.msg,
          atualizadoEm: p.atualizado_em,
          precos: p.precos,
          precosEm: p.precos_em,
          precosErro: p.precos_erro,
        }))}
        arquivos={arquivosComUrl}
        contratacao={contratacao ? {
          id: contratacao.id,
          seguradoraSigla: contratacao.seguradora_sigla,
          tipoPlano: contratacao.tipo_plano,
          formaPagto: contratacao.forma_pagto,
          qtdParcelas: contratacao.qtd_parcelas,
          valorParcela: contratacao.valor_parcela,
          premioTotal: contratacao.premio_total,
          inicioVigencia: contratacao.inicio_vigencia,
          fimVigencia: contratacao.fim_vigencia,
          status: contratacao.status,
          apoliceNumero: contratacao.apolice_numero,
          propostaNumero: contratacao.proposta_numero,
          erro: contratacao.erro,
        } : null}
      />

      <HistoricoIntegracao
        eventos={(eventos ?? []).map(e => ({
          id: e.id,
          criadoEm: e.created_at,
          endpoint: e.endpoint,
          direcao: e.direcao,
          httpStatus: e.http_status,
          duracaoMs: e.duracao_ms,
          erro: e.erro,
          request: e.request,
          response: e.response,
        }))}
      />
    </div>
  )
}
