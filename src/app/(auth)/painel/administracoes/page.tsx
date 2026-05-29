import Link from 'next/link'
import { Briefcase, Plus, Home, User, CalendarClock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { Breadcrumbs } from '@/components/breadcrumbs'

const STATUS_COR: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  encerrado: 'bg-gray-100 text-gray-600',
  rescindido: 'bg-red-100 text-red-600',
  rascunho: 'bg-gray-100 text-gray-500',
}

function fmtData(d: string | null): string {
  if (!d) return '—'
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR')
}

function addMonths(d: Date, m: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + m, d.getDate())
}

interface VencInfo {
  data: Date | null
  dias: number | null        // dias até o próximo vencimento (negativo = passou)
  renovaAuto: boolean
}

/** Calcula o próximo vencimento. Com renovação automática, rola os ciclos de
 *  prazo_meses pra frente até cair em data futura (útil pra contratos antigos). */
function calcularVencimento(c: {
  data_inicio: string | null
  data_termino: string | null
  prazo_meses: number | null
  renovacao_automatica: boolean | null
}): VencInfo {
  let termino: Date | null = null
  if (c.data_termino) termino = new Date(c.data_termino + 'T00:00:00')
  else if (c.data_inicio && c.prazo_meses) termino = addMonths(new Date(c.data_inicio + 'T00:00:00'), c.prazo_meses)

  const renovaAuto = !!c.renovacao_automatica && !!c.prazo_meses && (c.prazo_meses ?? 0) > 0
  if (!termino) return { data: null, dias: null, renovaAuto }

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  if (renovaAuto && c.prazo_meses) {
    let guard = 0
    while (termino < hoje && guard < 240) { termino = addMonths(termino, c.prazo_meses); guard++ }
  }
  const dias = Math.ceil((termino.getTime() - hoje.getTime()) / 86400000)
  return { data: termino, dias, renovaAuto }
}

export default async function AdministracoesPage() {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: contratos } = await supabase
    .from('contratos_administracao')
    .select(`
      id, codigo, status, data_inicio, data_termino,
      prazo_meses, renovacao_automatica, aviso_previo_dias,
      taxa_tipo, taxa_valor, exclusividade,
      proprietario:pessoas!proprietario_id(id, nome),
      imovel:imoveis(id, titulo)
    `)
    .eq('user_id', acesso.userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  type Prop = { nome: string } | { nome: string }[] | null

  // Anexa info de vencimento e ordena os ATIVOS por proximidade do vencimento
  const lista = (contratos ?? [])
    .map(c => ({ ...c, venc: calcularVencimento(c) }))
    .sort((a, b) => {
      const ativoA = a.status === 'ativo' ? 0 : 1
      const ativoB = b.status === 'ativo' ? 0 : 1
      if (ativoA !== ativoB) return ativoA - ativoB
      const da = a.venc.dias ?? Number.POSITIVE_INFINITY
      const db = b.venc.dias ?? Number.POSITIVE_INFINITY
      return da - db
    })

  // Contratos ativos que precisam de atenção (dentro da janela de aviso prévio ou vencidos)
  const aRenovar = lista.filter(c => {
    if (c.status !== 'ativo' || c.venc.dias == null) return false
    const janela = c.aviso_previo_dias ?? 60
    return c.venc.dias <= janela
  })

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <Breadcrumbs items={[{ label: 'Contratos de administração' }]} />
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase size={20} className="text-violet-600 shrink-0" />
            Contratos de Administração
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {lista.length} contrato{lista.length === 1 ? '' : 's'} de administração com proprietários
          </p>
        </div>
        <Link
          href="/painel/administracoes/novo"
          className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-colors"
        >
          <Plus size={15} />
          <span>Novo contrato de admin</span>
        </Link>
      </div>

      {aRenovar.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
          <CalendarClock size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <span className="font-semibold">{aRenovar.length} contrato{aRenovar.length === 1 ? '' : 's'} a renovar em breve.</span>{' '}
            {aRenovar.slice(0, 4).map((c, i) => {
              const prop = (Array.isArray(c.proprietario) ? c.proprietario[0] : c.proprietario) as { nome?: string } | null
              const venceu = (c.venc.dias ?? 0) < 0
              return (
                <Link key={c.id} href={`/painel/administracoes/${c.id}`} className="underline hover:no-underline">
                  {prop?.nome ?? c.codigo} ({venceu ? 'venceu' : `${c.venc.dias}d`}){i < Math.min(aRenovar.length, 4) - 1 ? ', ' : ''}
                </Link>
              )
            })}
            {aRenovar.length > 4 && <span> e mais {aRenovar.length - 4}.</span>}
          </div>
        </div>
      )}

      {lista.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Briefcase size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-700 mb-1">Nenhum contrato de administração ainda</p>
          <p className="text-xs text-gray-500 mb-4">
            Cadastre o vínculo de administração com cada proprietário pra gerenciar prazos, taxas e gerar contratos próprios.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {lista.map(c => {
              const prop = (Array.isArray(c.proprietario) ? c.proprietario[0] : c.proprietario) as Prop extends infer T ? T extends { nome: string } ? T : { nome: string } | null : never
              const propNome = (prop as { nome?: string } | null)?.nome ?? '—'
              const imovel = Array.isArray(c.imovel) ? c.imovel[0] : c.imovel
              const imovelNome = (imovel as { titulo?: string } | null)?.titulo ?? '—'
              const taxa = c.taxa_tipo === 'fixo' ? `R$ ${c.taxa_valor}` : `${c.taxa_valor}%`
              const corStatus = STATUS_COR[c.status] ?? 'bg-gray-100 text-gray-600'
              return (
                <Link
                  key={c.id}
                  href={`/painel/administracoes/${c.id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 sm:px-5 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between sm:contents">
                    <span className="text-xs font-mono text-gray-400 sm:w-28">{c.codigo}</span>
                    <span className={`text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full sm:order-last ${corStatus}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 truncate">
                      <User size={12} className="text-gray-400 shrink-0" />
                      {propNome}
                    </p>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1.5 truncate mt-0.5">
                      <Home size={11} className="text-gray-400 shrink-0" />
                      {imovelNome}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {(() => {
                      if (c.status !== 'ativo' || c.venc.dias == null) {
                        return <p className="text-xs text-gray-400">{c.data_termino ? `término ${fmtData(c.data_termino)}` : 'prazo indeterminado'}</p>
                      }
                      const dias = c.venc.dias
                      const janela = c.aviso_previo_dias ?? 60
                      const dataStr = c.venc.data ? c.venc.data.toLocaleDateString('pt-BR') : '—'
                      let cls = 'text-gray-500'
                      let texto: string
                      if (dias < 0) {
                        cls = 'text-red-600 font-semibold'
                        texto = c.venc.renovaAuto ? `renovar — venceu há ${Math.abs(dias)}d` : `venceu há ${Math.abs(dias)}d`
                      } else if (dias <= janela) {
                        cls = 'text-amber-700 font-semibold'
                        texto = c.venc.renovaAuto ? `renova em ${dias}d (auto)` : `vence em ${dias}d`
                      } else {
                        texto = c.venc.renovaAuto ? `renova ${dataStr}` : `vence ${dataStr}`
                      }
                      return (
                        <p className={`text-xs flex items-center justify-end gap-1 ${cls}`}>
                          <CalendarClock size={11} /> {texto}
                        </p>
                      )
                    })()}
                    <p className="text-sm font-bold text-violet-700 mt-0.5">{taxa}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
