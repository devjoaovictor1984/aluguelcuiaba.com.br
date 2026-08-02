import Link from 'next/link'
import { ArrowLeft, Flame, AlertOctagon, FlaskConical } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { assinarUrlArquivo } from '@/lib/seguros/arquivos'
import type { ResultadoCalculo } from '@/lib/seguros/incendio/tipos'
import { DetalheIncendio } from './_components/detalhe-incendio'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ApoliceIncendioPage({ params }: Props) {
  const { id } = await params
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: a } = await supabase
    .from('seguro_incendio_apolices')
    .select(`
      id, seguradora, ambiente, tipo_seguro, tipo_vigencia, tipo_cobertura,
      status, valor_aluguel, premio_total, valor_iof, valor_assistencia,
      valor_parcela, qtd_parcelas, forma_pagto_descricao,
      inicio_vigencia, fim_vigencia, codigo_seguro, numero_proposta,
      calculo, inquilino, proprietario, endereco, erro,
      cancelamento_msg, contratada_em, cancelada_em, created_at,
      imovel:imoveis(titulo), contrato:contratos_locacao(codigo)
    `)
    .eq('id', id)
    .eq('user_id', acesso.userId)
    .maybeSingle()

  if (!a) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Link href="/painel/seguros/incendio" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600 mb-2">
          <ArrowLeft size={12} /> Seguro incêndio
        </Link>
        <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-6">
          <h1 className="text-lg font-bold text-amber-900 mb-2 flex items-center gap-2">
            <AlertOctagon size={18} /> Apólice não encontrada
          </h1>
          <p className="text-sm text-amber-900">Ela não existe ou pertence a outra conta.</p>
        </div>
      </div>
    )
  }

  const { data: docs } = await supabase
    .from('seguro_incendio_documentos')
    .select('id, tipo, num_parcela, data_vencimento, data_pagamento, storage_path')
    .eq('apolice_id', id)
    .order('tipo')

  const documentos = await Promise.all(
    (docs ?? []).map(async d => ({
      id: d.id,
      tipo: d.tipo as 'certificado' | 'proposta' | 'boleto',
      numParcela: d.num_parcela,
      dataVencimento: d.data_vencimento,
      dataPagamento: d.data_pagamento,
      url: await assinarUrlArquivo(admin, d.storage_path),
    })),
  )

  const um = <T,>(v: unknown): T | null =>
    (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) as T | null

  const inq = a.inquilino as { nome?: string } | null
  const end = a.endereco as { endereco?: string; numero?: string; bairro?: string } | null
  const imovel = um<{ titulo: string }>(a.imovel)
  const contrato = um<{ codigo: string }>(a.contrato)

  const local = [end?.endereco, end?.numero].filter(Boolean).join(', ')

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto pb-32">
      <div>
        <Link href="/painel/seguros/incendio" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600 mb-2">
          <ArrowLeft size={12} /> Seguro incêndio
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
          <Flame size={20} className="text-orange-500" />
          {inq?.nome ?? 'Cotação'}
          {a.ambiente === 2 && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 ring-1 ring-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <FlaskConical size={10} /> homologação
            </span>
          )}
        </h1>
        <p className="text-sm text-gray-500">
          {imovel?.titulo ?? local ?? '—'}
          {contrato?.codigo && <> · {contrato.codigo}</>}
        </p>
      </div>

      <DetalheIncendio
        apolice={{
          id: a.id,
          seguradora: a.seguradora,
          status: a.status,
          tipoSeguro: a.tipo_seguro,
          tipoVigencia: a.tipo_vigencia,
          tipoCobertura: a.tipo_cobertura,
          valorAluguel: a.valor_aluguel,
          premioTotal: a.premio_total,
          valorIof: a.valor_iof,
          valorAssistencia: a.valor_assistencia,
          valorParcela: a.valor_parcela,
          qtdParcelas: a.qtd_parcelas,
          formaPagtoDescricao: a.forma_pagto_descricao,
          inicioVigencia: a.inicio_vigencia,
          fimVigencia: a.fim_vigencia,
          codigoSeguro: a.codigo_seguro,
          numeroProposta: a.numero_proposta,
          calculo: a.calculo as ResultadoCalculo | null,
          erro: a.erro,
          cancelamentoMsg: a.cancelamento_msg,
          contratadaEm: a.contratada_em,
        }}
        documentos={documentos}
      />
    </div>
  )
}
