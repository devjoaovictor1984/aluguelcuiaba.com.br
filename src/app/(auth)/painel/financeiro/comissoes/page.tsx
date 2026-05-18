import Link from 'next/link'
import { ArrowLeft, TrendingUp, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { formatarBRL, formatarData } from '@/lib/formatters'
import { FiltroMesAno, type ModoPeriodo } from '../_components/filtro-mes-ano'
import { BotaoImprimir } from './_components/botao-imprimir'

interface ParcelaRow {
  id: string
  contrato_id: string
  mes_referencia: string
  vencimento: string
  valor_aluguel: number
  valor_comissao: number
  valor_repasse_proprietario: number
  valor_total: number
  valor_pago: number | null
  status_pagamento: string
  data_pagamento: string | null
}

interface ImovelLite { id: string; titulo: string }
interface PessoaLite { id: string; nome: string; cpf_cnpj: string | null }

interface ContratoRow {
  id: string
  codigo: string
  status: string
  taxa_admin_tipo: string
  taxa_admin_valor: number
  inquilino: PessoaLite | PessoaLite[] | null
  proprietario: PessoaLite | PessoaLite[] | null
  imovel: ImovelLite | ImovelLite[] | null
}

const MESES_NOMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

interface Props {
  searchParams: Promise<{ modo?: string; mes?: string; ano?: string }>
}

export default async function ComissoesPage({ searchParams }: Props) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const hoje = new Date()
  const sp = await searchParams
  const mesParam = parseInt(sp.mes ?? '')
  const anoParam = parseInt(sp.ano ?? '')
  const modoParam = sp.modo
  const modo: ModoPeriodo = modoParam === 'anual' ? 'anual' : modoParam === 'tudo' ? 'tudo' : 'mensal'

  const mesAlvoNum = (mesParam >= 1 && mesParam <= 12) ? mesParam : (hoje.getMonth() + 1)
  const anoAlvo = Number.isFinite(anoParam) && anoParam > 1900 ? anoParam : hoje.getFullYear()
  const ehMesAtual = modo === 'mensal' && mesAlvoNum === (hoje.getMonth() + 1) && anoAlvo === hoje.getFullYear()
  const ehAnoAtual = modo === 'anual' && anoAlvo === hoje.getFullYear()
  const ehPeriodoAtual = ehMesAtual || ehAnoAtual || modo === 'tudo'

  const inicioRange: Date | null =
    modo === 'mensal' ? new Date(anoAlvo, mesAlvoNum - 1, 1)
    : modo === 'anual' ? new Date(anoAlvo, 0, 1)
    : null
  const fimRange: Date | null =
    modo === 'mensal' ? new Date(anoAlvo, mesAlvoNum, 0, 23, 59, 59)
    : modo === 'anual' ? new Date(anoAlvo, 11, 31, 23, 59, 59)
    : null

  const dentroDoRange = (dataIso: string | null): boolean => {
    if (!dataIso) return false
    if (!inicioRange || !fimRange) return true
    const d = new Date(dataIso.slice(0, 10) + 'T00:00:00')
    return d >= inicioRange && d <= fimRange
  }

  const rotuloPeriodo =
    modo === 'mensal' ? `${MESES_NOMES[mesAlvoNum - 1]} de ${anoAlvo}`
    : modo === 'anual' ? `${anoAlvo}`
    : 'todo o período'

  const [{ data: contratosRaw }, { data: parcelasRaw }] = await Promise.all([
    supabase.from('contratos_locacao').select(`
      id, codigo, status, taxa_admin_tipo, taxa_admin_valor,
      inquilino:pessoas!inquilino_id(id, nome, cpf_cnpj),
      proprietario:pessoas!proprietario_id(id, nome, cpf_cnpj),
      imovel:imoveis(id, titulo)
    `)
      .eq('user_id', acesso.userId)
      .is('deleted_at', null),
    supabase.from('parcelas_aluguel').select(`
      id, contrato_id, mes_referencia, vencimento,
      valor_aluguel, valor_comissao, valor_repasse_proprietario,
      valor_total, valor_pago, status_pagamento, data_pagamento
    `),
  ])

  const contratos = (contratosRaw ?? []) as ContratoRow[]
  const parcelas = (parcelasRaw ?? []) as ParcelaRow[]

  const contratoPorId: Record<string, ContratoRow> = {}
  contratos.forEach(c => { contratoPorId[c.id] = c })

  // Regime de CAIXA: só conta comissão de parcelas efetivamente pagas dentro do período
  const pagasNoPeriodo = parcelas.filter(
    p => p.status_pagamento === 'pago' && dentroDoRange(p.data_pagamento)
  )

  // Agrupa por proprietário
  interface LinhaContrato {
    contratoId: string
    contratoCodigo: string
    inquilino: string
    imovel: string
    parcelas: number
    comissao: number
    aluguel: number
    repasse: number
  }
  interface GrupoProprietario {
    id: string
    nome: string
    cpfCnpj: string | null
    totalComissao: number
    totalAluguel: number
    totalRepasse: number
    qtdParcelas: number
    contratos: Map<string, LinhaContrato>
  }
  const grupos = new Map<string, GrupoProprietario>()

  for (const p of pagasNoPeriodo) {
    const c = contratoPorId[p.contrato_id]
    if (!c) continue
    const prop = unwrap(c.proprietario)
    if (!prop) continue
    const inq = unwrap(c.inquilino)
    const imo = unwrap(c.imovel)

    let g = grupos.get(prop.id)
    if (!g) {
      g = {
        id: prop.id,
        nome: prop.nome,
        cpfCnpj: prop.cpf_cnpj,
        totalComissao: 0,
        totalAluguel: 0,
        totalRepasse: 0,
        qtdParcelas: 0,
        contratos: new Map(),
      }
      grupos.set(prop.id, g)
    }
    g.totalComissao += p.valor_comissao
    g.totalAluguel += p.valor_aluguel
    g.totalRepasse += p.valor_repasse_proprietario
    g.qtdParcelas += 1

    let lc = g.contratos.get(c.id)
    if (!lc) {
      lc = {
        contratoId: c.id,
        contratoCodigo: c.codigo,
        inquilino: inq?.nome ?? '—',
        imovel: imo?.titulo ?? '—',
        parcelas: 0,
        comissao: 0,
        aluguel: 0,
        repasse: 0,
      }
      g.contratos.set(c.id, lc)
    }
    lc.parcelas += 1
    lc.comissao += p.valor_comissao
    lc.aluguel += p.valor_aluguel
    lc.repasse += p.valor_repasse_proprietario
  }

  const listaGrupos = Array.from(grupos.values()).sort((a, b) => b.totalComissao - a.totalComissao)

  const totalComissao = listaGrupos.reduce((s, g) => s + g.totalComissao, 0)
  const totalAluguelGeral = listaGrupos.reduce((s, g) => s + g.totalAluguel, 0)
  const totalRepasseGeral = listaGrupos.reduce((s, g) => s + g.totalRepasse, 0)
  const totalParcelas = listaGrupos.reduce((s, g) => s + g.qtdParcelas, 0)

  return (
    <div className="p-6 space-y-5">
      {/* Cabeçalho (oculto na impressão a partir do botão) */}
      <div className="print:hidden">
        <Link href={{ pathname: '/painel/financeiro', query: { modo, ano: String(anoAlvo), ...(modo === 'mensal' && { mes: String(mesAlvoNum) }) } }} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Financeiro
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp size={20} className="text-green-600" /> Comissões por proprietário
            </h1>
            <p className="text-sm text-gray-500 capitalize">
              {rotuloPeriodo} · regime de caixa (somente parcelas pagas)
              {!ehPeriodoAtual && <span className="text-amber-600 font-medium normal-case"> · filtro aplicado</span>}
            </p>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <FiltroMesAno modo={modo} mes={mesAlvoNum} ano={anoAlvo} ehAtual={ehPeriodoAtual} />
            <BotaoImprimir />
          </div>
        </div>
      </div>

      {/* Cabeçalho de impressão */}
      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold text-gray-900">Relatório de Comissões</h1>
        <p className="text-sm text-gray-700 capitalize">{rotuloPeriodo}</p>
        <p className="text-xs text-gray-500">Gerado em {formatarData(hoje.toISOString().slice(0, 10))}</p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Comissão total" valor={formatarBRL(totalComissao)} cor="text-green-700" bg="bg-green-50" destaque />
        <Kpi label="Aluguel base" valor={formatarBRL(totalAluguelGeral)} cor="text-gray-700" bg="bg-gray-50" />
        <Kpi label="Repasse aos proprietários" valor={formatarBRL(totalRepasseGeral)} cor="text-blue-700" bg="bg-blue-50" />
        <Kpi label="Parcelas pagas" valor={String(totalParcelas)} cor="text-violet-700" bg="bg-violet-50" />
      </div>

      {/* Tabela agrupada */}
      {listaGrupos.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center print:border-0">
          <FileText size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-700 mb-1">Sem comissão no período</p>
          <p className="text-xs text-gray-500">
            Nenhuma parcela paga em <span className="capitalize">{rotuloPeriodo}</span>. Marque pagamentos no início para ver aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {listaGrupos.map(g => {
            const linhas = Array.from(g.contratos.values()).sort((a, b) => b.comissao - a.comissao)
            return (
              <section key={g.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:shadow-none print:border-gray-300 break-inside-avoid">
                <header className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">{g.nome}</h2>
                    <p className="text-xs text-gray-500">
                      {g.cpfCnpj ? `CPF/CNPJ ${g.cpfCnpj} · ` : ''}
                      {g.contratos.size} contrato{g.contratos.size === 1 ? '' : 's'} · {g.qtdParcelas} parcela{g.qtdParcelas === 1 ? '' : 's'} paga{g.qtdParcelas === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Comissão</p>
                    <p className="text-xl font-extrabold text-green-700">{formatarBRL(g.totalComissao)}</p>
                  </div>
                </header>

                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Contrato</th>
                      <th className="px-4 py-2">Imóvel</th>
                      <th className="px-4 py-2">Inquilino</th>
                      <th className="px-4 py-2 text-center">Parcelas</th>
                      <th className="px-4 py-2 text-right">Aluguel</th>
                      <th className="px-4 py-2 text-right">Repasse</th>
                      <th className="px-4 py-2 text-right">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map(l => (
                      <tr key={l.contratoId} className="border-t border-gray-50">
                        <td className="px-4 py-2 font-mono text-xs text-gray-600">
                          <Link href={`/painel/contratos/${l.contratoId}`} className="hover:text-violet-700 print:text-gray-600">
                            {l.contratoCodigo}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-gray-700">{l.imovel}</td>
                        <td className="px-4 py-2 text-gray-700">{l.inquilino}</td>
                        <td className="px-4 py-2 text-center text-gray-600">{l.parcelas}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{formatarBRL(l.aluguel)}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{formatarBRL(l.repasse)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-green-700">{formatarBRL(l.comissao)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td colSpan={3} className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Subtotal</td>
                      <td className="px-4 py-2 text-center font-semibold text-gray-700">{g.qtdParcelas}</td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-700">{formatarBRL(g.totalAluguel)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-700">{formatarBRL(g.totalRepasse)}</td>
                      <td className="px-4 py-2 text-right font-bold text-green-700">{formatarBRL(g.totalComissao)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            )
          })}

          {/* Total geral */}
          <section className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center justify-between break-inside-avoid">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-green-700">Comissão total do período</p>
              <p className="text-xs text-green-700/70 capitalize">{rotuloPeriodo} · {listaGrupos.length} proprietário{listaGrupos.length === 1 ? '' : 's'}</p>
            </div>
            <p className="text-3xl font-extrabold text-green-700">{formatarBRL(totalComissao)}</p>
          </section>

          <p className="text-[11px] text-gray-400 print:hidden">
            💡 Use este relatório como base para emitir a nota fiscal de serviços (comissão) na prefeitura. A coluna <strong>Repasse</strong> é o que volta ao proprietário e <strong>não</strong> entra na sua NF.
          </p>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, valor, cor, bg, destaque }: { label: string; valor: string; cor: string; bg: string; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl border ${destaque ? 'border-green-200 bg-green-50' : `border-gray-100 ${bg}`} p-4 print:shadow-none print:border-gray-300`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`text-2xl font-extrabold ${cor} mt-1`}>{valor}</p>
    </div>
  )
}
