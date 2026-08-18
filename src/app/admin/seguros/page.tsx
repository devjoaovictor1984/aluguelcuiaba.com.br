import Link from 'next/link'
import {
  ShieldCheck, Flame, UserCheck, Activity, AlertTriangle, CheckCircle2,
  Wallet, ArrowRight, FlaskConical, Building2,
} from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  JANELA_DIAS, resumoDoMes, saudeIntegracao, volumePorCorretor,
} from '@/lib/seguros/admin/metricas'
import { formatarBRL } from '@/lib/formatters'
import { PRO_LABORE_PADRAO } from '@/lib/seguros/incendio/sugestoes'
import { UrlsWebhook } from './_components/urls-webhook'

export const metadata = { title: 'Seguros — admin' }
export const dynamic = 'force-dynamic'

/**
 * Painel da parceria com a corretora.
 *
 * Responde três perguntas que o painel do corretor não responde:
 * quanto a plataforma originou, para quem, e a integração está de pé.
 */
export default async function AdminSegurosPage() {
  const admin = createAdminClient()

  const [resumo, corretores, saude] = await Promise.all([
    resumoDoMes(admin),
    volumePorCorretor(admin),
    saudeIntegracao(admin),
  ])

  const ambiente = process.env.MAXIMIZA_AMBIENTE
  const demo = process.env.MAXIMIZA_DEMO === '1'
  const temCredencial = !!process.env.MAXIMIZA_EMAIL && !!process.env.MAXIMIZA_SENHA
  const segredoWebhook = process.env.MAXIMIZA_WEBHOOK_SEGREDO
  const temWebhook = !!segredoWebhook

  /**
   * O domínio é fixo, e não `NEXT_PUBLIC_APP_URL`, porque a URL que a
   * corretora cadastra é sempre a pública — mesmo que esta página esteja
   * sendo aberta de uma máquina de desenvolvimento.
   */
  const urlsWebhook = ['analise', 'biometria', 'arquivos'].map(evento => ({
    evento,
    url: `https://www.aluguelcuiaba.com.br/api/webhooks/maximiza/${segredoWebhook}/${evento}`,
  }))

  const ativos = corretores.filter(c => c.premioTotal > 0 || c.fiancaAnalises > 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Seguros</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Parceria Maximiza — fiança e incêndio originados pela plataforma.
        </p>
      </div>

      {/* Estado da integração — o primeiro que precisa ser lido */}
      <section className={`rounded-2xl px-4 py-3.5 ring-1 ${
        demo ? 'bg-amber-50 ring-amber-200'
          : temCredencial ? 'bg-emerald-50 ring-emerald-200'
          : 'bg-gray-50 ring-gray-200'
      }`}>
        <div className="flex items-start gap-2.5">
          {demo
            ? <FlaskConical size={17} className="text-amber-600 shrink-0 mt-0.5" />
            : temCredencial
              ? <CheckCircle2 size={17} className="text-emerald-600 shrink-0 mt-0.5" />
              : <AlertTriangle size={17} className="text-gray-500 shrink-0 mt-0.5" />}
          <div className="min-w-0">
            <p className={`text-sm font-bold ${
              demo ? 'text-amber-900' : temCredencial ? 'text-emerald-900' : 'text-gray-800'
            }`}>
              {demo
                ? 'Modo demonstração — respostas simuladas'
                : temCredencial
                  ? `Integração ligada · ambiente ${ambiente === '1' ? 'PRODUÇÃO' : 'homologação'}`
                  : 'Credencial de API pendente'}
            </p>
            <p className={`text-xs mt-0.5 ${
              demo ? 'text-amber-800' : temCredencial ? 'text-emerald-800' : 'text-gray-600'
            }`}>
              {demo
                ? 'Nenhuma apólice é emitida de verdade. Remova MAXIMIZA_DEMO quando a credencial chegar.'
                : temCredencial
                  ? `Webhook ${temWebhook ? 'configurado' : 'SEM segredo — configure MAXIMIZA_WEBHOOK_SEGREDO'}.`
                  : 'A credencial do painel não serve para a API. Peça uma credencial de integrador à Maximiza.'}
            </p>
          </div>
        </div>
      </section>

      {/* Números do mês */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Cartao
          icone={<UserCheck size={14} />}
          rotulo="Análises de fiança"
          valor={String(resumo.fianca.analises)}
          nota={`${resumo.fianca.aprovadas} aprovada(s)`}
          cor="violet"
        />
        <Cartao
          icone={<ShieldCheck size={14} />}
          rotulo="Fiança contratada"
          valor={String(resumo.fianca.contratadas)}
          nota={formatarBRL(resumo.fianca.premioTotal)}
          cor="violet"
        />
        <Cartao
          icone={<Flame size={14} />}
          rotulo="Incêndio contratado"
          valor={String(resumo.incendio.contratadas)}
          nota={formatarBRL(resumo.incendio.premioTotal)}
          cor="orange"
        />
        <Cartao
          icone={<Wallet size={14} />}
          rotulo="Base de comissão"
          valor={formatarBRL(resumo.overrideEstimado)}
          nota={`ref. ${Math.round(PRO_LABORE_PADRAO * 100)}% do prêmio`}
          cor="emerald"
        />
      </section>

      <p className="text-[11px] text-gray-400 -mt-2">
        Últimos {JANELA_DIAS} dias. A <strong>base de comissão</strong> é
        referência de negociação, não valor a receber — a tabela da corretora
        ainda não está definida (item 2.5 do documento de pendências). Para
        conciliar por competência, use as faturas do incêndio.
      </p>

      {/* Saúde */}
      <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mb-3">
          <Activity size={15} className="text-gray-400" /> Integração nas últimas 24h
        </h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-black text-gray-900 tabular-nums">{saude.chamadas24h}</p>
            <p className="text-[11px] text-gray-500">chamadas</p>
          </div>
          <div>
            <p className={`text-xl font-black tabular-nums ${saude.erros24h > 0 ? 'text-rose-600' : 'text-gray-900'}`}>
              {saude.erros24h}
            </p>
            <p className="text-[11px] text-gray-500">com erro</p>
          </div>
          <div>
            <p className="text-xl font-black text-gray-900 tabular-nums">{saude.webhooks24h}</p>
            <p className="text-[11px] text-gray-500">webhooks</p>
          </div>
        </div>

        {saude.ultimoErro && (
          <div className="mt-3 rounded-xl bg-rose-50 ring-1 ring-rose-100 px-3 py-2">
            <p className="text-[11px] font-bold text-rose-800">
              Último erro · {saude.ultimoErro.endpoint}
            </p>
            <p className="text-[11px] text-rose-700 line-clamp-2">{saude.ultimoErro.erro}</p>
            <p className="text-[10px] text-rose-600 mt-0.5">
              {new Date(saude.ultimoErro.em).toLocaleString('pt-BR')}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <p className="text-[11px] text-gray-400">
            {saude.ultimoEvento
              ? `Última atividade em ${new Date(saude.ultimoEvento).toLocaleString('pt-BR')}`
              : 'Nenhuma atividade registrada'}
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/seguros/comissoes"
              className="text-xs font-semibold text-violet-700 hover:text-violet-800 flex items-center gap-1"
            >
              Comissões <ArrowRight size={12} />
            </Link>
            <Link
              href="/admin/seguros/eventos"
              className="text-xs font-semibold text-violet-700 hover:text-violet-800 flex items-center gap-1"
            >
              Ver log <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </section>

      {/* Volume por corretor — a base do override */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Building2 size={15} className="text-gray-400" /> Volume por corretor
          </h2>
          <span className="text-[11px] text-gray-400">{ativos.length} com movimento</span>
        </div>

        {ativos.length === 0 ? (
          <div className="rounded-2xl bg-white ring-1 ring-gray-100 p-8 text-center">
            <p className="text-sm text-gray-500">
              Nenhum corretor originou seguro ainda.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white ring-1 ring-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-bold">Corretor</th>
                    <th className="text-center px-3 py-2.5 font-bold">Fiança</th>
                    <th className="text-center px-3 py-2.5 font-bold">Incêndio</th>
                    <th className="text-right px-4 py-2.5 font-bold">Prêmio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ativos.map(c => (
                    <tr key={c.userId}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900 truncate max-w-[180px]">
                          {c.nome ?? 'Sem nome'}
                        </p>
                        <p className="text-[11px] text-gray-400 tabular-nums">
                          {c.cnpjCpf ?? 'não provisionado na corretora'}
                        </p>
                      </td>
                      <td className="text-center px-3 py-3 text-xs text-gray-600 tabular-nums">
                        <span className="font-bold text-gray-900">{c.fiancaContratadas}</span>
                        {c.fiancaAnalises > 0 && (
                          <span className="text-gray-400"> / {c.fiancaAnalises}</span>
                        )}
                      </td>
                      <td className="text-center px-3 py-3 text-xs text-gray-600 tabular-nums">
                        <span className="font-bold text-gray-900">{c.incendioContratadas}</span>
                        {c.incendioCotacoes > 0 && (
                          <span className="text-gray-400"> / {c.incendioCotacoes}</span>
                        )}
                      </td>
                      <td className="text-right px-4 py-3">
                        <p className="font-bold text-gray-900 tabular-nums">
                          {formatarBRL(c.premioTotal)}
                        </p>
                        {c.premioTotal > 0 && (
                          <p className="text-[11px] text-emerald-700 tabular-nums">
                            +{formatarBRL(c.premioTotal * PRO_LABORE_PADRAO)}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-[11px] text-gray-400">
          Contratadas / cotadas. Esta é a base de conferência do override — cada
          corretor recebe a comissão dele, e a plataforma recebe sobre o volume
          originado aqui.
        </p>
      </section>

      {/* O que a corretora precisa cadastrar do lado dela */}
      {temWebhook && <UrlsWebhook urls={urlsWebhook} />}

      {/* Configuração — leitura, porque vive em variável de ambiente */}
      <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Configuração</h2>
        <dl className="space-y-2 text-sm">
          <Config rotulo="Ambiente" valor={
            ambiente === '1' ? 'Produção' : ambiente === '2' ? 'Homologação' : 'não definido'
          } alerta={ambiente !== '1' && ambiente !== '2'} />
          <Config rotulo="Credencial de API" valor={temCredencial ? 'configurada' : 'pendente'} alerta={!temCredencial} />
          <Config rotulo="Segredo do webhook" valor={temWebhook ? 'configurado' : 'pendente'} alerta={!temWebhook} />
          <Config rotulo="Simulador" valor={demo ? 'ligado' : 'desligado'} alerta={demo} />
        </dl>
        <p className="text-[11px] text-gray-400 mt-3 pt-3 border-t border-gray-50">
          Definido por variável de ambiente, não pelo painel — credencial de
          seguradora não deve ficar no banco.
        </p>
      </section>
    </div>
  )
}

function Cartao({ icone, rotulo, valor, nota, cor }: {
  icone: React.ReactNode
  rotulo: string
  valor: string
  nota: string
  cor: 'violet' | 'orange' | 'emerald'
}) {
  const cls = {
    violet: 'bg-violet-50 text-violet-700',
    orange: 'bg-orange-50 text-orange-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }[cor]

  return (
    <div className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-3.5">
      <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold ${cls}`}>
        {icone} {rotulo}
      </span>
      <p className="text-2xl font-black text-gray-900 tabular-nums mt-1.5 leading-none">{valor}</p>
      <p className="text-[11px] text-gray-500 mt-1">{nota}</p>
    </div>
  )
}

function Config({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-600">{rotulo}</dt>
      <dd className={`text-xs font-bold px-2 py-1 rounded-lg ${
        alerta ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-700'
      }`}>
        {valor}
      </dd>
    </div>
  )
}
