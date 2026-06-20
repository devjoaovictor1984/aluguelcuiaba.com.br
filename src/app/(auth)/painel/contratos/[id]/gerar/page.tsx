import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { obterOuCriarGeracao } from './actions'
import { EditorContrato } from './_components/editor-contrato'
import { PainelRevisao } from '../../_components/painel-revisao'
import { PainelAssinatura } from '../../_components/painel-assinatura'
import type { TipoClausula } from '@/lib/contratos/placeholders'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function PainelErroDebug({ titulo, mensagem, stack, contratoId }: {
  titulo: string
  mensagem: string
  stack?: string | null
  contratoId: string
}) {
  return (
    <main className="p-6">
      <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-3">
          <AlertCircle className="text-red-600 shrink-0" />
          <div>
            <h2 className="font-bold text-red-900">{titulo}</h2>
            <p className="text-sm text-red-800 mt-1">{mensagem}</p>
          </div>
        </div>
        {stack && (
          <details className="mt-4">
            <summary className="text-xs font-semibold text-red-700 cursor-pointer">
              Stack trace (clique pra expandir)
            </summary>
            <pre className="text-[10px] mt-2 bg-white p-3 rounded border border-red-200 overflow-auto max-h-96 whitespace-pre-wrap">
              {stack}
            </pre>
          </details>
        )}
        <Link href={`/painel/contratos/${contratoId}`} className="inline-block mt-4 text-sm text-violet-700 hover:underline">
          Voltar ao contrato
        </Link>
      </div>
    </main>
  )
}

export default async function GerarContratoPage({ params }: Props) {
  const { id: contratoId } = await params
  try {
    return await renderizarEditor(contratoId)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : null
    console.error('[gerar/page] erro:', msg, stack)
    return (
      <PainelErroDebug
        contratoId={contratoId}
        titulo="Erro ao abrir o gerador de contrato"
        mensagem={msg}
        stack={stack}
      />
    )
  }
}

async function renderizarEditor(contratoId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  // Confirma posse
  const { data: contrato, error: contratoErr } = await supabase
    .from('contratos_locacao')
    .select(`
      id, codigo, garantia_tipo, valor_aluguel, data_inicio, data_termino,
      qtd_chaves, qtd_controles, qtd_tags, conjuge_inquilino_papel, anotacoes_corretor,
      imovel_id,
      inquilino:pessoas!inquilino_id(id, nome, conjuge_nome, email),
      proprietario:pessoas!proprietario_id(id, nome, email),
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

  if (contratoErr) throw new Error(`Query contratos_locacao: ${contratoErr.message}`)
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

  // IDs das partes do contrato (locador, locatário, fiador, co-locatários, moradores adicionais)
  const propTmp = unwrap(contrato.proprietario)
  const inqTmp = unwrap(contrato.inquilino)

  // Busca fiador_id + pessoa_id dos co-locatários solidários e moradores adicionais
  const [{ data: contratoExtra }, { data: moradores }] = await Promise.all([
    supabase
      .from('contratos_locacao')
      .select('fiador_id')
      .eq('id', contratoId)
      .eq('user_id', acesso.userId)
      .maybeSingle(),
    supabase
      .from('contratos_moradores')
      .select('pessoa_id')
      .eq('contrato_id', contratoId),
  ])

  const partesIds = [
    propTmp?.id,
    inqTmp?.id,
    contratoExtra?.fiador_id,
    ...((moradores ?? []).map(m => m.pessoa_id)),
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

  const inq = inqTmp
  const prop = propTmp
  const im = unwrap(contrato.imovel)

  // Links de revisão + considerações recebidas (chave = id da geração)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const { data: linksRev } = await supabase
    .from('contrato_revisao_links')
    .select('id, token, expira_em, revogado_em')
    .eq('user_id', acesso.userId)
    .eq('tipo_contrato', 'locacao')
    .eq('contrato_id', r.geracao.id)
    .order('created_at', { ascending: false })
  const linkIdsRev = (linksRev ?? []).map(l => l.id)
  const { data: consideracoesRev } = linkIdsRev.length > 0
    ? await supabase
        .from('contrato_revisao_consideracoes')
        .select('id, autor_nome, texto, created_at')
        .in('link_id', linkIdsRev)
        .order('created_at', { ascending: false })
    : { data: [] }

  // Processos de assinatura + sugestões (chave = id da geração)
  const { data: processosAss } = await supabase
    .from('contrato_assinaturas')
    .select('id, status, created_at, signatarios:contrato_assinatura_signatarios(nome, email, papel, status, token)')
    .eq('user_id', acesso.userId)
    .eq('tipo_contrato', 'locacao')
    .eq('contrato_id', r.geracao.id)
    .order('created_at', { ascending: false })

  const inqEmail = inqTmp as { nome: string; email?: string | null } | null
  const propEmail = propTmp as { nome: string; email?: string | null } | null
  const testIdsAss = (r.geracao.testemunha_ids as string[] | null) ?? []
  const { data: testPessoasAss } = testIdsAss.length > 0
    ? await supabase.from('pessoas').select('nome, email').in('id', testIdsAss).eq('user_id', acesso.userId)
    : { data: [] }
  const sugestoesAss = [
    inqEmail?.email ? { nome: inqEmail.nome, email: inqEmail.email, papel: 'Locatário(a)' } : null,
    propEmail?.email ? { nome: propEmail.nome, email: propEmail.email, papel: 'Locador(a)' } : null,
    ...((testPessoasAss ?? []) as Array<{ nome: string; email: string | null }>)
      .map(t => ({ nome: t.nome, email: t.email ?? '', papel: 'Testemunha' })),
  ].filter((s): s is { nome: string; email: string; papel: string } => !!s)

  // Detecta dados do imóvel faltando pra contrato robusto
  const dadosImovelFaltando: string[] = []
  if (!im?.endereco_completo) dadosImovelFaltando.push('endereço completo')
  if (!im?.matricula_cartorio) dadosImovelFaltando.push('matrícula do cartório')
  if (!im?.inscricao_municipal) dadosImovelFaltando.push('inscrição municipal')
  if (!im?.uc_energia) dadosImovelFaltando.push('UC energia')
  if (!im?.matricula_agua) dadosImovelFaltando.push('matrícula água')

  return (
    <main className="px-4 py-4 pb-20 max-w-7xl mx-auto">
      <Breadcrumbs items={[
        { label: 'Contratos', href: '/painel/contratos' },
        { label: contrato.codigo, href: `/painel/contratos/${contratoId}` },
        { label: 'Gerar contrato' },
      ]} />
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

      <PainelRevisao
        tipoContrato="locacao"
        contratoId={r.geracao.id}
        titulo={contrato.codigo}
        baseUrl={baseUrl}
        linksIniciais={(linksRev ?? []) as Array<{ id: string; token: string; expira_em: string; revogado_em: string | null }>}
        consideracoes={(consideracoesRev ?? []) as Array<{ id: string; autor_nome: string | null; texto: string; created_at: string }>}
      />

      <PainelAssinatura
        tipoContrato="locacao"
        contratoId={r.geracao.id}
        titulo={contrato.codigo}
        baseUrl={baseUrl}
        sugestoes={sugestoesAss}
        processos={(processosAss ?? []) as Array<{ id: string; status: string; created_at: string; signatarios: Array<{ nome: string; email: string; papel: string | null; status: string; token: string }> }>}
      />

      <EditorContrato
        contratoId={contratoId}
        codigo={contrato.codigo}
        garantiaTipo={contrato.garantia_tipo}
        qtdChavesInicial={contrato.qtd_chaves ?? 0}
        qtdControlesInicial={contrato.qtd_controles ?? 0}
        qtdTagsInicial={contrato.qtd_tags ?? 0}
        conjugeInquilinoNome={inq?.conjuge_nome ?? null}
        conjugePapelInicial={(contrato.conjuge_inquilino_papel ?? 'solidario') as 'solidario' | 'anuente' | 'nao_participa'}
        anotacoesInicial={contrato.anotacoes_corretor ?? ''}
        geracao={{
          id: r.geracao.id,
          tipo_seguro_incendio: r.geracao.tipo_seguro_incendio,
          saida_sem_multa_12m: r.geracao.saida_sem_multa_12m,
          clausula_ids: r.geracao.clausula_ids as string[],
          testemunha_ids: (r.geracao.testemunha_ids as string[] | null) ?? [],
          clausulas_seguradora_texto: r.geracao.clausulas_seguradora_texto ?? '',
          incluir_capa: r.geracao.incluir_capa ?? true,
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
