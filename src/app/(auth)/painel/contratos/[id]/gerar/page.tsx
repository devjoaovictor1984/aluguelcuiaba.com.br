import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { obterOuCriarGeracao } from './actions'
import { EditorContrato } from './_components/editor-contrato'
import type { TipoClausula } from '@/lib/contratos/placeholders'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GerarContratoPage({ params }: Props) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { id: contratoId } = await params

  // Confirma posse
  const { data: contrato } = await supabase
    .from('contratos_locacao')
    .select(`
      id, codigo, garantia_tipo, valor_aluguel, data_inicio, data_termino,
      imovel_id,
      inquilino:pessoas!inquilino_id(id, nome),
      proprietario:pessoas!proprietario_id(id, nome),
      imovel:imoveis(
        id, titulo,
        endereco_completo, endereco_numero, endereco_cep,
        matricula_cartorio, inscricao_municipal,
        uc_energia, matricula_agua
      )
    `)
    .eq('id', contratoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()

  if (!contrato) redirect('/painel/contratos')

  // Obtém ou cria geração
  const r = await obterOuCriarGeracao(contratoId)
  if (r.error || !r.geracao) {
    return (
      <main className="p-6">
        <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertCircle className="mx-auto text-red-600 mb-2" />
          <h2 className="font-bold text-red-900 mb-1">Não foi possível abrir o gerador</h2>
          <p className="text-sm text-red-800">{r.error}</p>
          <Link href={`/painel/contratos/${contratoId}`} className="inline-block mt-4 text-sm text-violet-700 hover:underline">
            Voltar ao contrato
          </Link>
        </div>
      </main>
    )
  }

  // Carrega TODAS as cláusulas do user (pra mostrar opções de adicionar/incluir)
  const { data: todasClausulas } = await supabase
    .from('contrato_clausulas')
    .select('id, tipo, categoria, titulo, numero, corpo')
    .eq('user_id', acesso.userId)
    .eq('ativa', true)
    .order('tipo', { ascending: true })
    .order('numero', { ascending: true })

  // Carrega pessoas elegíveis pra testemunha (qualquer pessoa cadastrada)
  const { data: pessoasTestemunha } = await supabase
    .from('pessoas')
    .select('id, nome, cpf_cnpj, tipo')
    .eq('user_id', acesso.userId)
    .order('nome', { ascending: true })

  // IDs das partes do contrato (locador, locatário, fiador) — pra filtrar docs
  const partesIds = [
    contrato.proprietario?.[0]?.id ?? (contrato.proprietario as { id?: string } | null)?.id,
    contrato.inquilino?.[0]?.id ?? (contrato.inquilino as { id?: string } | null)?.id,
  ].filter((x): x is string => !!x)

  // Carrega documentos das partes (pra escolher anexos)
  const { data: documentosPartes } = partesIds.length > 0
    ? await supabase
        .from('pessoas_documentos')
        .select('id, pessoa_id, tipo, arquivo_path, nome_original, pessoa:pessoas!pessoa_id(nome)')
        .in('pessoa_id', partesIds)
        .eq('user_id', acesso.userId)
        .order('created_at', { ascending: false })
    : { data: [] }

  const inq = Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino
  const prop = Array.isArray(contrato.proprietario) ? contrato.proprietario[0] : contrato.proprietario
  const im = Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel

  // Detecta dados do imóvel faltando pra contrato robusto
  const dadosImovelFaltando: string[] = []
  if (!im?.endereco_completo) dadosImovelFaltando.push('endereço completo')
  if (!im?.matricula_cartorio) dadosImovelFaltando.push('matrícula do cartório')
  if (!im?.inscricao_municipal) dadosImovelFaltando.push('inscrição municipal')
  if (!im?.uc_energia) dadosImovelFaltando.push('UC energia')
  if (!im?.matricula_agua) dadosImovelFaltando.push('matrícula água')

  return (
    <main className="px-4 py-4 pb-20 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link
          href={`/painel/contratos/${contratoId}`}
          className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
        >
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Gerar contrato</h1>
          <p className="text-xs text-gray-500">
            {contrato.codigo} · {prop?.nome ?? '—'} → {inq?.nome ?? '—'}
          </p>
        </div>
      </div>

      {dadosImovelFaltando.length > 0 && contrato.imovel_id && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center shrink-0 text-amber-900 font-bold">!</div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-amber-900 mb-1">
              Faltam dados do imóvel pro contrato
            </h2>
            <p className="text-xs text-amber-800 mb-2">
              {dadosImovelFaltando.join(', ')}. Sem isso, os placeholders correspondentes vão sair
              como <code className="bg-amber-100 px-1 rounded">[PREENCHER]</code> no PDF.
            </p>
            <Link
              href={`/painel/anuncios/${contrato.imovel_id}/editar`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:text-amber-700 underline"
            >
              Preencher agora →
            </Link>
          </div>
        </div>
      )}

      <EditorContrato
        contratoId={contratoId}
        codigo={contrato.codigo}
        garantiaTipo={contrato.garantia_tipo}
        geracao={{
          id: r.geracao.id,
          tipo_seguro_incendio: r.geracao.tipo_seguro_incendio,
          saida_sem_multa_12m: r.geracao.saida_sem_multa_12m,
          clausula_ids: r.geracao.clausula_ids as string[],
          testemunha_ids: (r.geracao.testemunha_ids as string[] | null) ?? [],
          clausulas_seguradora_texto: r.geracao.clausulas_seguradora_texto ?? '',
          aluguel_inclui_iptu: r.geracao.aluguel_inclui_iptu ?? false,
          aluguel_inclui_condominio: r.geracao.aluguel_inclui_condominio ?? false,
          pdf_assinado_url: r.geracao.pdf_assinado_url ?? null,
          assinado_em: r.geracao.assinado_em ?? null,
          status: r.geracao.status ?? 'rascunho',
          anexo_documento_ids: (r.geracao.anexo_documento_ids as string[] | null) ?? [],
        }}
        todasClausulas={(todasClausulas ?? []).map(c => ({
          ...c,
          tipo: c.tipo as TipoClausula,
        }))}
        pessoas={(pessoasTestemunha ?? []) as Array<{ id: string; nome: string; cpf_cnpj: string | null; tipo: string }>}
        documentosPartes={
          ((documentosPartes ?? []) as Array<{
            id: string
            tipo: string
            nome_original: string
            pessoa: { nome: string } | { nome: string }[] | null
          }>).map(d => ({
            id: d.id,
            tipo: d.tipo,
            nome_original: d.nome_original,
            pessoa_nome: Array.isArray(d.pessoa) ? d.pessoa[0]?.nome ?? '—' : d.pessoa?.nome ?? '—',
          }))
        }
      />
    </main>
  )
}
