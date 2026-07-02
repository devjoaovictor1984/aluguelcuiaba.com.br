import Link from 'next/link'
import {
  Wallet, AlertTriangle, Clock, CheckCircle2, TrendingUp, Shield, FileSignature,
  Calendar, ArrowRight, DollarSign, User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { formatarBRL, formatarData } from '@/lib/formatters'
import { TabelaMes, type LinhaParcela } from './_components/tabela-mes'
import { SeletorMes } from './_components/seletor-mes'
import { BotaoAjuda } from '@/components/botao-ajuda'

const MESES_NOMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

interface PessoaLite {
  id: string
  nome: string
  telefone: string | null
}

interface BairroLite {
  nome: string
}

interface ImovelLite {
  id: string
  titulo: string
  bairro: BairroLite | BairroLite[] | null
}

interface ContratoLite {
  id: string
  codigo: string
  status: string
  data_termino: string | null
  data_proximo_reajuste: string | null
  seguro_incendio_data: string | null
  valor_seguro_incendio_anual: number | null
  valor_aluguel: number
  pagamento_antecipado: boolean | null
  inquilino: PessoaLite | PessoaLite[] | null
  imovel: ImovelLite | ImovelLite[] | null
}

interface ParcelaCompleta {
  id: string
  contrato_id: string
  numero: number
  mes_referencia: string
  vencimento: string
  valor_total: number
  valor_aluguel: number
  valor_repasse_proprietario: number
  status_pagamento: string
  status_repasse: string
  status_seguro: string
  boleto_enviado: boolean | null
  data_pagamento: string | null
  valor_pago: number | null
  contrato: ContratoLite | ContratoLite[] | null
}

interface ParcelaView {
  id: string
  numero: number
  contratoId: string
  contratoCodigo: string
  inquilino: string
  inquilinoTelefone: string | null
  imovel: string
  bairro: string | null
  vencimento: string
  // Data usada pra agrupar no mês. Normalmente = vencimento; para contrato
  // pago à vista, a parcela paga é agrupada pela data do pagamento (aparece
  // no mês em que foi recebida e some dos meses seguintes).
  refMes: string
  valor: number
  repasse: number
  status: string
  statusRepasse: string
  statusSeguro: string
  boletoEnviado: boolean | null
  diasAteVenc: number
  pago: boolean
  dataPagamento: string | null
  valorPago: number | null
}

function diasEntre(de: Date, ate: Date): number {
  const ms = ate.getTime() - de.getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

interface Props {
  searchParams: Promise<{ mes?: string; ano?: string }>
}

export default async function InicioCRMPage({ searchParams }: Props) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const hoje = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')
  const mesHoje = hoje.getMonth() + 1
  const anoHoje = hoje.getFullYear()

  // Mês/ano alvo (default = hoje)
  const sp = await searchParams
  const mesParam = parseInt(sp.mes ?? '')
  const anoParam = parseInt(sp.ano ?? '')
  const mesAlvo = (mesParam >= 1 && mesParam <= 12) ? mesParam : mesHoje
  const anoAlvo = Number.isFinite(anoParam) && anoParam > 1900 ? anoParam : anoHoje
  const ehMesAtual = mesAlvo === mesHoje && anoAlvo === anoHoje

  // Aliases retrocompatíveis com o resto do arquivo
  const mesAtual = mesAlvo
  const anoAtual = anoAlvo
  const inicioMes = new Date(anoAlvo, mesAlvo - 1, 1)
  const fimMes = new Date(anoAlvo, mesAlvo, 0, 23, 59, 59)

  // Janelas de aviso
  const em5Dias = new Date(hoje.getTime() + 5 * 86400000)
  const em30Dias = new Date(hoje.getTime() + 30 * 86400000)
  const em60Dias = new Date(hoje.getTime() + 60 * 86400000)

  // Carrega tudo
  const [{ data: parcelasRaw }, { data: perfil }] = await Promise.all([
    supabase
      .from('parcelas_aluguel')
      .select(`
        id, contrato_id, numero, mes_referencia, vencimento,
        valor_total, valor_aluguel, valor_repasse_proprietario,
        status_pagamento, status_repasse, status_seguro, boleto_enviado,
        data_pagamento, valor_pago,
        contrato:contratos_locacao!inner(
          id, codigo, status, data_termino, data_proximo_reajuste,
          seguro_incendio_data, valor_seguro_incendio_anual, valor_aluguel,
          pagamento_antecipado,
          inquilino:pessoas!inquilino_id(id, nome, telefone),
          imovel:imoveis(id, titulo, bairro:bairros(nome))
        )
      `)
      .eq('contrato.user_id', acesso.userId)
      .is('contrato.deleted_at', null),
    supabase
      .from('perfis')
      .select('nome')
      .eq('id', acesso.userId)
      .single(),
  ])
  const anuncianteNome = perfil?.nome ?? 'Imobiliária'

  const parcelas = (parcelasRaw ?? []) as ParcelaCompleta[]

  // Converte pra view-friendly
  const todas: ParcelaView[] = parcelas.map(p => {
    const c = unwrap(p.contrato)!
    const inq = unwrap(c.inquilino)
    const imo = unwrap(c.imovel)
    const bairro = imo && unwrap(imo.bairro)
    const venc = new Date(p.vencimento + 'T00:00:00')
    const pago = p.status_pagamento === 'pago'
    // À vista: parcela paga é agrupada pela data do pagamento (regime de caixa,
    // igual ao Financeiro). Assim entra no mês em que foi recebida e não reaparece
    // nos meses de vencimento seguintes. Contrato mensal segue pelo vencimento.
    const refMes = (c.pagamento_antecipado && pago && p.data_pagamento)
      ? p.data_pagamento.slice(0, 10)
      : p.vencimento
    return {
      id: p.id,
      numero: p.numero,
      contratoId: c.id,
      contratoCodigo: c.codigo,
      inquilino: inq?.nome ?? '—',
      inquilinoTelefone: inq?.telefone ?? null,
      imovel: imo?.titulo ?? '—',
      bairro: bairro?.nome ?? null,
      vencimento: p.vencimento,
      refMes,
      valor: p.valor_total,
      repasse: p.valor_repasse_proprietario ?? 0,
      status: p.status_pagamento,
      statusRepasse: p.status_repasse,
      statusSeguro: p.status_seguro,
      boletoEnviado: p.boleto_enviado,
      diasAteVenc: diasEntre(hoje, venc),
      pago: p.status_pagamento === 'pago',
      dataPagamento: p.data_pagamento,
      valorPago: p.valor_pago,
    }
  })

  // ───── Aluguéis do mês corrente ─────
  const doMes = todas.filter(p => {
    const ref = new Date(p.refMes + 'T00:00:00')
    return ref >= inicioMes && ref <= fimMes
  }).sort((a, b) => a.vencimento.localeCompare(b.vencimento))

  // ───── Atrasados (qualquer mês anterior, não pagos) ─────
  const atrasadas = todas
    .filter(p => !p.pago && new Date(p.vencimento + 'T00:00:00') < inicioMes)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))

  // ───── Atrasadas do mês corrente (já passaram do dia) ─────
  const atrasadasMes = doMes.filter(p => !p.pago && p.diasAteVenc < 0)

  // ───── Vencendo em 5 dias ─────
  const vencendoEm5 = todas
    .filter(p => !p.pago && p.diasAteVenc >= 0 && p.diasAteVenc <= 5)
    .sort((a, b) => a.diasAteVenc - b.diasAteVenc)

  // KPIs
  const totalDoMes = doMes.reduce((s, p) => s + p.valor, 0)
  const recebidoDoMes = doMes.filter(p => p.pago).reduce((s, p) => s + (p.valorPago ?? p.valor), 0)
  const aReceberDoMes = doMes.filter(p => !p.pago).reduce((s, p) => s + p.valor, 0)
  const totalAtrasado = atrasadas.reduce((s, p) => s + p.valor, 0)

  // Estratégico: contratos vencendo, reajustes, seguros incêndio
  const contratosUnicos = new Map<string, ContratoLite>()
  for (const p of parcelas) {
    const c = unwrap(p.contrato)
    if (c && c.status === 'ativo' && !contratosUnicos.has(c.id)) contratosUnicos.set(c.id, c)
  }
  const contratosLista: ContratoLite[] = Array.from(contratosUnicos.values())

  const contratosVencendo = contratosLista
    .filter(c => c.data_termino && new Date(c.data_termino) <= em60Dias && new Date(c.data_termino) >= hoje)
    .map(c => ({ ...c, diasRestantes: diasEntre(hoje, new Date(c.data_termino! + 'T00:00:00')) }))
    .sort((a, b) => a.diasRestantes - b.diasRestantes)

  const reajustesProximos = contratosLista
    .filter(c => c.data_proximo_reajuste && new Date(c.data_proximo_reajuste) <= em30Dias)
    .map(c => ({ ...c, diasRestantes: diasEntre(hoje, new Date(c.data_proximo_reajuste! + 'T00:00:00')) }))
    .sort((a, b) => a.diasRestantes - b.diasRestantes)

  // Seguro incêndio: vence 1 ano após data registrada. Alerta quando faltar 60 dias.
  const segurosVencendo = contratosLista
    .filter(c => c.seguro_incendio_data)
    .map(c => {
      const pago = new Date(c.seguro_incendio_data! + 'T00:00:00')
      const vence = new Date(pago.getTime() + 365 * 86400000)
      return { ...c, dataVencimento: vence, diasRestantes: diasEntre(hoje, vence) }
    })
    .filter(c => c.diasRestantes <= 60)
    .sort((a, b) => a.diasRestantes - b.diasRestantes)

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={20} className="text-violet-600" />
            {MESES_NOMES[mesAtual - 1].charAt(0).toUpperCase() + MESES_NOMES[mesAtual - 1].slice(1)} de {anoAtual}
            <BotaoAjuda slug="inicio" size={16} titulo="Sobre o painel" />
          </h1>
          <p className="text-sm text-gray-500">
            Controle mensal de aluguéis · {doMes.length} parcela{doMes.length === 1 ? '' : 's'} prevista{doMes.length === 1 ? '' : 's'}
            {!ehMesAtual && <span className="text-amber-600 font-medium"> · navegação ativa</span>}
          </p>
        </div>
        <SeletorMes mes={mesAtual} ano={anoAtual} ehMesAtual={ehMesAtual} />
      </div>

      {/* KPIs do mês */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Previsto" value={formatarBRL(totalDoMes)} sub={`${doMes.length} aluguéis`} icon={Wallet} cor="text-violet-600" bg="bg-violet-50" />
        <KPI label="Recebido" value={formatarBRL(recebidoDoMes)} sub={`${doMes.filter(p => p.pago).length} pagos`} icon={CheckCircle2} cor="text-green-600" bg="bg-green-50" />
        <KPI label="A receber" value={formatarBRL(aReceberDoMes)} sub={`${doMes.filter(p => !p.pago).length} pendentes`} icon={DollarSign} cor="text-blue-600" bg="bg-blue-50" />
        <KPI label="Atrasados" value={formatarBRL(totalAtrasado)} sub={`${atrasadas.length} parcela${atrasadas.length === 1 ? '' : 's'} de meses anteriores`} icon={AlertTriangle} cor="text-red-600" bg="bg-red-50" />
      </div>

      {/* Alertas de vencimento próximo (relativos a hoje — só no mês atual) */}
      {ehMesAtual && vencendoEm5.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-amber-900 flex items-center gap-2 mb-3">
            <Clock size={15} className="text-amber-600" />
            Vence em até 5 dias ({vencendoEm5.length})
          </h2>
          <ul className="space-y-1.5">
            {vencendoEm5.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <Link href={`/painel/contratos/${p.contratoId}`} className="font-medium text-gray-900 hover:text-amber-700 truncate inline-block max-w-[200px] sm:max-w-none align-middle">
                    {p.inquilino}
                  </Link>
                  <span className="text-xs text-gray-500 ml-1">· {p.imovel}{p.bairro && ` (${p.bairro})`}</span>
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="font-semibold text-gray-900">{formatarBRL(p.valor)}</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold ${
                    p.diasAteVenc === 0 ? 'bg-red-600 text-white' :
                    p.diasAteVenc <= 2 ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {p.diasAteVenc === 0 ? 'HOJE' : `em ${p.diasAteVenc} dia${p.diasAteVenc === 1 ? '' : 's'}`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Atrasados (mês anterior pra trás) */}
      {atrasadas.length > 0 && (
        <section className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-red-900 flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-red-600" />
            Atrasados de meses anteriores ({atrasadas.length}) · {formatarBRL(totalAtrasado)}
          </h2>
          <ul className="space-y-1.5">
            {atrasadas.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <Link href={`/painel/contratos/${p.contratoId}`} className="font-medium text-gray-900 hover:text-red-700">
                    {p.inquilino}
                  </Link>
                  <span className="text-xs text-gray-500 ml-1">· venc. {formatarData(p.vencimento)} · {p.imovel}</span>
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="font-semibold text-gray-900">{formatarBRL(p.valor)}</span>
                  <span className="px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700">
                    {-p.diasAteVenc} dias atrasado
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Lista do mês — agrupada por inquilino com checkboxes e bulk actions */}
      <TabelaMes
        parcelas={doMes as unknown as LinhaParcela[]}
        anuncianteNome={anuncianteNome}
        atrasadasMes={atrasadasMes.length}
      />

      {/* Próximos eventos */}
      {(contratosVencendo.length > 0 || reajustesProximos.length > 0 || segurosVencendo.length > 0) && (
        <div className="grid lg:grid-cols-3 gap-4">
          {contratosVencendo.length > 0 && (
            <Card icon={<FileSignature size={15} className="text-orange-600" />} titulo="Contratos terminando (60 dias)">
              <ul className="space-y-1.5">
                {contratosVencendo.map(c => {
                  const inq = unwrap(c.inquilino)
                  return (
                    <li key={c.id} className="text-xs">
                      <Link href={`/painel/contratos/${c.id}`} className="flex items-center justify-between hover:bg-gray-50 -mx-1 px-1 py-1 rounded">
                        <span className="text-gray-700 truncate min-w-0">{inq?.nome ?? c.codigo}</span>
                        <span className="text-orange-700 font-semibold shrink-0 ml-2">
                          em {c.diasRestantes} dia{c.diasRestantes === 1 ? '' : 's'}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-50">
                💡 Avise os inquilinos sobre renovação/saída.
              </p>
            </Card>
          )}

          {reajustesProximos.length > 0 && (
            <Card icon={<TrendingUp size={15} className="text-amber-600" />} titulo="Reajustes próximos (30 dias)">
              <ul className="space-y-1.5">
                {reajustesProximos.map(c => {
                  const inq = unwrap(c.inquilino)
                  const atrasado = c.diasRestantes < 0
                  return (
                    <li key={c.id} className="text-xs">
                      <Link href={`/painel/contratos/${c.id}`} className="flex items-center justify-between hover:bg-gray-50 -mx-1 px-1 py-1 rounded">
                        <span className="text-gray-700 truncate min-w-0">{inq?.nome ?? c.codigo}</span>
                        <span className={`font-semibold shrink-0 ml-2 ${atrasado ? 'text-red-600' : 'text-amber-700'}`}>
                          {atrasado ? `${-c.diasRestantes}d atrás` : `em ${c.diasRestantes}d`}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-50">
                💡 Combine % com o inquilino antes de aplicar.
              </p>
            </Card>
          )}

          {segurosVencendo.length > 0 && (
            <Card icon={<Shield size={15} className="text-red-600" />} titulo="Seguro incêndio (anual)">
              <ul className="space-y-1.5">
                {segurosVencendo.map(c => {
                  const inq = unwrap(c.inquilino)
                  const vencido = c.diasRestantes < 0
                  return (
                    <li key={c.id} className="text-xs">
                      <Link href={`/painel/contratos/${c.id}`} className="flex items-center justify-between hover:bg-gray-50 -mx-1 px-1 py-1 rounded">
                        <span className="text-gray-700 truncate min-w-0">{inq?.nome ?? c.codigo}</span>
                        <span className={`font-semibold shrink-0 ml-2 ${vencido ? 'text-red-700' : 'text-red-600'}`}>
                          {vencido ? `vencido há ${-c.diasRestantes}d` : `em ${c.diasRestantes}d`}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-50">
                💡 Renove com o proprietário antes do vencimento.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Link rápido pra ações */}
      <div className="flex justify-end gap-2">
        <Link href="/painel/contratos/novo" className="text-sm text-violet-700 hover:text-violet-800 flex items-center gap-1 font-medium">
          Novo contrato <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  )
}

function KPI({ label, value, sub, icon: Icon, cor, bg }: {
  label: string; value: string; sub?: string; icon: React.ElementType; cor: string; bg: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-2`}>
        <Icon size={18} className={cor} />
      </div>
      <p className="text-xl font-extrabold text-gray-900">{value}</p>
      <p className="text-xs font-medium text-gray-700">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function Card({ icon, titulo, children }: { icon: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">{icon} {titulo}</h3>
      {children}
    </div>
  )
}

