import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { obterOuCriarGeracaoAdm } from './actions'
import { EditorContratoAdm } from './_components/editor-contrato-adm'

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

  // Confirma posse + puxa proprietário pra mostrar
  const { data: contrato } = await supabase
    .from('contratos_administracao')
    .select(`
      id, codigo, taxa_valor, dia_repasse, exclusividade,
      proprietario:pessoas!proprietario_id(id, nome, cpf_cnpj),
      imovel:imoveis(id, titulo)
    `)
    .eq('id', contratoAdmId)
    .eq('user_id', acesso.userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!contrato) redirect('/painel/administracoes')

  // Dados jurídicos da administradora (pro checklist de mínimos)
  const { data: perfilAdm } = await supabase
    .from('perfis')
    .select('cnpj, creci_juridico')
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

  // Documentos do proprietário (pra anexar)
  const prop = unwrap(contrato.proprietario) as { id: string; nome: string; cpf_cnpj: string | null } | null
  const { data: documentosPartes } = prop
    ? await supabase
        .from('pessoas_documentos')
        .select('id, pessoa_id, tipo, arquivo_path, nome_original, pessoa:pessoas!pessoa_id(nome)')
        .eq('pessoa_id', prop.id)
        .eq('user_id', acesso.userId)
        .order('created_at', { ascending: false })
    : { data: [] }

  const imovel = unwrap(contrato.imovel) as { titulo: string } | null

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

      <EditorContratoAdm
        contratoAdmId={contratoAdmId}
        codigo={contrato.codigo}
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
          clausula_ids: r.geracao.clausula_ids as string[],
          testemunha_ids: (r.geracao.testemunha_ids as string[] | null) ?? [],
          anexo_documento_ids: (r.geracao.anexo_documento_ids as string[] | null) ?? [],
          pdf_assinado_url: r.geracao.pdf_assinado_url ?? null,
          assinado_em: r.geracao.assinado_em ?? null,
          status: r.geracao.status ?? 'rascunho',
        }}
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
