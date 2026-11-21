import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Home, CheckCircle2, Eye, RefreshCw, Megaphone, KeyRound, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BarraAnuncios } from './_components/barra-anuncios'
import { AnuncioLinha, type AnuncioItem } from './_components/anuncio-linha'
import { Paginacao } from './_components/paginacao'

export const dynamic = 'force-dynamic'

/**
 * "Meus anúncios" — a lista de trabalho do anunciante (nov/2026).
 * Documentação: docs/painel-anuncios.md.
 *
 * Tudo que filtra mora na URL (?q, ?status, ?ordem, ?pagina, ?escopo): dá pra
 * voltar, recarregar e mandar o link sem perder a busca. A paginação é no
 * banco — antes a página trazia TODOS os anúncios com TODAS as fotos e
 * filtrava em memória.
 */

const POR_PAGINA = 20

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'ativo', label: 'Ativos' },
  { key: 'alugado', label: 'Alugados' },
  { key: 'pausado', label: 'Pausados' },
  { key: 'expirado', label: 'Expirados' },
  { key: 'rascunho', label: 'Rascunhos' },
] as const
type FiltroStatus = (typeof FILTROS)[number]['key']

const ORDENS: Record<string, { col: string; asc: boolean }> = {
  recentes: { col: 'created_at', asc: false },
  antigos: { col: 'created_at', asc: true },
  atualizados: { col: 'updated_at', asc: false },
  preco_maior: { col: 'preco', asc: false },
  preco_menor: { col: 'preco', asc: true },
  visitas: { col: 'visualizacoes', asc: false },
  expira: { col: 'expira_em', asc: true },
}

// PostgREST usa vírgula e parênteses como sintaxe do `.or()`: tirar da busca
// evita que um texto digitado quebre (ou altere) o filtro.
function limparBusca(q: string) {
  return q.replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

interface Props {
  searchParams: Promise<{
    q?: string; status?: string; ordem?: string; pagina?: string; escopo?: string
    atualizado?: string; publicado?: string; excluido?: string
  }>
}

export default async function MeusAnunciosPage({ searchParams }: Props) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const { data: perfil } = await supabase.from('perfis').select('role').eq('id', user.id).single()
  const isAdmin = perfil?.role === 'admin'

  // "Todos os anunciantes" é só do admin. Para os demais o parâmetro é
  // ignorado — e o cliente de serviço nunca é criado.
  const verTodos = isAdmin && sp.escopo === 'todos'
  const db = verTodos ? createAdminClient() : supabase

  const status = (FILTROS.some(f => f.key === sp.status) ? sp.status : 'todos') as FiltroStatus
  const ordem = ORDENS[sp.ordem ?? ''] ? sp.ordem! : 'recentes'
  const pagina = Math.max(1, parseInt(sp.pagina ?? '1') || 1)
  const q = limparBusca(sp.q ?? '')
  const agoraIso = new Date().toISOString()

  // Busca por bairro: o nome mora em outra tabela, então resolve os ids antes.
  let bairroIds: string[] = []
  if (q) {
    const { data: bs } = await supabase.from('bairros').select('id').ilike('nome', `%${q}%`).limit(50)
    bairroIds = (bs ?? []).map(b => b.id as string)
  }

  // Aplica escopo + busca. Usado na lista e nas contagens das abas, pra que o
  // número da aba bata com o que aparece ao clicar nela.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const escopo = <T extends { eq: any; or: any }>(query: T): T => {
    let r = query
    if (!verTodos) r = r.eq('user_id', user.id)
    if (q) {
      const ors = [
        `titulo.ilike.%${q}%`,
        `endereco_resumido.ilike.%${q}%`,
        `condominio_nome.ilike.%${q}%`,
        `slug.ilike.%${q}%`,
      ]
      if (bairroIds.length) ors.push(`bairro_id.in.(${bairroIds.join(',')})`)
      r = r.or(ors.join(','))
    }
    return r
  }

  // ── Lista paginada ──
  let lista = escopo(
    db.from('imoveis')
      .select(
        'id, slug, titulo, tipo, preco, preco_antigo, status, expira_em, visualizacoes, data_alugado, created_at, updated_at, user_id, quartos, area_m2, ' +
        'fotos(url, principal, ordem), bairro:bairros(nome, slug), perfil:perfis(nome)',
        { count: 'exact' },
      )
      .order('principal', { referencedTable: 'fotos', ascending: false })
      .order('ordem', { referencedTable: 'fotos' })
      .limit(1, { referencedTable: 'fotos' }),
  )
  // Status "efetivo": um ativo com expira_em vencido já é expirado para quem
  // olha — o cron que troca o status pode não ter passado ainda.
  if (status === 'ativo') lista = lista.eq('status', 'ativo').gte('expira_em', agoraIso)
  else if (status === 'expirado') lista = lista.or(`status.eq.expirado,and(status.eq.ativo,expira_em.lt.${agoraIso})`)
  else if (status !== 'todos') lista = lista.eq('status', status)

  const o = ORDENS[ordem]
  const inicio = (pagina - 1) * POR_PAGINA

  // ── Contagens das abas (só status + expira_em: leve mesmo pro admin) ──
  const contagemQuery = escopo(db.from('imoveis').select('status, expira_em, visualizacoes')).limit(5000)

  const [{ data: dados, count, error }, { data: resumo }] = await Promise.all([
    lista.order(o.col, { ascending: o.asc }).order('id').range(inicio, inicio + POR_PAGINA - 1),
    contagemQuery,
  ])

  // eslint-disable-next-line react-hooks/purity -- server component dinâmico; data do request
  const agora = Date.now()
  const linhas = (resumo ?? []) as Array<{ status: string; expira_em: string; visualizacoes: number | null }>
  const vencido = (r: { status: string; expira_em: string }) =>
    r.status === 'expirado' || (r.status === 'ativo' && new Date(r.expira_em).getTime() < agora)
  const contagem: Record<FiltroStatus, number> = {
    todos: linhas.length,
    ativo: linhas.filter(r => r.status === 'ativo' && !vencido(r)).length,
    alugado: linhas.filter(r => r.status === 'alugado').length,
    pausado: linhas.filter(r => r.status === 'pausado').length,
    expirado: linhas.filter(vencido).length,
    rascunho: linhas.filter(r => r.status === 'rascunho').length,
  }
  const aRenovar = linhas.filter(r =>
    vencido(r) || (r.status === 'ativo' && new Date(r.expira_em).getTime() - agora <= 7 * 86_400_000),
  ).length
  const visitas = linhas.reduce((s, r) => s + (r.visualizacoes ?? 0), 0)

  const itens = (dados ?? []) as unknown as AnuncioItem[]
  const total = count ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  // Monta link preservando os filtros atuais.
  const linkCom = (mudar: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const base = { q: q || undefined, status: status === 'todos' ? undefined : status, ordem: ordem === 'recentes' ? undefined : ordem, escopo: verTodos ? 'todos' : undefined, pagina: undefined as string | undefined }
    for (const [k, v] of Object.entries({ ...base, ...mudar })) if (v) p.set(k, v)
    const s = p.toString()
    return `/painel/anuncios${s ? `?${s}` : ''}`
  }

  // Abas vazias (pausado/rascunho quase nunca têm nada) somem, a não ser a
  // que está selecionada — ver o item antigo em docs/pendencias.md.
  const abas = FILTROS.filter(f => f.key === 'todos' || f.key === status || contagem[f.key] > 0)

  const aviso =
    sp.publicado === '1' ? { cls: 'bg-green-50 border-green-200 text-green-800', txt: 'Anúncio publicado com sucesso!' }
    : sp.atualizado === '1' ? { cls: 'bg-blue-50 border-blue-200 text-blue-800', txt: 'Anúncio atualizado com sucesso!' }
    : sp.excluido === '1' ? { cls: 'bg-gray-50 border-gray-200 text-gray-700', txt: 'Anúncio excluído.' }
    : null

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 pb-24">
      {aviso && (
        <div className={`flex items-center gap-2.5 border text-sm rounded-2xl px-4 py-3 mb-5 ${aviso.cls}`}>
          <CheckCircle2 size={18} className="shrink-0" />
          <span className="font-medium">{aviso.txt}</span>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {verTodos ? 'Todos os anúncios' : 'Meus anúncios'}
            {verTodos && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-50 ring-1 ring-violet-200 px-2 py-0.5 rounded-full">
                <ShieldCheck size={11} /> admin
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {verTodos ? 'Anúncios de todos os anunciantes da plataforma.' : 'Publique, edite e acompanhe seus imóveis.'}
          </p>
        </div>
        <Link
          href="/painel/anuncios/novo"
          className="inline-flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          <Plus size={16} /> Novo anúncio
        </Link>
      </div>

      {/* Indicadores — cada um é um atalho de filtro */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Indicador href={linkCom({ status: 'ativo' })} icone={<Megaphone size={16} />} cor="text-green-600 bg-green-50" valor={contagem.ativo} rotulo="No ar" />
        <Indicador href={linkCom({ status: 'alugado' })} icone={<KeyRound size={16} />} cor="text-teal-600 bg-teal-50" valor={contagem.alugado} rotulo="Alugados" />
        <Indicador href={linkCom({ status: 'expirado' })} icone={<RefreshCw size={16} />} cor="text-amber-600 bg-amber-50" valor={aRenovar} rotulo="A renovar" />
        <Indicador icone={<Eye size={16} />} cor="text-violet-600 bg-violet-50" valor={visitas} rotulo="Visitas" />
      </div>

      {/* Abas de status */}
      <nav className="flex items-center gap-1 mb-3 overflow-x-auto pb-1 -mx-1 px-1" aria-label="Filtrar por status">
        {abas.map(f => {
          const ativo = status === f.key
          return (
            <Link
              key={f.key}
              href={linkCom({ status: f.key === 'todos' ? undefined : f.key })}
              aria-current={ativo ? 'page' : undefined}
              className={`shrink-0 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                ativo ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 text-xs ${ativo ? 'text-gray-300' : 'text-gray-400'}`}>{contagem[f.key]}</span>
            </Link>
          )
        })}
      </nav>

      <BarraAnuncios q={q} ordem={ordem} isAdmin={isAdmin} verTodos={verTodos} />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-4">Erro ao carregar: {error.message}</p>
      )}

      {/* Lista */}
      {itens.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 text-center py-14 px-4">
          <Home size={36} className="mx-auto mb-3 text-gray-300" />
          {contagem.todos === 0 && !q ? (
            <>
              <p className="font-semibold text-gray-700 mb-1">Nenhum anúncio ainda</p>
              <p className="text-sm text-gray-500 mb-4">Publique seu primeiro imóvel e comece a receber contatos.</p>
              <Link href="/painel/anuncios/novo" className="inline-flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">
                <Plus size={15} /> Publicar anúncio
              </Link>
            </>
          ) : (
            <>
              <p className="font-semibold text-gray-700 mb-1">Nada encontrado</p>
              <p className="text-sm text-gray-500 mb-3">
                {q ? <>Nenhum anúncio com “{q}” neste filtro.</> : 'Nenhum anúncio neste filtro.'}
              </p>
              <Link href={verTodos ? '/painel/anuncios?escopo=todos' : '/painel/anuncios'} className="text-sm font-semibold text-violet-700 hover:underline">
                Limpar filtros
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-2">
            {total} anúncio{total === 1 ? '' : 's'}
            {totalPaginas > 1 && <> · página {pagina} de {totalPaginas}</>}
          </p>
          <ul className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {itens.map(im => (
              <AnuncioLinha key={im.id} imovel={im} agora={agora} mostrarAnunciante={verTodos} ehDono={im.user_id === user.id} />
            ))}
          </ul>
          <Paginacao pagina={pagina} totalPaginas={totalPaginas} hrefDaPagina={p => linkCom({ pagina: p > 1 ? String(p) : undefined })} />
        </>
      )}
    </main>
  )
}

function Indicador({ href, icone, cor, valor, rotulo }: {
  href?: string; icone: React.ReactNode; cor: string; valor: number; rotulo: string
}) {
  const corpo = (
    <>
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${cor}`}>{icone}</span>
      <span>
        <span className="block text-lg font-bold text-gray-900 leading-tight">{valor.toLocaleString('pt-BR')}</span>
        <span className="block text-xs text-gray-500">{rotulo}</span>
      </span>
    </>
  )
  const cls = 'flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3'
  return href
    ? <Link href={href} className={`${cls} hover:border-violet-200 transition-colors`}>{corpo}</Link>
    : <div className={cls}>{corpo}</div>
}
