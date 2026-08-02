import Link from 'next/link'
import {
  ArrowLeft, ArrowDownLeft, ArrowUpRight, AlertTriangle, Activity,
} from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = { title: 'Log de integração — seguros' }
export const dynamic = 'force-dynamic'

const POR_PAGINA = 50

interface Props {
  searchParams: Promise<{ p?: string; filtro?: string }>
}

/**
 * Trilha de integração.
 *
 * Serve pra depurar, mas o motivo real de existir é outro: numa
 * divergência de comissão, é o que prova que a cotação saiu daqui — com
 * horário, endpoint e resposta da corretora.
 */
export default async function EventosSegurosPage({ searchParams }: Props) {
  const { p, filtro } = await searchParams
  const pagina = Math.max(1, parseInt(p ?? '1', 10) || 1)
  const admin = createAdminClient()

  let query = admin
    .from('seguro_eventos')
    .select('id, user_id, analise_id, direcao, endpoint, http_status, duracao_ms, erro, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filtro === 'erros') query = query.not('erro', 'is', null)
  if (filtro === 'entrada') query = query.eq('direcao', 'entrada')

  const { data: eventos, count } = await query
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)

  const total = count ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  const href = (novaPagina: number, novoFiltro?: string) => {
    const sp = new URLSearchParams()
    if (novoFiltro) sp.set('filtro', novoFiltro)
    if (novaPagina > 1) sp.set('p', String(novaPagina))
    const qs = sp.toString()
    return qs ? `/admin/seguros/eventos?${qs}` : '/admin/seguros/eventos'
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div>
        <Link href="/admin/seguros" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Seguros
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Activity size={20} className="text-gray-400" /> Log de integração
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Toda chamada à corretora e todo webhook recebido. É a prova de
          originação numa divergência de comissão.
        </p>
      </div>

      <div className="flex gap-1.5">
        <Chip href={href(1)} ativo={!filtro}>Tudo</Chip>
        <Chip href={href(1, 'erros')} ativo={filtro === 'erros'}>Só erros</Chip>
        <Chip href={href(1, 'entrada')} ativo={filtro === 'entrada'}>Webhooks</Chip>
      </div>

      {(eventos ?? []).length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-gray-100 p-10 text-center">
          <p className="text-sm text-gray-500">Nenhum evento registrado.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white ring-1 ring-gray-100 divide-y divide-gray-50 overflow-hidden">
          {(eventos ?? []).map(e => {
            const entrada = e.direcao === 'entrada'
            const falhou = !!e.erro || (e.http_status != null && e.http_status >= 400)
            return (
              <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                <span className={`shrink-0 w-7 h-7 rounded-lg grid place-items-center ${
                  falhou ? 'bg-rose-50' : entrada ? 'bg-blue-50' : 'bg-gray-50'
                }`}>
                  {falhou
                    ? <AlertTriangle size={13} className="text-rose-600" />
                    : entrada
                      ? <ArrowDownLeft size={13} className="text-blue-600" />
                      : <ArrowUpRight size={13} className="text-gray-500" />}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{e.endpoint}</p>
                  {e.erro && (
                    <p className="text-[11px] text-rose-700 line-clamp-2 mt-0.5">{e.erro}</p>
                  )}
                  <p className="text-[11px] text-gray-400 tabular-nums mt-0.5">
                    {new Date(e.created_at).toLocaleString('pt-BR')}
                    {e.http_status != null && <> · HTTP {e.http_status}</>}
                    {e.duracao_ms != null && <> · {e.duracao_ms}ms</>}
                    {entrada && <> · webhook</>}
                  </p>
                </div>

                {e.analise_id && (
                  <Link
                    href={`/painel/seguros/fianca/${e.analise_id}`}
                    className="shrink-0 text-[11px] font-semibold text-violet-700 hover:text-violet-800"
                  >
                    análise
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-3">
          <PagLink href={href(pagina - 1, filtro)} desabilitado={pagina <= 1}>Anterior</PagLink>
          <p className="text-xs text-gray-500">
            Página {pagina} de {totalPaginas} · {total} evento(s)
          </p>
          <PagLink href={href(pagina + 1, filtro)} desabilitado={pagina >= totalPaginas}>Próxima</PagLink>
        </div>
      )}
    </div>
  )
}

function Chip({ href, ativo, children }: { href: string; ativo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
        ativo
          ? 'bg-violet-700 border-violet-700 text-white'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </Link>
  )
}

function PagLink({ href, desabilitado, children }: {
  href: string; desabilitado: boolean; children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-disabled={desabilitado}
      className={`px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 ${
        desabilitado ? 'opacity-40 pointer-events-none' : ''
      }`}
    >
      {children}
    </Link>
  )
}
