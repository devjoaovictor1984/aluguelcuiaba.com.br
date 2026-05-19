import { createAdminClient } from '@/lib/supabase/admin'
import { formatarPreco, buildImovelUrl } from '@/lib/utils'
import {
  Home, Users, FileText, TrendingUp, AlertTriangle,
  ArrowUp, ArrowDown, Minus, Activity, DollarSign,
  Clock, Eye, Star, ChevronRight, MapPin, Camera, Tag,
} from 'lucide-react'
import Link from 'next/link'
import type { Imovel } from '@/types'

function StatCard({
  label, value, sub, icon: Icon, cor, bg, delta, sufixo,
}: {
  label: string; value: number | string; sub?: string; icon: React.ElementType
  cor: string; bg: string; delta?: number; sufixo?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
          <Icon size={20} className={cor} />
        </div>
        {delta !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold rounded-full px-2 py-0.5 ${
            delta > 0 ? 'bg-green-50 text-green-600' : delta < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
          }`}>
            {delta > 0 ? <ArrowUp size={10} /> : delta < 0 ? <ArrowDown size={10} /> : <Minus size={10} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="text-3xl font-extrabold text-gray-900 tracking-tight">{value}{sufixo}</p>
      <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function BarChart({ data, total }: { data: { label: string; value: number; color: string }[]; total: number }) {
  return (
    <div className="space-y-2.5">
      {data.map(item => (
        <div key={item.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-600 font-medium">{item.label}</span>
            <span className="text-gray-500">{item.value} ({total ? Math.round((item.value / total) * 100) : 0}%)</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${item.color}`}
              style={{ width: total ? `${(item.value / total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function InsightCard({ icon: Icon, title, desc, color }: {
  icon: React.ElementType; title: string; desc: string; color: string
}) {
  return (
    <div className={`flex gap-3 p-3 rounded-xl border ${color}`}>
      <Icon size={16} className="shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs mt-0.5 opacity-80">{desc}</p>
      </div>
    </div>
  )
}

export default async function AdminPage() {
  let supabase: ReturnType<typeof createAdminClient> | null = null
  try { supabase = createAdminClient() } catch { /* noop */ }

  if (!supabase) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={28} className="text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Service Role Key não configurada</h1>
        <p className="text-gray-500 text-sm mb-4">
          Adicione <strong>SUPABASE_SERVICE_ROLE_KEY</strong> no <code className="bg-gray-100 px-1 rounded">.env.local</code> e reinicie.
        </p>
        <Link href="/painel" className="text-violet-600 hover:underline text-sm">← Voltar ao painel</Link>
      </div>
    )
  }

  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()
  const inicioMesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).toISOString()
  const fimMesPassado = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59).toISOString()
  const em7Dias = new Date(agora.getTime() + 7 * 86400000).toISOString()

  // Envios (resilientes a v18 não rodada)
  const [emailMesQ, pushMesQ, quotasQ] = await Promise.all([
    supabase.from('envios_log').select('id', { count: 'exact', head: true }).eq('tipo', 'email').gte('created_at', inicioMes),
    supabase.from('envios_log').select('id', { count: 'exact', head: true }).eq('tipo', 'push').gte('created_at', inicioMes),
    supabase.from('site_config').select('chave, valor').in('chave', ['quota_email_mensal', 'quota_push_mensal']),
  ])
  const enviosV18Faltando = !!emailMesQ.error
  const enviosEmailMes = emailMesQ.count ?? 0
  const enviosPushMes = pushMesQ.count ?? 0
  const cfgEnvios = Object.fromEntries(((quotasQ.data ?? []) as Array<{ chave: string; valor: string }>).map(r => [r.chave, r.valor]))
  const quotaEmail = parseInt(cfgEnvios.quota_email_mensal ?? '1000') || 1000
  const quotaPush = parseInt(cfgEnvios.quota_push_mensal ?? '100000') || 100000
  const pctEmail = quotaEmail > 0 ? Math.min(100, Math.round((enviosEmailMes / quotaEmail) * 100)) : 0
  const pctPush = quotaPush > 0 ? Math.min(100, Math.round((enviosPushMes / quotaPush) * 100)) : 0

  const [
    { count: totalImoveis },
    { count: imoveisAtivos },
    { count: imoveisPausados },
    { count: imoveisExpirados },
    { count: imoveisAlugados },
    { count: totalUsuarios },
    { count: totalPosts },
    { count: postsPublicados },
    { count: imoveisMes },
    { count: imoveisUltimoMes },
    { count: usuariosMes },
    { count: usuariosUltimoMes },
    { data: somaViewsImoveis },
    { data: somaViewsPosts },
    { data: topImoveis },
    { data: topPosts },
    { data: viewsPorBairro },
    { data: recentImoveis },
    { data: recentUsuarios },
    { data: planosDist },
    { data: tiposDist },
    { data: imoveisVencendo },
    { data: imoveisFotosRaw },
    { data: topAnunciantes },
  ] = await Promise.all([
    supabase.from('imoveis').select('*', { count: 'exact', head: true }),
    supabase.from('imoveis').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('imoveis').select('*', { count: 'exact', head: true }).eq('status', 'pausado'),
    supabase.from('imoveis').select('*', { count: 'exact', head: true }).eq('status', 'expirado'),
    supabase.from('imoveis').select('*', { count: 'exact', head: true }).eq('status', 'alugado'),
    supabase.from('perfis').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('publicado', true),
    supabase.from('imoveis').select('*', { count: 'exact', head: true }).gte('created_at', inicioMes),
    supabase.from('imoveis').select('*', { count: 'exact', head: true }).gte('created_at', inicioMesPassado).lte('created_at', fimMesPassado),
    supabase.from('perfis').select('*', { count: 'exact', head: true }).gte('created_at', inicioMes),
    supabase.from('perfis').select('*', { count: 'exact', head: true }).gte('created_at', inicioMesPassado).lte('created_at', fimMesPassado),
    supabase.from('imoveis').select('visualizacoes').then(r => r.error ? { data: [] } : r),
    supabase.from('posts').select('visualizacoes').then(r => r.error ? { data: [] } : r),
    // Top 10 imóveis mais visualizados (apenas ativos)
    supabase.from('imoveis')
      .select('id, slug, titulo, preco, visualizacoes, status, bairro:bairros(slug, nome), fotos(url, principal, ordem)')
      .eq('status', 'ativo')
      .order('visualizacoes', { ascending: false, nullsFirst: false })
      .limit(10),
    // Top 10 posts mais lidos (resiliente se a coluna ainda não existe)
    supabase.from('posts')
      .select('id, slug, titulo, categoria, visualizacoes, capa_url')
      .eq('publicado', true)
      .order('visualizacoes', { ascending: false, nullsFirst: false })
      .limit(10)
      .then(r => r.error
        ? supabase.from('posts')
            .select('id, slug, titulo, categoria, capa_url')
            .eq('publicado', true)
            .order('created_at', { ascending: false })
            .limit(10)
            .then(r2 => ({ data: (r2.data ?? []).map(p => ({ ...p, visualizacoes: 0 })) }))
        : r
      ),
    // Views agregadas por bairro
    supabase.from('imoveis')
      .select('visualizacoes, bairro:bairros(id, nome, slug)')
      .eq('status', 'ativo'),
    // Recentes (já existente)
    supabase.from('imoveis')
      .select('id, titulo, preco, status, created_at, bairro:bairros(nome), fotos(url)')
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('perfis')
      .select('id, nome, tipo, plano, created_at')
      .order('created_at', { ascending: false }).limit(6),
    supabase.from('perfis').select('plano'),
    supabase.from('imoveis').select('tipo'),
    // Imóveis vencendo nos próximos 7 dias
    supabase.from('imoveis')
      .select('id, titulo, expira_em, bairro:bairros(nome)')
      .eq('status', 'ativo')
      .gt('expira_em', agora.toISOString())
      .lte('expira_em', em7Dias)
      .order('expira_em', { ascending: true })
      .limit(5),
    // Imóveis ativos com info de fotos (filtramos em JS depois)
    supabase.from('imoveis')
      .select('id, fotos(id)')
      .eq('status', 'ativo'),
    // Top anunciantes (mais imóveis ativos)
    supabase.from('imoveis')
      .select('user_id, perfil:perfis(id, nome, tipo, plano)')
      .eq('status', 'ativo'),
  ])

  // KPIs derivadas
  const totalViewsImoveis = (somaViewsImoveis ?? []).reduce((acc, r) => acc + (r.visualizacoes ?? 0), 0)
  const totalViewsPosts = (somaViewsPosts ?? []).reduce((acc, r) => acc + (r.visualizacoes ?? 0), 0)
  const imoveisSemFoto = (imoveisFotosRaw ?? []).filter(im => {
    const f = im.fotos as Array<{ id: string }> | null | undefined
    return !f || f.length === 0
  }).length

  const deltaImoveis = imoveisUltimoMes
    ? Math.round((((imoveisMes ?? 0) - imoveisUltimoMes) / imoveisUltimoMes) * 100)
    : 0
  const deltaUsuarios = usuariosUltimoMes
    ? Math.round((((usuariosMes ?? 0) - usuariosUltimoMes) / usuariosUltimoMes) * 100)
    : 0

  const taxaAtivacao = totalImoveis ? Math.round(((imoveisAtivos ?? 0) / totalImoveis) * 100) : 0

  // Bairros mais procurados (soma de views)
  const viewsPorBairroMap: Record<string, { id: string; nome: string; slug: string; views: number; qtd: number }> = {}
  ;(viewsPorBairro ?? []).forEach(r => {
    const b = Array.isArray(r.bairro) ? r.bairro[0] : r.bairro
    if (!b) return
    const bairro = b as { id: string; nome: string; slug: string }
    const k = bairro.id
    if (!viewsPorBairroMap[k]) viewsPorBairroMap[k] = { ...bairro, views: 0, qtd: 0 }
    viewsPorBairroMap[k].views += r.visualizacoes ?? 0
    viewsPorBairroMap[k].qtd += 1
  })
  const topBairros = Object.values(viewsPorBairroMap)
    .sort((a, b) => b.views - a.views)
    .slice(0, 8)

  // Top anunciantes
  const anunciantesMap: Record<string, { id: string; nome: string; tipo: string; plano: string; qtd: number }> = {}
  ;(topAnunciantes ?? []).forEach(r => {
    if (!r.user_id) return
    const p = Array.isArray(r.perfil) ? r.perfil[0] : r.perfil
    if (!p) return
    const perfil = p as { id: string; nome: string | null; tipo: string; plano: string }
    if (!anunciantesMap[r.user_id]) {
      anunciantesMap[r.user_id] = {
        id: perfil.id,
        nome: perfil.nome ?? 'Sem nome',
        tipo: perfil.tipo,
        plano: perfil.plano,
        qtd: 0,
      }
    }
    anunciantesMap[r.user_id].qtd += 1
  })
  const topAnunciantesList = Object.values(anunciantesMap).sort((a, b) => b.qtd - a.qtd).slice(0, 6)

  // Distribuições
  const contPlanos: Record<string, number> = {}
  planosDist?.forEach(r => { contPlanos[r.plano] = (contPlanos[r.plano] ?? 0) + 1 })

  const contTipos: Record<string, number> = {}
  tiposDist?.forEach(r => { contTipos[r.tipo] = (contTipos[r.tipo] ?? 0) + 1 })

  // Insights
  const insights: Array<{ icon: React.ElementType; title: string; desc: string; color: string }> = []
  if ((imoveisExpirados ?? 0) > 3) {
    insights.push({
      icon: Clock,
      title: `${imoveisExpirados} anúncios expirados`,
      desc: 'Considere contatar os anunciantes para renovação ou limpeza do banco.',
      color: 'border-orange-200 bg-orange-50 text-orange-800',
    })
  }
  if (taxaAtivacao < 60 && (totalImoveis ?? 0) > 5) {
    insights.push({
      icon: Activity,
      title: `Taxa de ativação baixa (${taxaAtivacao}%)`,
      desc: 'Menos da metade dos imóveis está ativa.',
      color: 'border-red-200 bg-red-50 text-red-800',
    })
  }
  if ((imoveisMes ?? 0) > (imoveisUltimoMes ?? 0)) {
    insights.push({
      icon: TrendingUp,
      title: 'Crescimento de anúncios este mês',
      desc: `+${(imoveisMes ?? 0) - (imoveisUltimoMes ?? 0)} vs. mês anterior.`,
      color: 'border-green-200 bg-green-50 text-green-800',
    })
  }
  if ((contPlanos.free ?? 0) > (totalUsuarios ?? 0) * 0.8 && (totalUsuarios ?? 0) > 5) {
    insights.push({
      icon: DollarSign,
      title: 'Maioria no plano gratuito',
      desc: '+80% dos usuários são free. Oportunidade de conversão.',
      color: 'border-blue-200 bg-blue-50 text-blue-800',
    })
  }
  if ((postsPublicados ?? 0) === 0) {
    insights.push({
      icon: FileText,
      title: 'Blog sem posts publicados',
      desc: 'Conteúdo melhora SEO e atrai tráfego orgânico.',
      color: 'border-violet-200 bg-violet-50 text-violet-800',
    })
  }
  if (insights.length === 0) {
    insights.push({
      icon: Star,
      title: 'Tudo bem por aqui!',
      desc: 'Plataforma operando normalmente.',
      color: 'border-green-200 bg-green-50 text-green-800',
    })
  }

  const TIPO_LABEL: Record<string, string> = { proprietario: 'Proprietário', corretor: 'Corretor', imobiliaria: 'Imobiliária' }
  const PLANO_COR: Record<string, string> = { free: 'bg-gray-100 text-gray-600', basico: 'bg-blue-100 text-blue-700', profissional: 'bg-violet-100 text-violet-700' }
  const STATUS_COR: Record<string, string> = { ativo: 'bg-green-100 text-green-700', pausado: 'bg-yellow-100 text-yellow-700', expirado: 'bg-red-100 text-red-600', rascunho: 'bg-gray-100 text-gray-600', alugado: 'bg-teal-100 text-teal-700' }
  const TIPO_IMOVEL: Record<string, string> = { apartamento: 'Apartamento', casa: 'Casa', kitnet: 'Kitnet', comercial: 'Comercial', terreno: 'Terreno' }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400">{agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* KPI Cards — linha 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Imóveis ativos" value={imoveisAtivos ?? 0}
          sub={`${imoveisMes ?? 0} novos este mês`} icon={Home}
          cor="text-violet-600" bg="bg-violet-50" delta={deltaImoveis} />
        <StatCard label="Visualizações de imóveis" value={totalViewsImoveis.toLocaleString('pt-BR')}
          sub="Soma de todos os anúncios" icon={Eye}
          cor="text-pink-600" bg="bg-pink-50" />
        <StatCard label="Visualizações no blog" value={totalViewsPosts.toLocaleString('pt-BR')}
          sub={`${postsPublicados ?? 0} posts publicados`} icon={FileText}
          cor="text-green-600" bg="bg-green-50" />
        <StatCard label="Usuários" value={totalUsuarios ?? 0}
          sub={`${usuariosMes ?? 0} cadastros este mês`} icon={Users}
          cor="text-blue-600" bg="bg-blue-50" delta={deltaUsuarios} />
      </div>

      {/* Envios — quota mensal */}
      {!enviosV18Faltando && (
        <Link
          href="/admin/envios"
          className={`block rounded-2xl border shadow-sm p-5 transition-colors ${
            pctEmail >= 95 || pctPush >= 95 ? 'bg-red-50 border-red-200 hover:bg-red-100'
            : pctEmail >= 80 || pctPush >= 80 ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
            : 'bg-white border-gray-100 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Envios este mês</h2>
            <span className="text-xs text-gray-500">ver detalhes →</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <MiniQuota label="E-mails (Hostinger)" usado={enviosEmailMes} quota={quotaEmail} pct={pctEmail} cor="violet" />
            <MiniQuota label="Pushes (VAPID)" usado={enviosPushMes} quota={quotaPush} pct={pctPush} cor="green" />
          </div>
        </Link>
      )}

      {/* Alertas operacionais */}
      {((imoveisSemFoto ?? 0) > 0 || (imoveisVencendo?.length ?? 0) > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {(imoveisVencendo?.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={16} className="text-amber-600" />
                <h2 className="font-semibold text-gray-900 text-sm">Vencendo nos próximos 7 dias</h2>
              </div>
              <div className="space-y-2">
                {imoveisVencendo!.map(im => {
                  const bairro = Array.isArray(im.bairro) ? im.bairro[0] : im.bairro
                  const dias = Math.ceil((new Date(im.expira_em).getTime() - agora.getTime()) / 86400000)
                  return (
                    <div key={im.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700 truncate">{im.titulo}</span>
                      <span className="text-amber-700 font-semibold shrink-0 ml-2">{dias}d</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(imoveisSemFoto ?? 0) > 0 && (
            <Link href="/admin/imoveis" className="bg-white rounded-2xl border border-red-200 shadow-sm p-5 hover:bg-red-50 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <Camera size={16} className="text-red-600" />
                <h2 className="font-semibold text-gray-900 text-sm">Imóveis ativos sem foto</h2>
              </div>
              <p className="text-3xl font-bold text-red-600 mb-1">{imoveisSemFoto ?? 0}</p>
              <p className="text-xs text-gray-500">Imóveis sem foto recebem ~80% menos visualizações.</p>
            </Link>
          )}
        </div>
      )}

      {/* Top 10 imóveis + Top 10 posts (side by side) */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Eye size={16} className="text-pink-600" /> Top 10 imóveis mais visualizados
          </h2>
          {topImoveis?.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum imóvel com visualizações ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {topImoveis?.map((im, i) => {
                const fotos = im.fotos as Array<{ url: string; principal?: boolean; ordem?: number }>
                const foto = fotos?.find(f => f.principal)?.url
                  ?? [...(fotos ?? [])].sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999))[0]?.url
                const bairroObj = Array.isArray(im.bairro) ? im.bairro[0] : im.bairro
                const url = im.slug && bairroObj?.slug
                  ? buildImovelUrl({ id: im.id, slug: im.slug, bairro: bairroObj } as unknown as Imovel)
                  : `/imoveis/${im.id}`
                return (
                  <Link key={im.id} href={url} target="_blank"
                    className="flex items-center gap-3 hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                    <span className="text-xs font-bold text-gray-400 w-5 text-center">{i + 1}</span>
                    <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                      {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-sm">🏠</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{im.titulo}</p>
                      <p className="text-xs text-gray-400 truncate">{bairroObj?.nome ?? '—'} · {formatarPreco(im.preco)}</p>
                    </div>
                    <span className="text-xs font-semibold text-pink-600 shrink-0 flex items-center gap-0.5">
                      <Eye size={11} /> {(im.visualizacoes ?? 0).toLocaleString('pt-BR')}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText size={16} className="text-green-600" /> Top 10 posts mais lidos
          </h2>
          {topPosts?.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum post com leituras ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {topPosts?.map((p, i) => (
                <Link key={p.id} href={`/blog/${p.slug}`} target="_blank"
                  className="flex items-center gap-3 hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                  <span className="text-xs font-bold text-gray-400 w-5 text-center">{i + 1}</span>
                  <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                    {p.capa_url ? <img src={p.capa_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-sm">📝</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.titulo}</p>
                    <p className="text-xs text-gray-400 truncate flex items-center gap-1"><Tag size={9} /> {p.categoria}</p>
                  </div>
                  <span className="text-xs font-semibold text-green-600 shrink-0 flex items-center gap-0.5">
                    <Eye size={11} /> {(p.visualizacoes ?? 0).toLocaleString('pt-BR')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bairros mais procurados + Top anunciantes */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin size={16} className="text-violet-600" /> Bairros mais procurados
          </h2>
          {topBairros.length === 0 ? (
            <p className="text-sm text-gray-400">Sem dados de visualização por bairro.</p>
          ) : (
            <div className="space-y-2.5">
              {topBairros.map((b, i) => {
                const maxViews = topBairros[0]?.views || 1
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-700 font-medium">{i + 1}. {b.nome}</span>
                      <span className="text-gray-500">
                        <span className="text-violet-600 font-semibold">{b.views.toLocaleString('pt-BR')}</span>
                        {' '}views · {b.qtd} imóveis
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full transition-all"
                        style={{ width: `${(b.views / maxViews) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users size={16} className="text-blue-600" /> Top anunciantes
          </h2>
          {topAnunciantesList.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum anunciante com imóveis ativos.</p>
          ) : (
            <div className="space-y-2.5">
              {topAnunciantesList.map((a, i) => {
                const initials = a.nome.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
                return (
                  <div key={a.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-5 text-center">{i + 1}</span>
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {initials || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.nome}</p>
                      <p className="text-xs text-gray-400">{TIPO_LABEL[a.tipo] ?? a.tipo}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-blue-600">{a.qtd}</p>
                      <p className="text-[10px] text-gray-400 -mt-0.5">imóveis</p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${PLANO_COR[a.plano] ?? ''}`}>
                      {a.plano}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Status + Planos + Tipos */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Home size={16} className="text-violet-600" /> Status dos imóveis
          </h2>
          <BarChart
            total={totalImoveis ?? 0}
            data={[
              { label: 'Ativos', value: imoveisAtivos ?? 0, color: 'bg-green-400' },
              { label: 'Pausados', value: imoveisPausados ?? 0, color: 'bg-yellow-400' },
              { label: 'Expirados', value: imoveisExpirados ?? 0, color: 'bg-red-400' },
              { label: 'Alugados', value: imoveisAlugados ?? 0, color: 'bg-teal-400' },
            ]}
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign size={16} className="text-blue-600" /> Distribuição de planos
          </h2>
          <BarChart
            total={totalUsuarios ?? 0}
            data={[
              { label: 'Gratuito', value: contPlanos.free ?? 0, color: 'bg-gray-400' },
              { label: 'Básico', value: contPlanos.basico ?? 0, color: 'bg-blue-400' },
              { label: 'Profissional', value: contPlanos.profissional ?? 0, color: 'bg-violet-500' },
            ]}
          />
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Receita estimada</p>
            <p className="text-xl font-bold text-gray-900">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                (contPlanos.basico ?? 0) * 49.90 + (contPlanos.profissional ?? 0) * 99.90
              )}
              <span className="text-xs font-normal text-gray-400">/mês</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity size={16} className="text-orange-600" /> Tipos de imóvel
          </h2>
          <BarChart
            total={totalImoveis ?? 0}
            data={Object.entries(contTipos).sort((a, b) => b[1] - a[1]).map(([tipo, val], i) => ({
              label: TIPO_IMOVEL[tipo] ?? tipo,
              value: val,
              color: ['bg-violet-400', 'bg-blue-400', 'bg-orange-400', 'bg-teal-400', 'bg-pink-400'][i % 5],
            }))}
          />
        </div>
      </div>

      {/* Insights */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-violet-600" /> Insights e recomendações
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {insights.map((ins, i) => (
            <InsightCard key={i} {...ins} />
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Últimos anúncios</h2>
            <Link href="/admin/imoveis" className="text-xs text-violet-600 hover:underline flex items-center gap-0.5">
              Ver todos <ChevronRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {recentImoveis?.length === 0 && <p className="text-sm text-gray-400">Nenhum anúncio ainda.</p>}
            {recentImoveis?.map(im => {
              const foto = (im.fotos as Array<{ url: string }>)?.[0]?.url
              const bairro = im.bairro as unknown as { nome: string } | null
              return (
                <div key={im.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                    {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg">🏠</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{im.titulo}</p>
                    <p className="text-xs text-gray-400">{bairro?.nome ?? '—'} · {formatarPreco(im.preco)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COR[im.status] ?? ''}`}>
                    {im.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Novos usuários</h2>
            <Link href="/admin/usuarios" className="text-xs text-violet-600 hover:underline flex items-center gap-0.5">
              Ver todos <ChevronRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {recentUsuarios?.length === 0 && <p className="text-sm text-gray-400">Nenhum usuário ainda.</p>}
            {recentUsuarios?.map(u => {
              const initials = u.nome?.split(' ').slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join('') ?? '?'
              return (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.nome ?? 'Sem nome'}</p>
                    <p className="text-xs text-gray-400">{TIPO_LABEL[u.tipo] ?? u.tipo} · {new Date(u.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${PLANO_COR[u.plano] ?? ''}`}>
                    {u.plano}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniQuota({ label, usado, quota, pct, cor }: {
  label: string; usado: number; quota: number; pct: number; cor: 'violet' | 'green'
}) {
  const barCor = pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : cor === 'violet' ? 'bg-violet-500' : 'bg-green-500'
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-700 font-medium">{label}</span>
        <span className="text-gray-500"><strong className="text-gray-900">{usado.toLocaleString('pt-BR')}</strong> / {quota.toLocaleString('pt-BR')} ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${barCor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
