import { createAdminClient } from '@/lib/supabase/admin'
import { formatarPreco } from '@/lib/utils'
import {
  Home, Users, FileText, TrendingUp, AlertTriangle,
  ArrowUp, ArrowDown, Minus, Activity, DollarSign,
  Clock, Eye, Star, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'

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
    { data: recentImoveis },
    { data: recentUsuarios },
    { data: planosDist },
    { data: tiposDist },
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
    supabase.from('imoveis')
      .select('id, titulo, preco, status, created_at, bairro:bairros(nome), fotos(url)')
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('perfis')
      .select('id, nome, tipo, plano, created_at')
      .order('created_at', { ascending: false }).limit(6),
    supabase.from('perfis').select('plano'),
    supabase.from('imoveis').select('tipo'),
  ])

  // Percentual de crescimento mês a mês
  const deltaImoveis = imoveisUltimoMes
    ? Math.round((((imoveisMes ?? 0) - imoveisUltimoMes) / imoveisUltimoMes) * 100)
    : 0
  const deltaUsuarios = usuariosUltimoMes
    ? Math.round((((usuariosMes ?? 0) - usuariosUltimoMes) / usuariosUltimoMes) * 100)
    : 0

  const taxaAtivacao = totalImoveis ? Math.round(((imoveisAtivos ?? 0) / totalImoveis) * 100) : 0

  // Distribuição de planos
  const contPlanos: Record<string, number> = {}
  planosDist?.forEach(r => { contPlanos[r.plano] = (contPlanos[r.plano] ?? 0) + 1 })

  // Distribuição de tipos de imóvel
  const contTipos: Record<string, number> = {}
  tiposDist?.forEach(r => { contTipos[r.tipo] = (contTipos[r.tipo] ?? 0) + 1 })

  // Insights / recomendações
  const insights: Array<{ icon: React.ElementType; title: string; desc: string; color: string }> = []

  if ((imoveisExpirados ?? 0) > 3) {
    insights.push({
      icon: Clock,
      title: `${imoveisExpirados} anúncios expirados`,
      desc: 'Considere contatar os anunciantes para renovação ou limpeza do banco.',
      color: 'border-orange-200 bg-orange-50 text-orange-800',
    })
  }
  if (taxaAtivacao < 60) {
    insights.push({
      icon: Activity,
      title: `Taxa de ativação baixa (${taxaAtivacao}%)`,
      desc: 'Menos da metade dos imóveis está ativa. Campanha de engajamento pode ajudar.',
      color: 'border-red-200 bg-red-50 text-red-800',
    })
  }
  if ((imoveisMes ?? 0) > (imoveisUltimoMes ?? 0)) {
    insights.push({
      icon: TrendingUp,
      title: 'Crescimento de anúncios este mês',
      desc: `+${(imoveisMes ?? 0) - (imoveisUltimoMes ?? 0)} anúncios vs. mês anterior. Plataforma em expansão.`,
      color: 'border-green-200 bg-green-50 text-green-800',
    })
  }
  if ((contPlanos.free ?? 0) > (totalUsuarios ?? 0) * 0.8) {
    insights.push({
      icon: DollarSign,
      title: 'Maioria no plano gratuito',
      desc: 'Mais de 80% dos usuários são free. Oportunidade de conversão para planos pagos.',
      color: 'border-blue-200 bg-blue-50 text-blue-800',
    })
  }
  if ((postsPublicados ?? 0) === 0) {
    insights.push({
      icon: FileText,
      title: 'Blog sem posts publicados',
      desc: 'Conteúdo de blog melhora SEO e atrai tráfego orgânico. Crie o primeiro artigo.',
      color: 'border-violet-200 bg-violet-50 text-violet-800',
    })
  }
  if (insights.length === 0) {
    insights.push({
      icon: Star,
      title: 'Tudo bem por aqui!',
      desc: 'Plataforma operando normalmente. Continue monitorando as métricas.',
      color: 'border-green-200 bg-green-50 text-green-800',
    })
  }

  const TIPO_LABEL: Record<string, string> = { proprietario: 'Proprietário', corretor: 'Corretor', imobiliaria: 'Imobiliária' }
  const PLANO_COR: Record<string, string> = { free: 'bg-gray-100 text-gray-600', basico: 'bg-blue-100 text-blue-700', profissional: 'bg-violet-100 text-violet-700' }
  const STATUS_COR: Record<string, string> = { ativo: 'bg-green-100 text-green-700', pausado: 'bg-yellow-100 text-yellow-700', expirado: 'bg-red-100 text-red-600', rascunho: 'bg-gray-100 text-gray-600', alugado: 'bg-teal-100 text-teal-700' }
  const TIPO_IMOVEL: Record<string, string> = { apartamento: 'Apartamento', casa: 'Casa', kitnet: 'Kitnet', comercial: 'Comercial', terreno: 'Terreno' }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400">{agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total de Imóveis" value={totalImoveis ?? 0}
          sub={`${imoveisMes ?? 0} novos este mês`} icon={Home}
          cor="text-violet-600" bg="bg-violet-50" delta={deltaImoveis} />
        <StatCard label="Usuários" value={totalUsuarios ?? 0}
          sub={`${usuariosMes ?? 0} cadastros este mês`} icon={Users}
          cor="text-blue-600" bg="bg-blue-50" delta={deltaUsuarios} />
        <StatCard label="Posts no Blog" value={postsPublicados ?? 0}
          sub={`${totalPosts ?? 0} total (incluindo rascunhos)`} icon={FileText}
          cor="text-green-600" bg="bg-green-50" />
        <StatCard label="Taxa de Ativação" value={taxaAtivacao}
          sub={`${imoveisAtivos ?? 0} ativos de ${totalImoveis ?? 0}`} icon={TrendingUp}
          cor="text-orange-600" bg="bg-orange-50" sufixo="%" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">

        {/* Status dos imóveis */}
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

        {/* Planos dos usuários */}
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

        {/* Tipos de imóvel */}
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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Eye size={16} className="text-violet-600" /> Insights e recomendações
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {insights.map((ins, i) => (
            <InsightCard key={i} {...ins} />
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Últimos anúncios */}
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

        {/* Novos usuários */}
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
