import Link from 'next/link'
import {
  Wallet, TrendingUp, TrendingDown, Users, AlertCircle, Clock,
  DollarSign, ArrowUpRight, FileSignature, Calendar, Send, Shield,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { formatarBRL, formatarData } from '@/lib/formatters'
import { FiltroMesAno, type ModoPeriodo } from './_components/filtro-mes-ano'

interface ParcelaRow {
  id: string
  contrato_id: string
  mes_referencia: string
  vencimento: string
  valor_total: number
  valor_aluguel: number
  valor_seguro: number
  valor_comissao: number
  valor_repasse_proprietario: number
  status_pagamento: string
  status_repasse: string
  status_seguro: string
  boleto_enviado: boolean | null
  data_pagamento: string | null
  valor_pago: number | null
}

interface ContratoRow {
  id: string
  codigo: string
  status: string
  valor_aluguel: number
  data_inicio: string
  data_termino: string | null
  data_proximo_reajuste: string | null
  seguro_incendio_data: string | null
  valor_seguro_incendio_anual: number | null
  garantia_tipo: string
  inquilino: { id: string; nome: string } | { id: string; nome: string }[] | null
  proprietario: { id: string; nome: string } | { id: string; nome: string }[] | null
}

function StatCard({ label, value, sub, icon: Icon, cor, bg, sufixo, hint }: {
  label: string; value: string; sub?: string; icon: React.ElementType
  cor: string; bg: string; sufixo?: string; hint?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
          <Icon size={20} className={cor} />
        </div>
        {hint && <span className="text-[10px] text-gray-300">{hint}</span>}
      </div>
      <p className="text-2xl font-extrabold text-gray-900 tracking-tight">{value}{sufixo}</p>
      <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

interface Props {
  searchParams: Promise<{ modo?: string; mes?: string; ano?: string }>
}

const MESES_NOMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export default async function FinanceiroPage({ searchParams }: Props) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const hoje = new Date()
  const sp = await searchParams
  const mesParam = parseInt(sp.mes ?? '')
  const anoParam = parseInt(sp.ano ?? '')
  const modoParam = sp.modo
  const modo: ModoPeriodo = modoParam === 'anual' ? 'anual' : modoParam === 'tudo' ? 'tudo' : 'mensal'

  // Mês/Ano selecionados (default = atual)
  const mesAlvoNum = (mesParam >= 1 && mesParam <= 12) ? mesParam : (hoje.getMonth() + 1)
  const anoAlvo = Number.isFinite(anoParam) && anoParam > 1900 ? anoParam : hoje.getFullYear()
  const ehMesAtual = modo === 'mensal' && mesAlvoNum === (hoje.getMonth() + 1) && anoAlvo === hoje.getFullYear()
  const ehAnoAtual = modo === 'anual' && anoAlvo === hoje.getFullYear()
  const ehPeriodoAtual = ehMesAtual || ehAnoAtual || modo === 'tudo'

  // Range do período selecionado (null = sem filtro de tempo)
  const inicioRange: Date | null =
    modo === 'mensal' ? new Date(anoAlvo, mesAlvoNum - 1, 1)
    : modo === 'anual' ? new Date(anoAlvo, 0, 1)
    : null
  const fimRange: Date | null =
    modo === 'mensal' ? new Date(anoAlvo, mesAlvoNum, 0, 23, 59, 59)
    : modo === 'anual' ? new Date(anoAlvo, 11, 31, 23, 59, 59)
    : null

  // Helpers de filtro de tempo
  const dentroDoRange = (dataIso: string | null): boolean => {
    if (!dataIso) return false
    if (!inicioRange || !fimRange) return true // modo "tudo"
    const d = new Date(dataIso.slice(0, 10) + 'T00:00:00')
    return d >= inicioRange && d <= fimRange
  }

  const rotuloPeriodo =
    modo === 'mensal' ? `${MESES_NOMES[mesAlvoNum - 1]} de ${anoAlvo}`
    : modo === 'anual' ? `${anoAlvo}`
    : 'todo o período'

  // Relativos a HOJE (não mudam com filtro)
  const em30Dias = new Date(hoje.getTime() + 30 * 86400000)
  const em7Dias = new Date(hoje.getTime() + 7 * 86400000)
  const ha12Meses = new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1)

  const [
    contratosRes,
    pessoasRes,
    parcelasRes,
  ] = await Promise.all([
    supabase.from('contratos_locacao')
      .select(`
        id, codigo, status, valor_aluguel, data_inicio, data_termino,
        data_proximo_reajuste, seguro_incendio_data, valor_seguro_incendio_anual,
        garantia_tipo,
        inquilino:pessoas!inquilino_id(id, nome),
        proprietario:pessoas!proprietario_id(id, nome)
      `)
      .eq('user_id', acesso.userId)
      .is('deleted_at', null),
    supabase.from('pessoas').select('id, tipo').eq('user_id', acesso.userId).is('deleted_at', null),
    supabase.from('parcelas_aluguel').select(`
      id, contrato_id, mes_referencia, vencimento,
      valor_total, valor_aluguel, valor_seguro, valor_comissao, valor_repasse_proprietario,
      status_pagamento, status_repasse, status_seguro, boleto_enviado,
      data_pagamento, valor_pago,
      contrato:contratos_locacao!inner(id)
    `)
      // Escopa às parcelas do usuário e fora da lixeira — senão o financeiro
      // soma parcelas de contratos soft-deletados (e de outros usuários),
      // inflando os meses. O início já faz esse mesmo filtro.
      .eq('contrato.user_id', acesso.userId)
      .is('contrato.deleted_at', null),
  ])

  const contratos = (contratosRes.data ?? []) as ContratoRow[]
  const pessoas = pessoasRes.data ?? []
  const parcelas = (parcelasRes.data ?? []) as ParcelaRow[]

  // ─── Indexa contratos por ID ─────────────────────────────────────────
  const contratoPorId: Record<string, ContratoRow> = {}
  contratos.forEach(c => { contratoPorId[c.id] = c })

  // ─── KPIs do período (regime de CAIXA: usa data_pagamento) ───────────
  // Parcelas efetivamente pagas dentro do período → recebido / comissão / repasse
  const pagasNoCaixa = parcelas.filter(
    p => p.status_pagamento === 'pago' && dentroDoRange(p.data_pagamento)
  )

  const recebidoPeriodo = pagasNoCaixa.reduce((acc, p) => acc + (p.valor_pago ?? p.valor_total), 0)
  const comissaoPeriodo = pagasNoCaixa.reduce((acc, p) => acc + p.valor_comissao, 0)
  const repassePeriodo = pagasNoCaixa.reduce((acc, p) => acc + p.valor_repasse_proprietario, 0)
  const seguroPeriodo = pagasNoCaixa.reduce((acc, p) => acc + p.valor_seguro, 0)

  // Parcelas a receber: NÃO pagas, com mes_referencia dentro do período (regime de competência)
  const aReceberNoPeriodo = parcelas.filter(p => {
    if (p.status_pagamento === 'pago') return false
    if (!inicioRange || !fimRange) return true
    const ref = new Date(p.mes_referencia + 'T00:00:00')
    return ref >= inicioRange && ref <= fimRange
  })
  const aReceberValor = aReceberNoPeriodo.reduce((acc, p) => acc + p.valor_total, 0)
  const totalReceitaPeriodo = recebidoPeriodo + aReceberValor

  // ─── Pendências operacionais ─────────────────────────────────────────
  const atrasadas = parcelas.filter(p => {
    if (p.status_pagamento === 'pago') return false
    return new Date(p.vencimento + 'T00:00:00') < hoje
  })
  const valorAtrasado = atrasadas.reduce((acc, p) => acc + p.valor_total, 0)

  // Repasse pendente: dinheiro JÁ recebido no período, mas ainda não repassado ao proprietário
  const repassePendentePeriodo = pagasNoCaixa
    .filter(p => p.status_repasse !== 'pago')
    .reduce((acc, p) => acc + p.valor_repasse_proprietario, 0)

  const boletosNaoEnviados = parcelas.filter(p => {
    if (p.boleto_enviado || p.status_pagamento === 'pago') return false
    const venc = new Date(p.vencimento + 'T00:00:00')
    return venc <= em7Dias && venc >= hoje
  })

  const vencendo7Dias = parcelas.filter(p => {
    if (p.status_pagamento === 'pago') return false
    const venc = new Date(p.vencimento + 'T00:00:00')
    return venc > hoje && venc <= em7Dias
  })

  // ─── Estratégico ─────────────────────────────────────────────────────
  const contratosAtivos = contratos.filter(c => c.status === 'ativo')
  const totalInquilinos = pessoas.filter(p => p.tipo === 'inquilino').length
  const totalProprietarios = pessoas.filter(p => p.tipo === 'proprietario').length

  // Receita anual estimada (contratos ativos × 12)
  const receitaAnualEstimada = contratosAtivos.reduce((acc, c) => acc + c.valor_aluguel * 12, 0)

  // Top inquilinos por receita gerada
  const receitaPorInquilino: Record<string, { nome: string; total: number; contratoId: string }> = {}
  for (const p of parcelas) {
    const c = contratoPorId[p.contrato_id]
    if (!c) continue
    const inq = Array.isArray(c.inquilino) ? c.inquilino[0] : c.inquilino
    if (!inq) continue
    const key = inq.id
    if (!receitaPorInquilino[key]) {
      receitaPorInquilino[key] = { nome: inq.nome, total: 0, contratoId: c.id }
    }
    receitaPorInquilino[key].total += p.valor_total
  }
  const topInquilinos = Object.entries(receitaPorInquilino)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // Top proprietários por imóveis sob administração
  const contratosPorProprietario: Record<string, { nome: string; qtd: number; receita: number }> = {}
  for (const c of contratosAtivos) {
    const prop = Array.isArray(c.proprietario) ? c.proprietario[0] : c.proprietario
    if (!prop) continue
    if (!contratosPorProprietario[prop.id]) {
      contratosPorProprietario[prop.id] = { nome: prop.nome, qtd: 0, receita: 0 }
    }
    contratosPorProprietario[prop.id].qtd += 1
    contratosPorProprietario[prop.id].receita += c.valor_aluguel
  }
  const topProprietarios = Object.entries(contratosPorProprietario)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 5)

  // Distribuição por garantia
  const contGarantia: Record<string, number> = {}
  contratosAtivos.forEach(c => { contGarantia[c.garantia_tipo] = (contGarantia[c.garantia_tipo] ?? 0) + 1 })

  // Próximos contratos a vencer (próximos 60 dias)
  const em60Dias = new Date(hoje.getTime() + 60 * 86400000)
  const contratosVencendo = contratosAtivos
    .filter(c => c.data_termino && new Date(c.data_termino) <= em60Dias)
    .sort((a, b) => (a.data_termino ?? '').localeCompare(b.data_termino ?? ''))
    .slice(0, 5)

  // Reajustes nos próximos 30 dias
  const reajustesProximos = contratosAtivos
    .filter(c => c.data_proximo_reajuste && new Date(c.data_proximo_reajuste) <= em30Dias)
    .sort((a, b) => (a.data_proximo_reajuste ?? '').localeCompare(b.data_proximo_reajuste ?? ''))
    .slice(0, 5)

  // Seguro incêndio: anual. Alerta quando faltar 60 dias do vencimento (data + 365d).
  const segurosVencendo = contratosAtivos
    .filter(c => c.seguro_incendio_data)
    .map(c => {
      const pago = new Date(c.seguro_incendio_data!)
      const vence = new Date(pago.getTime() + 365 * 86400000)
      return { ...c, seguro_incendio_data: vence.toISOString().slice(0, 10), _vence: vence }
    })
    .filter(c => c._vence.getTime() - hoje.getTime() <= 60 * 86400000)
    .sort((a, b) => a._vence.getTime() - b._vence.getTime())
    .slice(0, 5)

  // ─── Receita por mês (gráfico) ───────────────────────────────────────
  // Caixa (recebido): usa data_pagamento. Previsto (a receber): usa mes_referencia.
  // Em modo "anual" mostra 12 meses do ano; "mensal" 11 antes + 6 depois; "tudo" últimos 12 meses.
  const meses: { rotulo: string; key: string; receita: number; recebido: number }[] = []
  if (modo === 'anual') {
    for (let i = 0; i < 12; i++) {
      const m = new Date(anoAlvo, i, 1)
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
      const rotulo = m.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
      meses.push({ rotulo, key, receita: 0, recebido: 0 })
    }
  } else if (modo === 'tudo') {
    // Últimos 12 meses até hoje
    for (let i = -11; i <= 0; i++) {
      const m = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
      const rotulo = m.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
        + '/' + String(m.getFullYear()).slice(2)
      meses.push({ rotulo, key, receita: 0, recebido: 0 })
    }
  } else {
    // Mensal: centrado no mês selecionado
    for (let i = -11; i <= 6; i++) {
      const m = new Date(anoAlvo, mesAlvoNum - 1 + i, 1)
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
      const rotulo = m.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
        + '/' + String(m.getFullYear()).slice(2)
      meses.push({ rotulo, key, receita: 0, recebido: 0 })
    }
  }
  const mesIndex: Record<string, number> = {}
  meses.forEach((m, i) => { mesIndex[m.key] = i })

  for (const p of parcelas) {
    // Recebido cai no mês do PAGAMENTO (regime de caixa)
    if (p.status_pagamento === 'pago' && p.data_pagamento) {
      const dp = p.data_pagamento.slice(0, 7)
      const idx = mesIndex[dp]
      if (idx !== undefined) {
        meses[idx].recebido += p.valor_pago ?? p.valor_total
        meses[idx].receita += p.valor_pago ?? p.valor_total
      }
    } else {
      // A receber cai no mês de REFERÊNCIA (previsão)
      const refKey = p.mes_referencia.slice(0, 7)
      const idx = mesIndex[refKey]
      if (idx !== undefined) meses[idx].receita += p.valor_total
    }
  }

  const maxReceita = Math.max(...meses.map(m => m.receita), 1)
  const mesAlvoKey = modo === 'mensal' ? `${anoAlvo}-${String(mesAlvoNum).padStart(2, '0')}` : ''
  const mesAtualKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  // ─── Recebido nos últimos 12 meses ───────────────────────────────────
  const recebido12m = parcelas
    .filter(p => p.status_pagamento === 'pago' && p.data_pagamento && new Date(p.data_pagamento) >= ha12Meses)
    .reduce((acc, p) => acc + (p.valor_pago ?? p.valor_total), 0)

  const GARANTIA_LABEL: Record<string, string> = {
    fiador: 'Fiador',
    caucao: 'Caução',
    seguro_fianca: 'Seguro fiança',
    sem_garantia: 'Sem garantia',
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet size={20} className="text-violet-600" /> Financeiro
          </h1>
          <p className="text-sm text-gray-500 capitalize">
            {rotuloPeriodo} · {contratosAtivos.length} contrato{contratosAtivos.length === 1 ? '' : 's'} ativo{contratosAtivos.length === 1 ? '' : 's'}
            {!ehPeriodoAtual && <span className="text-amber-600 font-medium normal-case"> · filtro aplicado</span>}
          </p>
        </div>
        <FiltroMesAno modo={modo} mes={mesAlvoNum} ano={anoAlvo} ehAtual={ehPeriodoAtual} />
      </div>

      {/* KPIs do período selecionado */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Recebido no período"
          value={formatarBRL(recebidoPeriodo)}
          sub={`${pagasNoCaixa.length} pagamento${pagasNoCaixa.length === 1 ? '' : 's'} · regime de caixa`}
          icon={DollarSign}
          cor="text-violet-600" bg="bg-violet-50"
          hint={modo === 'tudo' ? 'desde o início' : undefined}
        />
        <Link
          href={{ pathname: '/painel/financeiro/comissoes', query: { modo, ...(modo !== 'tudo' && { ano: String(anoAlvo) }), ...(modo === 'mensal' && { mes: String(mesAlvoNum) }) } }}
          className="group"
        >
          <StatCard
            label="Comissão"
            value={formatarBRL(comissaoPeriodo)}
            sub="Detalhar por proprietário (NF) →"
            icon={TrendingUp}
            cor="text-green-600" bg="bg-green-50"
          />
        </Link>
        <StatCard
          label="Repasse devido"
          value={formatarBRL(repassePeriodo)}
          sub={`${formatarBRL(repassePendentePeriodo)} ainda não repassado`}
          icon={ArrowUpRight}
          cor="text-blue-600" bg="bg-blue-50"
        />
        <StatCard
          label="A receber (previsto)"
          value={formatarBRL(aReceberValor)}
          sub={`${aReceberNoPeriodo.length} parcela${aReceberNoPeriodo.length === 1 ? '' : 's'} em aberto · total ${formatarBRL(totalReceitaPeriodo)}`}
          icon={Shield}
          cor="text-orange-600" bg="bg-orange-50"
        />
      </div>

      {/* Pendências (só aparecem se houver) */}
      {(atrasadas.length > 0 || repassePendentePeriodo > 0 || boletosNaoEnviados.length > 0 || vencendo7Dias.length > 0) && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {atrasadas.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-red-700 mb-2">
                <AlertCircle size={14} />
                <span className="text-xs font-semibold">PARCELAS ATRASADAS</span>
              </div>
              <p className="text-2xl font-bold text-red-700">{atrasadas.length}</p>
              <p className="text-xs text-red-600 mt-0.5">{formatarBRL(valorAtrasado)}</p>
            </div>
          )}
          {vencendo7Dias.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-amber-700 mb-2">
                <Clock size={14} />
                <span className="text-xs font-semibold">VENCEM EM 7 DIAS</span>
              </div>
              <p className="text-2xl font-bold text-amber-700">{vencendo7Dias.length}</p>
              <p className="text-xs text-amber-600 mt-0.5">parcelas a vencer</p>
            </div>
          )}
          {boletosNaoEnviados.length > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-violet-700 mb-2">
                <Send size={14} />
                <span className="text-xs font-semibold">BOLETOS A ENVIAR</span>
              </div>
              <p className="text-2xl font-bold text-violet-700">{boletosNaoEnviados.length}</p>
              <p className="text-xs text-violet-600 mt-0.5">próximos 7 dias</p>
            </div>
          )}
          {repassePendentePeriodo > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <ArrowUpRight size={14} />
                <span className="text-xs font-semibold">REPASSES PENDENTES</span>
              </div>
              <p className="text-xl font-bold text-blue-700">{formatarBRL(repassePendentePeriodo)}</p>
              <p className="text-xs text-blue-600 mt-0.5">já recebido, falta repassar</p>
            </div>
          )}
        </div>
      )}

      {/* Visão geral + clientes */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <Users size={15} className="text-violet-600" /> Carteira
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{contratosAtivos.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">contratos ativos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalInquilinos}</p>
              <p className="text-xs text-gray-500 mt-0.5">inquilinos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalProprietarios}</p>
              <p className="text-xs text-gray-500 mt-0.5">proprietários</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs text-gray-400 mb-1">Receita anual estimada</p>
            <p className="text-xl font-bold text-violet-700">{formatarBRL(receitaAnualEstimada)}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Soma dos contratos ativos × 12 meses</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <TrendingDown size={15} className="text-green-600" /> Acumulado 12 meses
          </h2>
          <p className="text-3xl font-bold text-green-700 mb-1">{formatarBRL(recebido12m)}</p>
          <p className="text-xs text-gray-500">Total recebido em pagamentos confirmados</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <Shield size={15} className="text-orange-600" /> Tipos de garantia
          </h2>
          <div className="space-y-2">
            {Object.entries(contGarantia).sort((a, b) => b[1] - a[1]).map(([tipo, qtd]) => (
              <div key={tipo}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-700">{GARANTIA_LABEL[tipo] ?? tipo}</span>
                  <span className="text-gray-500 font-medium">{qtd}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full"
                    style={{ width: `${(qtd / Math.max(1, contratosAtivos.length)) * 100}%` }} />
                </div>
              </div>
            ))}
            {Object.keys(contGarantia).length === 0 && (
              <p className="text-xs text-gray-400">Sem contratos ativos.</p>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico de receita */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4 text-sm flex items-center gap-2">
          <Calendar size={15} className="text-violet-600" /> Receita por mês —
          <span className="font-normal text-gray-500">
            {modo === 'anual' && `meses de ${anoAlvo}`}
            {modo === 'mensal' && '11 antes + selecionado + 6 depois'}
            {modo === 'tudo' && 'últimos 12 meses'}
          </span>
        </h2>
        <div className="overflow-x-auto">
          <div className="flex items-end gap-1 min-w-[600px] h-32">
            {meses.map(m => {
              const altura = (m.receita / maxReceita) * 100
              const alturaRecebida = m.receita > 0 ? (m.recebido / m.receita) * altura : 0
              const isSelecionado = m.key === mesAlvoKey
              const isAtual = m.key === mesAtualKey
              const isFuturo = m.key > mesAtualKey
              return (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-1 group" title={`${m.rotulo}: ${formatarBRL(m.receita)} previsto · ${formatarBRL(m.recebido)} recebido`}>
                  <div className="w-full relative h-24 flex items-end">
                    <div className={`w-full rounded-t transition-colors ${
                      isSelecionado ? 'bg-violet-200' : isFuturo ? 'bg-gray-200' : 'bg-violet-100'
                    } group-hover:opacity-80 ${isSelecionado ? 'ring-2 ring-violet-500' : ''}`} style={{ height: `${altura}%` }}>
                      <div className={`w-full rounded-t ${isSelecionado ? 'bg-violet-700' : isFuturo ? 'bg-gray-400' : 'bg-green-500'}`}
                        style={{ height: `${(alturaRecebida / Math.max(altura, 1)) * 100}%` }} />
                    </div>
                  </div>
                  <span className={`text-[9px] ${isSelecionado ? 'font-bold text-violet-700' : isAtual ? 'font-semibold text-gray-700' : 'text-gray-400'}`}>{m.rotulo}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-500"></span> Recebido</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-violet-200 ring-2 ring-violet-500"></span> Mês selecionado</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-violet-100"></span> Histórico</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-gray-200"></span> Projetado</span>
        </div>
      </div>

      {/* Top inquilinos + Top proprietários */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <TrendingUp size={15} className="text-green-600" /> Top inquilinos por receita
          </h2>
          {topInquilinos.length === 0 ? (
            <p className="text-xs text-gray-400">Sem dados ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {topInquilinos.map((i, idx) => {
                const max = topInquilinos[0].total || 1
                return (
                  <Link key={i.id} href={`/painel/contratos/${i.contratoId}`} className="block group">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-700 font-medium group-hover:text-violet-700">
                        {idx + 1}. {i.nome}
                      </span>
                      <span className="text-gray-500">{formatarBRL(i.total)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${(i.total / max) * 100}%` }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <Users size={15} className="text-blue-600" /> Top proprietários
          </h2>
          {topProprietarios.length === 0 ? (
            <p className="text-xs text-gray-400">Sem dados ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {topProprietarios.map((p, idx) => {
                const max = topProprietarios[0].receita || 1
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-700 font-medium">{idx + 1}. {p.nome}</span>
                      <span className="text-gray-500">
                        {p.qtd} imóv{p.qtd === 1 ? 'el' : 'eis'} · {formatarBRL(p.receita)}/mês
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(p.receita / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Alertas estratégicos */}
      {(contratosVencendo.length > 0 || reajustesProximos.length > 0 || segurosVencendo.length > 0) && (
        <div className="grid lg:grid-cols-3 gap-6">
          {contratosVencendo.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
                <FileSignature size={15} className="text-orange-600" /> Contratos vencendo (60 dias)
              </h2>
              <div className="space-y-2 text-xs">
                {contratosVencendo.map(c => {
                  const inq = Array.isArray(c.inquilino) ? c.inquilino[0] : c.inquilino
                  return (
                    <Link key={c.id} href={`/painel/contratos/${c.id}`} className="flex items-center justify-between hover:bg-gray-50 -mx-1 px-1 py-1 rounded">
                      <span className="text-gray-700 truncate">{inq?.nome ?? c.codigo}</span>
                      <span className="text-orange-700 font-medium shrink-0 ml-2">{formatarData(c.data_termino)}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {reajustesProximos.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
                <TrendingUp size={15} className="text-amber-600" /> Reajustes próximos (30 dias)
              </h2>
              <div className="space-y-2 text-xs">
                {reajustesProximos.map(c => {
                  const inq = Array.isArray(c.inquilino) ? c.inquilino[0] : c.inquilino
                  return (
                    <Link key={c.id} href={`/painel/contratos/${c.id}`} className="flex items-center justify-between hover:bg-gray-50 -mx-1 px-1 py-1 rounded">
                      <span className="text-gray-700 truncate">{inq?.nome ?? c.codigo}</span>
                      <span className="text-amber-700 font-medium shrink-0 ml-2">{formatarData(c.data_proximo_reajuste)}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {segurosVencendo.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
                <Shield size={15} className="text-red-600" /> Seguro incêndio (30 dias)
              </h2>
              <div className="space-y-2 text-xs">
                {segurosVencendo.map(c => {
                  const inq = Array.isArray(c.inquilino) ? c.inquilino[0] : c.inquilino
                  return (
                    <Link key={c.id} href={`/painel/contratos/${c.id}`} className="flex items-center justify-between hover:bg-gray-50 -mx-1 px-1 py-1 rounded">
                      <span className="text-gray-700 truncate">{inq?.nome ?? c.codigo}</span>
                      <span className="text-red-700 font-medium shrink-0 ml-2">{formatarData(c.seguro_incendio_data)}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {contratos.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Wallet size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-700 mb-1">Sem contratos ainda</p>
          <p className="text-xs text-gray-500 mb-4">Crie o primeiro contrato pra começar a ver os números aqui.</p>
          <Link href="/painel/contratos/novo" className="inline-block bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2 rounded-xl">
            + Novo contrato
          </Link>
        </div>
      )}
    </div>
  )
}
