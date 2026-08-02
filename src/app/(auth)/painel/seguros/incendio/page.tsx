import Link from 'next/link'
import { Flame, Plus, Search, AlertTriangle, FlaskConical, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { verificarPerfilParaSeguros } from '@/lib/seguros/imobiliaria'
import { formatarBRL } from '@/lib/formatters'
import { VIGENCIA_LABEL, type TipoVigencia } from '@/lib/seguros/incendio/tipos'
import { estimarProLabore } from '@/lib/seguros/incendio/sugestoes'
import { Paginacao } from '../_components/paginacao'
import { AvisoDemo } from '../_components/aviso-demo'
import { BuscaIncendio } from './_components/busca-incendio'

const POR_PAGINA = 20

const STATUS: Record<string, { label: string; cls: string }> = {
  rascunho:   { label: 'Rascunho',   cls: 'bg-gray-100 text-gray-600' },
  calculada:  { label: 'Cotado',     cls: 'bg-amber-100 text-amber-700' },
  contratada: { label: 'Contratado', cls: 'bg-emerald-100 text-emerald-700' },
  cancelada:  { label: 'Cancelado',  cls: 'bg-gray-100 text-gray-500' },
  erro:       { label: 'Erro',       cls: 'bg-rose-100 text-rose-700' },
}

interface Props {
  searchParams: Promise<{ q?: string; status?: string; p?: string }>
}

export const metadata = { title: 'Seguro incêndio' }

/** Fora do componente: `Date.now()` no render viola react-hooks/purity. */
function venceEmDias(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso + 'T00:00:00').getTime() - Date.now()) / 86400000)
}

export default async function SeguroIncendioPage({ searchParams }: Props) {
  const acesso = await exigirAcessoCRM()
  const { q, status, p } = await searchParams
  const pagina = Math.max(1, parseInt(p ?? '1', 10) || 1)

  const supabase = await createClient()
  const admin = createAdminClient()
  const perfil = await verificarPerfilParaSeguros(admin, acesso.userId)

  let query = supabase
    .from('seguro_incendio_apolices')
    .select(
      `id, seguradora, ambiente, tipo_seguro, tipo_vigencia, status,
       valor_aluguel, premio_total, valor_parcela, qtd_parcelas,
       inicio_vigencia, fim_vigencia, codigo_seguro, numero_proposta,
       inquilino, endereco, erro, created_at,
       imovel:imoveis(titulo), contrato:contratos_locacao(codigo)`,
      { count: 'exact' },
    )
    .eq('user_id', acesso.userId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, count } = await query
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)

  const um = <T,>(v: unknown): T | null =>
    (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) as T | null

  // Busca por inquilino e endereço fica aqui: os dois vivem em JSONB, e
  // filtrar no banco exigiria índice de expressão pra pouco ganho.
  const termo = q?.trim().toLowerCase() ?? ''
  const lista = (data ?? []).filter(l => {
    if (!termo) return true
    const inq = l.inquilino as { nome?: string; cpfCnpj?: string } | null
    const end = l.endereco as { endereco?: string } | null
    return [
      inq?.nome, inq?.cpfCnpj, end?.endereco, l.codigo_seguro,
      l.numero_proposta, um<{ codigo: string }>(l.contrato)?.codigo,
    ].filter(Boolean).join(' ').toLowerCase().includes(termo)
  })

  const total = count ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  // Pró-labore do que está contratado — o que o corretor de fato ganhou.
  const proLaboreMes = (data ?? [])
    .filter(l => l.status === 'contratada')
    .reduce((s, l) => s + estimarProLabore(Number(l.premio_total) || 0), 0)

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto pb-24">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Flame size={20} className="text-orange-500" /> Seguro incêndio
          </h1>
          <p className="text-sm text-gray-500">
            Obrigatório na locação pela Lei do Inquilinato.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/painel/seguros/incendio/faturamento"
            className="flex items-center gap-1.5 rounded-xl ring-1 ring-gray-200 hover:bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700"
          >
            <Receipt size={15} /> Faturas
          </Link>
          <Link
            href="/painel/seguros/incendio/nova"
            className="flex items-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus size={15} /> Nova cotação
          </Link>
        </div>
      </div>

      <AvisoDemo />

      {!perfil.pronto && (
        <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Complete seu perfil pra cotar</p>
            <p className="text-xs text-amber-800 mt-0.5">
              Falta: {perfil.faltando?.join(', ')}.{' '}
              <Link href="/painel/perfil" className="underline font-medium">Editar perfil</Link>
            </p>
          </div>
        </div>
      )}

      {proLaboreMes > 0 && (
        <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Pró-labore das apólices contratadas
          </p>
          <p className="text-2xl font-black text-emerald-900 tabular-nums">
            {formatarBRL(proLaboreMes)}
          </p>
          <p className="text-[11px] text-emerald-800">
            Estimativa a 20% do prêmio — confirme a tabela com a corretora.
          </p>
        </div>
      )}

      <BuscaIncendio q={q} status={status} />

      {lista.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-gray-100 p-10 text-center">
          <Search size={26} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            {q || status ? 'Nenhuma apólice com esse filtro.' : 'Nenhuma cotação ainda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map(l => {
            const inq = l.inquilino as { nome?: string } | null
            const end = l.endereco as { endereco?: string; numero?: string } | null
            const imovel = um<{ titulo: string }>(l.imovel)
            const contrato = um<{ codigo: string }>(l.contrato)
            const st = STATUS[l.status] ?? STATUS.rascunho
            const dias = l.status === 'contratada' ? venceEmDias(l.fim_vigencia) : null
            const vencendo = dias != null && dias <= 30

            return (
              <Link
                key={l.id}
                href={`/painel/seguros/incendio/${l.id}`}
                className="block rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm px-4 py-3.5 active:bg-gray-50 hover:ring-orange-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold text-gray-900 truncate leading-tight">
                      {inq?.nome ?? 'Sem inquilino'}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {imovel?.titulo ?? end?.endereco ?? '—'}
                      {contrato?.codigo && <> · {contrato.codigo}</>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${st.cls}`}>
                      {st.label}
                    </span>
                    {l.ambiente === 2 && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <FlaskConical size={9} /> teste
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-orange-50 text-orange-700">
                    {l.seguradora}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-1 rounded-lg bg-gray-50 text-gray-600">
                    {VIGENCIA_LABEL[l.tipo_vigencia as TipoVigencia] ?? '—'}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-1 rounded-lg bg-gray-50 text-gray-600">
                    {l.tipo_seguro === 'C' ? 'Comercial' : 'Residencial'}
                  </span>
                  {vencendo && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-rose-50 text-rose-700">
                      {dias! < 0 ? 'vencida' : `vence em ${dias}d`}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between gap-2 mt-2.5 pt-2.5 border-t border-gray-50">
                  <p className="text-[11px] text-gray-400 truncate">
                    {new Date(l.created_at).toLocaleDateString('pt-BR')}
                    {l.codigo_seguro && <> · nº {l.codigo_seguro}</>}
                  </p>
                  {l.premio_total != null && (
                    <p className="text-sm font-bold text-gray-900 tabular-nums shrink-0">
                      {l.qtd_parcelas && l.qtd_parcelas > 1 && l.valor_parcela != null
                        ? <>{l.qtd_parcelas}× {formatarBRL(l.valor_parcela)}</>
                        : formatarBRL(l.premio_total)}
                    </p>
                  )}
                </div>

                {l.erro && (
                  <p className="text-[11px] text-rose-600 mt-1.5 line-clamp-1">{l.erro}</p>
                )}
              </Link>
            )
          })}
        </div>
      )}

      <Paginacao
        pagina={pagina}
        totalPaginas={totalPaginas}
        total={total}
        base="/painel/seguros/incendio"
        params={{ q, status }}
      />
    </div>
  )
}
