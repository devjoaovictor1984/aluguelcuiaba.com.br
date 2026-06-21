import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { obterOuCriarGeracaoAdm } from './actions'
import { contratoAssinado } from '@/lib/crm/assinatura-lock'
import { EditorContratoAdm } from './_components/editor-contrato-adm'
import { PainelRevisao } from '../../../contratos/_components/painel-revisao'
import { PainelAssinatura } from '../../../contratos/_components/painel-assinatura'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export default async function GerarContratoAdmPage({ params }: Props) {
  const { id } = await params
  try {
    return await renderizar(id)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : null
    return (
      <main className="p-6">
        <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-2xl p-6">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle className="text-red-600 shrink-0" />
            <div>
              <h2 className="font-bold text-red-900">Erro ao abrir o editor de cláusulas</h2>
              <p className="text-sm text-red-800 mt-1">{msg}</p>
            </div>
          </div>
          {stack && (
            <details className="mt-4">
              <summary className="text-xs font-semibold text-red-700 cursor-pointer">Stack trace</summary>
              <pre className="text-[10px] mt-2 bg-white p-3 rounded border border-red-200 overflow-auto max-h-96 whitespace-pre-wrap">{stack}</pre>
            </details>
          )}
          <Link href={`/painel/administracoes/${id}`} className="inline-block mt-4 text-sm text-violet-700 hover:underline">
            Voltar
          </Link>
        </div>
      </main>
    )
  }
}

async function renderizar(contratoAdmId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Confirma posse + puxa proprietário pra mostrar
  const { data: contrato } = await supabase
    .from('contratos_administracao')
    .select(`
      id, codigo, taxa_valor, taxa_tipo, dia_repasse, exclusividade, checklist_manual,
      prazo_meses, data_inicio, data_termino,
      proprietario:pessoas!proprietario_id(id, nome, cpf_cnpj, email),
      proprietario_representante:pessoas!proprietario_representante_id(id, nome, email),
      imovel:imoveis(id, titulo)
    `)
    .eq('id', contratoAdmId)
    .eq('user_id', acesso.userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!contrato) redirect('/painel/administracoes')

  // Dados da administradora (pro checklist e pra sugestão de signatário)
  const { data: perfilAdm } = await supabase
    .from('perfis')
    .select('cnpj, creci_juridico, nome, razao_social')
    .eq('id', acesso.userId)
    .maybeSingle()

  // Obtém ou cria geração
  const r = await obterOuCriarGeracaoAdm(contratoAdmId)
  if (r.error || !r.geracao) {
    return (
      <main className="p-6">
        <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertCircle className="mx-auto text-red-600 mb-2" />
          <h2 className="font-bold text-red-900 mb-1">Não foi possível abrir o editor</h2>
          <p className="text-sm text-red-800">{r.error}</p>
          <Link href={`/painel/administracoes/${contratoAdmId}`} className="inline-block mt-4 text-sm text-violet-700 hover:underline">
            Voltar
          </Link>
        </div>
      </main>
    )
  }

  // Cláusulas tipo='administracao' do user
  const { data: todasClausulas } = await supabase
    .from('contrato_clausulas')
    .select('id, tipo, categoria, titulo, numero, corpo')
    .eq('user_id', acesso.userId)
    .eq('tipo', 'administracao')
    .eq('ativa', true)
    .order('numero', { ascending: true })

  // Pessoas elegíveis pra testemunha
  const { data: pessoas } = await supabase
    .from('pessoas')
    .select('id, nome, cpf_cnpj, tipo')
    .eq('user_id', acesso.userId)
    .order('nome', { ascending: true })

  // Documentos das partes (proprietário + representante + testemunhas) — opção de anexar
  const prop = unwrap(contrato.proprietario) as { id: string; nome: string; cpf_cnpj: string | null } | null
  const reprDoc = unwrap(contrato.proprietario_representante) as { id?: string } | null
  const partesIds = [
    prop?.id,
    reprDoc?.id,
    ...((r.geracao.testemunha_ids as string[] | null) ?? []),
  ].filter((x): x is string => !!x)
  const { data: documentosPartes } = partesIds.length > 0
    ? await supabase
        .from('pessoas_documentos')
        .select('id, pessoa_id, tipo, arquivo_path, nome_original, pessoa:pessoas!pessoa_id(nome)')
        .in('pessoa_id', partesIds)
        .eq('user_id', acesso.userId)
        .order('created_at', { ascending: false })
    : { data: [] }

  const imovel = unwrap(contrato.imovel) as { titulo: string } | null

  // Links de revisão + considerações recebidas
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const { data: linksRev } = await supabase
    .from('contrato_revisao_links')
    .select('id, token, expira_em, revogado_em')
    .eq('user_id', acesso.userId)
    .eq('tipo_contrato', 'administracao')
    .eq('contrato_id', contratoAdmId)
    .order('created_at', { ascending: false })
  const linkIdsRev = (linksRev ?? []).map(l => l.id)
  const { data: consideracoesRev } = linkIdsRev.length > 0
    ? await supabase
        .from('contrato_revisao_consideracoes')
        .select('id, autor_nome, texto, created_at')
        .in('link_id', linkIdsRev)
        .order('created_at', { ascending: false })
    : { data: [] }

  // Processos de assinatura + sugestões de signatários
  const { data: processosAss } = await supabase
    .from('contrato_assinaturas')
    .select('id, status, created_at, signatarios:contrato_assinatura_signatarios(id, nome, email, papel, status, token)')
    .eq('user_id', acesso.userId)
    .eq('tipo_contrato', 'administracao')
    .eq('contrato_id', contratoAdmId)
    .order('created_at', { ascending: false })

  // Sugestões de signatários = partes reais do contrato (preenche automático).
  const propComEmail = unwrap(contrato.proprietario) as { nome: string; email: string | null } | null
  const reprComEmail = unwrap(contrato.proprietario_representante) as { nome: string; email: string | null } | null
  const adminNome = perfilAdm?.razao_social || perfilAdm?.nome || 'Administradora'
  const testIds = (r.geracao.testemunha_ids as string[] | null) ?? []
  const { data: testPessoas } = testIds.length > 0
    ? await supabase.from('pessoas').select('nome, email').in('id', testIds).eq('user_id', acesso.userId)
    : { data: [] }

  // Quando há representante (proprietária PJ representada por uma pessoa), quem
  // assina é o REPRESENTANTE em nome da empresa — a própria proprietária (PJ)
  // não assina. Sem representante, sugere a proprietária diretamente.
  const temRepresentante = !!reprComEmail
  const sugestoesAss = [
    user?.email ? { nome: adminNome, email: user.email, papel: 'Administradora (responsável)' } : null,
    (!temRepresentante && propComEmail?.email)
      ? { nome: propComEmail.nome, email: propComEmail.email, papel: 'Proprietária(o)' } : null,
    reprComEmail?.email
      ? { nome: reprComEmail.nome, email: reprComEmail.email, papel: 'Representante da proprietária' } : null,
    ...((testPessoas ?? []) as Array<{ nome: string; email: string | null }>)
      .map(t => ({ nome: t.nome, email: t.email ?? '', papel: 'Testemunha' })),
  ].filter((s): s is { nome: string; email: string; papel: string } => !!s)

  // Valores automáticos da capa do contrato de administração (placeholders)
  const c2 = contrato as {
    taxa_valor?: number | null; taxa_tipo?: string | null; prazo_meses?: number | null
    data_inicio?: string | null; data_termino?: string | null; dia_repasse?: number | null; exclusividade?: boolean
  }
  const fmtBRLc = (v: number | null | undefined) =>
    v == null ? '' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const fmtDataC = (iso: string | null | undefined) => {
    if (!iso) return ''
    const [y, m, d] = iso.slice(0, 10).split('-')
    return `${d}/${m}/${y}`
  }
  let terminoAdm = ''
  if (c2.data_termino) terminoAdm = fmtDataC(c2.data_termino)
  else if (c2.data_inicio && c2.prazo_meses) {
    const ini = new Date(c2.data_inicio + 'T00:00:00')
    const fim = new Date(ini.getFullYear(), ini.getMonth() + c2.prazo_meses, ini.getDate() - 1)
    terminoAdm = fim.toLocaleDateString('pt-BR')
  }
  const capaAutoAdm: Record<string, string> = {
    taxa: c2.taxa_valor == null ? '' : (c2.taxa_tipo === 'fixo' ? `${fmtBRLc(c2.taxa_valor)} / mês` : `${c2.taxa_valor}% ao mês`),
    prazo: c2.prazo_meses ? `${c2.prazo_meses} meses` : '',
    inicio: fmtDataC(c2.data_inicio),
    termino: terminoAdm,
    repasse: c2.dia_repasse ? `Até o dia ${c2.dia_repasse}` : '',
    exclusividade: c2.exclusividade ? 'Sim' : 'Não',
  }

  return (
    <main className="px-4 py-4 pb-20 max-w-7xl mx-auto">
      <Breadcrumbs items={[
        { label: 'Contratos de administração', href: '/painel/administracoes' },
        { label: contrato.codigo, href: `/painel/administracoes/${contratoAdmId}` },
        { label: 'Editor de cláusulas' },
      ]} />
      <div className="flex items-center gap-3 mb-4">
        <Link
          href={`/painel/administracoes/${contratoAdmId}`}
          className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
        >
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Editor de cláusulas — administração</h1>
          <p className="text-xs text-gray-500">
            {contrato.codigo} · {prop?.nome ?? '—'} {imovel?.titulo ? `· ${imovel.titulo}` : ''}
          </p>
        </div>
      </div>

      <PainelRevisao
        tipoContrato="administracao"
        contratoId={contratoAdmId}
        titulo={contrato.codigo}
        baseUrl={baseUrl}
        linksIniciais={(linksRev ?? []) as Array<{ id: string; token: string; expira_em: string; revogado_em: string | null }>}
        consideracoes={(consideracoesRev ?? []) as Array<{ id: string; autor_nome: string | null; texto: string; created_at: string }>}
      />

      <PainelAssinatura
        tipoContrato="administracao"
        contratoId={contratoAdmId}
        titulo={contrato.codigo}
        baseUrl={baseUrl}
        sugestoes={sugestoesAss}
        processos={(processosAss ?? []) as Array<{ id: string; status: string; created_at: string; signatarios: Array<{ id: string; nome: string; email: string; papel: string | null; status: string; token: string }> }>}
      />

      <EditorContratoAdm
        contratoAdmId={contratoAdmId}
        codigo={contrato.codigo}
        travado={await contratoAssinado(supabase, 'administracao', contratoAdmId)}
        checklistBase={{
          proprietario_nome: prop?.nome ?? null,
          proprietario_cpf: prop?.cpf_cnpj ?? null,
          admin_cnpj: (perfilAdm as { cnpj?: string | null } | null)?.cnpj ?? null,
          admin_creci_juridico: (perfilAdm as { creci_juridico?: string | null } | null)?.creci_juridico ?? null,
          taxa_valor: (contrato as { taxa_valor?: number | null }).taxa_valor ?? null,
          dia_repasse: (contrato as { dia_repasse?: number | null }).dia_repasse ?? null,
          exclusividade: !!(contrato as { exclusividade?: boolean }).exclusividade,
        }}
        geracao={{
          id: r.geracao.id,
          clausulas: ((r.geracao as { clausulas?: unknown }).clausulas ?? []) as Array<{ id: string; titulo: string; corpo: string; categoria: string }>,
          testemunha_ids: (r.geracao.testemunha_ids as string[] | null) ?? [],
          anexo_documento_ids: (r.geracao.anexo_documento_ids as string[] | null) ?? [],
          pdf_assinado_url: r.geracao.pdf_assinado_url ?? null,
          assinado_em: r.geracao.assinado_em ?? null,
          status: r.geracao.status ?? 'rascunho',
          capa_overrides: ((r.geracao as { capa_overrides?: Record<string, string> | null }).capa_overrides ?? {}) as Record<string, string>,
        }}
        capaAuto={capaAutoAdm}
        todasClausulas={(todasClausulas ?? []).map(c => ({
          id: c.id,
          tipo: c.tipo as 'administracao',
          categoria: c.categoria,
          titulo: c.titulo,
          numero: c.numero,
          corpo: c.corpo,
        }))}
        pessoas={(pessoas ?? []) as Array<{ id: string; nome: string; cpf_cnpj: string | null; tipo: string }>}
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
