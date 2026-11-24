import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBairros } from '@/lib/supabase/queries'
import { contarProgresso, type OpcoesImportacao, type ResumoAnalise } from '@/lib/importacao/motor'
import { ROTULO_STATUS } from '../_components/historico'
import { Previa } from '../_components/previa'
import { Andamento } from '../_components/andamento'
import { ListaItens, type LinhaItem } from '../_components/lista-itens'

export const dynamic = 'force-dynamic'
// Os lotes da importação (fotos!) rodam em server actions desta página.
export const maxDuration = 300

const FILTROS = ['todos', 'criado', 'atualizado', 'sem_mudanca', 'ignorado', 'erro', 'pendente'] as const

export default async function ImportacaoPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ver?: string }>
}) {
  const [{ id }, { ver }] = await Promise.all([params, searchParams])
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')
  const { data: perfil } = await supabase.from('perfis').select('role').eq('id', user.id).single()
  const admin = perfil?.role === 'admin'

  const db = createAdminClient()
  const { data: imp } = await db.from('importacoes')
    .select('id, user_id, origem, url, arquivo_nome, formato, status, erro, opcoes, resumo, total, criado_em, iniciado_em, concluido_em, automatica, fonte_id')
    .eq('id', id).maybeSingle()
  if (!imp || (imp.user_id !== user.id && !admin)) notFound()

  const filtro = (FILTROS as readonly string[]).includes(ver ?? '') ? ver! : 'todos'
  let consulta = db.from('importacoes_itens')
    .select('id, codigo, titulo, bairro_origem, acao, motivo, status, problemas, mensagem, imovel_id')
    .eq('importacao_id', id).order('ordem').limit(300)
  if (filtro === 'pendente') consulta = consulta.in('status', ['pendente', 'processando'])
  else if (filtro !== 'todos') consulta = consulta.eq('status', filtro)

  const [{ data: itens }, progresso, { data: bairros }, { data: dono }] = await Promise.all([
    consulta,
    contarProgresso(id, db),
    getBairros(),
    imp.user_id !== user.id ? db.from('perfis').select('nome').eq('id', imp.user_id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const resumo = imp.resumo as ResumoAnalise
  const st = ROTULO_STATUS[imp.status] ?? ROTULO_STATUS.erro
  const origem = imp.origem === 'url' ? imp.url : (imp.arquivo_nome ?? 'Arquivo enviado')

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 pb-24">
      <Link href="/painel/anuncios/importar" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-violet-700 mb-2">
        <ArrowLeft size={12} /> Importar anúncios
      </Link>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <h1 className="text-xl font-bold text-gray-900">Importação</h1>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>{st.texto}</span>
      </div>
      <p className="text-xs text-gray-500 mb-1 break-all">
        {origem}
        {imp.formato && <> · formato {imp.formato === 'vrsync' ? 'VRSync' : 'ZAP antigo'}</>}
        {resumo?.provedor && <> · gerado por {resumo.provedor}</>}
      </p>
      <p className="text-[11px] text-gray-400 mb-5">
        Criada em {new Date(imp.criado_em).toLocaleString('pt-BR')}
        {imp.automatica && ' · automática'}
        {dono?.nome && <> · para a conta de <strong className="text-gray-600">{dono.nome}</strong></>}
      </p>

      {imp.status === 'erro' && (
        <div className="flex items-start gap-2 bg-red-50 ring-1 ring-red-200 text-red-800 text-sm rounded-xl px-4 py-3 mb-5">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Não deu para ler o XML</p>
            <p>{imp.erro}</p>
          </div>
        </div>
      )}

      {imp.status === 'analisando' && (
        <p className="text-sm text-blue-800 bg-blue-50 ring-1 ring-blue-200 rounded-xl px-4 py-3 mb-5">
          Analisando o arquivo… Recarregue a página em alguns instantes.
        </p>
      )}

      {(imp.status === 'pronta' || imp.status === 'erro') && (
        <Previa
          id={imp.id}
          status={imp.status}
          resumo={resumo}
          bairros={(bairros ?? []).map(b => ({ id: b.id, nome: b.nome }))}
          admin={admin}
          deUrl={imp.origem === 'url'}
        />
      )}

      {['importando', 'concluida', 'cancelada'].includes(imp.status) && (
        <Andamento
          // Remonta quando o servidor traz outro estado (ex.: "tentar erros de novo").
          key={`${imp.status}-${progresso.pendentes}-${progresso.erros}-${progresso.criados}`}
          id={imp.id}
          status={imp.status}
          inicial={progresso}
          opcoes={imp.opcoes as OpcoesImportacao}
          ausentesNaAnalise={resumo?.ausentes ?? 0}
        />
      )}

      {imp.status !== 'analisando' && imp.status !== 'erro' && (
        <ListaItens id={imp.id} filtro={filtro} itens={(itens ?? []) as LinhaItem[]} progresso={progresso} total={imp.total} />
      )}
    </main>
  )
}
