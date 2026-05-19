import Link from 'next/link'
import { Mail, Bell, CheckCircle2, AlertCircle, XCircle, Filter, BarChart3 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ tipo?: string; canal?: string; status?: string }>
}

interface EnvioRow {
  id: string
  tipo: 'email' | 'push'
  canal: string | null
  destinatario: string | null
  status: 'ok' | 'erro' | 'morta'
  erro_msg: string | null
  contexto: Record<string, unknown> | null
  created_at: string
}

const STATUS_COR: Record<string, string> = {
  ok: 'bg-green-100 text-green-700',
  erro: 'bg-red-100 text-red-700',
  morta: 'bg-gray-100 text-gray-600',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  ok: <CheckCircle2 size={11} />,
  erro: <XCircle size={11} />,
  morta: <AlertCircle size={11} />,
}

const CANAL_LABEL: Record<string, string> = {
  boas_vindas: 'Boas-vindas',
  aviso_vencimento: 'Aviso vencimento (anúncio)',
  aviso_aluguel: 'Aviso aluguel (CRM)',
  anuncio_parado_30d: 'Anúncio parado 30d',
  anuncio_parado_60d: 'Anúncio parado 60d',
  novo_imovel: 'Novo imóvel',
  admin_teste: 'Admin teste',
  broadcast: 'Broadcast',
}

export default async function AdminEnviosPage({ searchParams }: Props) {
  const admin = createAdminClient()
  const sp = await searchParams
  const filtroTipo = sp.tipo === 'email' || sp.tipo === 'push' ? sp.tipo : null
  const filtroCanal = sp.canal ?? null
  const filtroStatus = sp.status === 'ok' || sp.status === 'erro' || sp.status === 'morta' ? sp.status : null

  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()
  const inicio24h = new Date(agora.getTime() - 24 * 3600 * 1000).toISOString()

  // Agregados (resilientes a v18 não rodada)
  const aggQueries = await Promise.all([
    admin.from('envios_log').select('id', { count: 'exact', head: true }).eq('tipo', 'email').gte('created_at', inicioMes),
    admin.from('envios_log').select('id', { count: 'exact', head: true }).eq('tipo', 'push').gte('created_at', inicioMes),
    admin.from('envios_log').select('id', { count: 'exact', head: true }).eq('tipo', 'email').gte('created_at', inicio24h),
    admin.from('envios_log').select('id', { count: 'exact', head: true }).eq('tipo', 'push').gte('created_at', inicio24h),
    admin.from('envios_log').select('id', { count: 'exact', head: true }).eq('status', 'erro').gte('created_at', inicioMes),
    admin.from('envios_log').select('canal').gte('created_at', inicioMes).limit(5000),
  ])
  const v18Faltando = !!aggQueries[0].error
  const emailMes = aggQueries[0].count ?? 0
  const pushMes = aggQueries[1].count ?? 0
  const email24h = aggQueries[2].count ?? 0
  const push24h = aggQueries[3].count ?? 0
  const errosMes = aggQueries[4].count ?? 0
  const canalRaw = (aggQueries[5].data ?? []) as Array<{ canal: string | null }>
  const porCanal: Record<string, number> = {}
  for (const r of canalRaw) {
    const k = r.canal ?? '(sem canal)'
    porCanal[k] = (porCanal[k] ?? 0) + 1
  }

  // Quotas configuráveis
  const { data: cfgRows } = await admin
    .from('site_config').select('chave, valor')
    .in('chave', ['quota_email_mensal', 'quota_push_mensal'])
  const cfg = Object.fromEntries((cfgRows ?? []).map(c => [c.chave, c.valor ?? '']))
  const quotaEmail = parseInt(cfg.quota_email_mensal ?? '1000') || 1000
  const quotaPush = parseInt(cfg.quota_push_mensal ?? '100000') || 100000

  // Lista paginada (últimos 100 com filtros)
  let q = admin.from('envios_log').select('*').order('created_at', { ascending: false }).limit(100)
  if (filtroTipo) q = q.eq('tipo', filtroTipo)
  if (filtroCanal) q = q.eq('canal', filtroCanal)
  if (filtroStatus) q = q.eq('status', filtroStatus)
  const { data: lista } = v18Faltando ? { data: [] as EnvioRow[] } : await q
  const envios = (lista ?? []) as EnvioRow[]

  const fazerLink = (k: 'tipo' | 'canal' | 'status', v: string | null) => {
    const params = new URLSearchParams()
    if (filtroTipo && k !== 'tipo') params.set('tipo', filtroTipo)
    if (filtroCanal && k !== 'canal') params.set('canal', filtroCanal)
    if (filtroStatus && k !== 'status') params.set('status', filtroStatus)
    if (v) params.set(k, v)
    const qs = params.toString()
    return qs ? `/admin/envios?${qs}` : '/admin/envios'
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 size={22} className="text-violet-600" /> Envios
        </h1>
        <p className="text-sm text-gray-500">Log de todos os e-mails e pushes enviados pelo sistema. Auditoria + controle de quota.</p>
      </div>

      {v18Faltando && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
          ⚠️ Rode <code className="bg-white px-1 rounded">supabase/migrations/crm_v18_envios_log.sql</code> pra começar a logar.
        </div>
      )}

      {/* Quotas */}
      <div className="grid sm:grid-cols-2 gap-4">
        <QuotaCard
          tipo="email"
          icon={<Mail size={16} />}
          cor="violet"
          usado={emailMes}
          quota={quotaEmail}
          ultimas24h={email24h}
          subtitulo="Hostinger SMTP — limite aproximado 1000/dia"
        />
        <QuotaCard
          tipo="push"
          icon={<Bell size={16} />}
          cor="green"
          usado={pushMes}
          quota={quotaPush}
          ultimas24h={push24h}
          subtitulo="Web Push (VAPID) — virtualmente ilimitado"
        />
      </div>

      {/* Por canal */}
      {Object.keys(porCanal).length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Filter size={14} /> Por canal — mês atual
          </h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {Object.entries(porCanal).sort((a, b) => b[1] - a[1]).map(([canal, qtd]) => (
              <Link
                key={canal}
                href={fazerLink('canal', canal === '(sem canal)' ? null : canal)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs hover:bg-gray-50 ${
                  filtroCanal === canal ? 'border-violet-300 bg-violet-50' : 'border-gray-100'
                }`}
              >
                <span className="text-gray-700">{CANAL_LABEL[canal] ?? canal}</span>
                <span className="font-bold text-gray-900">{qtd}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {errosMes > 0 && (
        <Link href={fazerLink('status', 'erro')} className="block bg-red-50 border border-red-200 rounded-2xl p-4 hover:bg-red-100 transition-colors">
          <p className="text-sm font-semibold text-red-900 flex items-center gap-2">
            <XCircle size={15} /> {errosMes} envios falharam este mês
          </p>
          <p className="text-xs text-red-700 mt-0.5">Clique pra filtrar e ver os erros →</p>
        </Link>
      )}

      {/* Filtros ativos */}
      {(filtroTipo || filtroCanal || filtroStatus) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500">Filtros:</span>
          {filtroTipo && <Chip label={`tipo: ${filtroTipo}`} href={fazerLink('tipo', null)} />}
          {filtroCanal && <Chip label={`canal: ${CANAL_LABEL[filtroCanal] ?? filtroCanal}`} href={fazerLink('canal', null)} />}
          {filtroStatus && <Chip label={`status: ${filtroStatus}`} href={fazerLink('status', null)} />}
          <Link href="/admin/envios" className="text-violet-700 hover:underline">limpar tudo</Link>
        </div>
      )}

      {/* Lista */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Últimos envios</h2>
          <p className="text-xs text-gray-400">{envios.length} resultado{envios.length === 1 ? '' : 's'}</p>
        </div>
        {envios.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">
            {v18Faltando ? 'Migration pendente.' : 'Nenhum envio com os filtros atuais.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2">Quando</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Canal</th>
                  <th className="px-4 py-2">Destinatário</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Erro</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {envios.map(e => (
                  <tr key={e.id} className="border-t border-gray-50">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        e.tipo === 'email' ? 'bg-violet-100 text-violet-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {e.tipo === 'email' ? <Mail size={10} /> : <Bell size={10} />}
                        {e.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{CANAL_LABEL[e.canal ?? ''] ?? e.canal ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-[11px] text-gray-600 max-w-[280px] truncate">{e.destinatario ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COR[e.status]}`}>
                        {STATUS_ICON[e.status]} {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-red-700 max-w-[260px] truncate">{e.erro_msg ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[11px] text-gray-400 text-center">
        Quotas mensais configuráveis em <code className="bg-gray-100 px-1 rounded">site_config</code>: <code>quota_email_mensal</code>, <code>quota_push_mensal</code>.
      </p>
    </div>
  )
}

function QuotaCard({
  tipo, icon, cor, usado, quota, ultimas24h, subtitulo,
}: {
  tipo: 'email' | 'push'
  icon: React.ReactNode
  cor: 'violet' | 'green'
  usado: number
  quota: number
  ultimas24h: number
  subtitulo: string
}) {
  const pct = quota > 0 ? Math.min(100, Math.round((usado / quota) * 100)) : 0
  const alerta = pct >= 95 ? 'red' : pct >= 80 ? 'amber' : 'green'
  const barCor = { red: 'bg-red-500', amber: 'bg-amber-500', green: cor === 'violet' ? 'bg-violet-500' : 'bg-green-500' }[alerta]
  const bgCor = { red: 'bg-red-50 border-red-200', amber: 'bg-amber-50 border-amber-200', green: 'bg-white border-gray-100' }[alerta]
  const labelCor = { red: 'text-red-700', amber: 'text-amber-700', green: cor === 'violet' ? 'text-violet-700' : 'text-green-700' }[alerta]

  return (
    <div className={`rounded-2xl border shadow-sm p-5 ${bgCor}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-2 text-sm font-semibold ${labelCor}`}>
          {icon} {tipo === 'email' ? 'E-mails' : 'Pushes'} no mês
        </div>
        {alerta !== 'green' && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            alerta === 'red' ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
          }`}>
            {alerta === 'red' ? 'CRÍTICO' : 'ALERTA'}
          </span>
        )}
      </div>
      <p className="text-3xl font-extrabold text-gray-900">{usado.toLocaleString('pt-BR')}<span className="text-sm font-normal text-gray-400"> / {quota.toLocaleString('pt-BR')}</span></p>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden my-3">
        <div className={`h-full ${barCor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{pct}% da quota</span>
        <span>últimas 24h: <strong className="text-gray-700">{ultimas24h}</strong></span>
      </div>
      <p className="text-[11px] text-gray-400 mt-2">{subtitulo}</p>
    </div>
  )
}

function Chip({ label, href }: { label: string; href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 hover:bg-violet-200 px-2 py-0.5 rounded-full">
      {label} <span className="text-violet-500">×</span>
    </Link>
  )
}
