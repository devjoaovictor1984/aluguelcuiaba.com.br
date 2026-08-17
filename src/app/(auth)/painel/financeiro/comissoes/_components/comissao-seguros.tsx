import Link from 'next/link'
import { ShieldCheck, Flame, Clock, CircleCheck, Ban, Info } from 'lucide-react'
import { formatarBRL, formatarData } from '@/lib/formatters'

/**
 * A parte de seguros do extrato de comissão.
 *
 * Vive dentro da mesma tela da comissão de aluguel de propósito: o
 * corretor abre um lugar para saber quanto ganhou no mês, não dois.
 *
 * Mas os números aparecem separados, e não somados no total, porque as
 * duas comissões têm naturezas diferentes. A de aluguel já é dinheiro
 * dele — passou pela mão dele quando reteve a taxa. A de seguro é
 * expectativa: a corretora paga depois, pode pagar diferente, pode
 * estornar. Somar as duas num número só faria o corretor contar com
 * dinheiro que ainda não existe.
 */

export interface ComissaoSeguroView {
  id: string
  produto: 'fianca' | 'incendio'
  seguradoraSigla: string | null
  apoliceNumero: string | null
  cliente: string | null
  contratoCodigo: string | null
  contratoId: string | null
  premioTotal: number
  percentual: number | null
  valor: number | null
  status: string
  recebidoEm: string | null
  valorRecebido: number | null
  competencia: string
}

const STATUS_UI: Record<string, { label: string; cls: string; icone: typeof Clock }> = {
  prevista:   { label: 'Prevista',   cls: 'bg-gray-100 text-gray-600',       icone: Clock },
  confirmada: { label: 'Confirmada', cls: 'bg-blue-50 text-blue-700',        icone: CircleCheck },
  recebida:   { label: 'Recebida',   cls: 'bg-emerald-50 text-emerald-700',  icone: CircleCheck },
  estornada:  { label: 'Estornada',  cls: 'bg-rose-50 text-rose-700',        icone: Ban },
  cancelada:  { label: 'Cancelada',  cls: 'bg-gray-100 text-gray-400',       icone: Ban },
}

export function ComissaoSeguros({ linhas, rotuloPeriodo }: {
  linhas: ComissaoSeguroView[]
  rotuloPeriodo: string
}) {
  if (linhas.length === 0) return null

  const vivas = linhas.filter(l => l.status !== 'cancelada' && l.status !== 'estornada')
  const aReceber = vivas
    .filter(l => l.status !== 'recebida')
    .reduce((s, l) => s + (l.valor ?? 0), 0)
  const recebido = linhas
    .filter(l => l.status === 'recebida')
    .reduce((s, l) => s + (l.valorRecebido ?? l.valor ?? 0), 0)

  const semPercentual = vivas.some(l => l.percentual == null)

  return (
    <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          <ShieldCheck size={15} className="text-violet-600" />
          Comissão de seguros
        </h2>
        <span className="text-[11px] text-gray-400">{rotuloPeriodo}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-violet-50 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">A receber</p>
          <p className="text-xl font-extrabold text-violet-800 tabular-nums leading-tight">
            {formatarBRL(aReceber)}
          </p>
        </div>
        <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Já recebido</p>
          <p className="text-xl font-extrabold text-emerald-800 tabular-nums leading-tight">
            {formatarBRL(recebido)}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {linhas.map(l => {
          const ui = STATUS_UI[l.status] ?? STATUS_UI.prevista
          const Icone = l.produto === 'fianca' ? ShieldCheck : Flame
          const morta = l.status === 'cancelada' || l.status === 'estornada'

          return (
            <div
              key={l.id}
              className={`rounded-xl ring-1 ring-gray-100 px-3 py-2.5 ${morta ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1.5">
                    <Icone size={13} className={l.produto === 'fianca' ? 'text-violet-600' : 'text-orange-600'} />
                    {l.cliente ?? (l.produto === 'fianca' ? 'Seguro fiança' : 'Seguro incêndio')}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {l.seguradoraSigla?.toUpperCase() ?? '—'}
                    {l.apoliceNumero && <> · apólice {l.apoliceNumero}</>}
                    {l.contratoCodigo && (
                      <>
                        {' · '}
                        {l.contratoId
                          ? <Link href={`/painel/contratos/${l.contratoId}`} className="underline hover:text-violet-700">{l.contratoCodigo}</Link>
                          : l.contratoCodigo}
                      </>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    prêmio {formatarBRL(l.premioTotal)}
                    {l.percentual != null && <> · {(l.percentual * 100).toFixed(0).replace('.', ',')}%</>}
                    {l.recebidoEm && <> · pago em {formatarData(l.recebidoEm)}</>}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900 tabular-nums">
                    {l.valor != null ? formatarBRL(l.valorRecebido ?? l.valor) : 'a definir'}
                  </p>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${ui.cls}`}>
                    <ui.icone size={9} /> {ui.label}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {semPercentual ? (
        <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-3 py-2 flex items-start gap-1.5 leading-snug">
          <Info size={11} className="mt-0.5 shrink-0" />
          A tabela de comissionamento da corretora ainda não foi acordada, então
          o valor de algumas linhas aparece como <strong>a definir</strong>. O
          prêmio, que é a base de cálculo, já está registrado — quando o
          percentual for fechado, o valor aparece sem você refazer nada.
        </p>
      ) : (
        <p className="text-[11px] text-gray-500 flex items-start gap-1.5 leading-snug">
          <Info size={11} className="mt-0.5 shrink-0 text-gray-400" />
          Estes valores não entram no total de comissão de aluguel acima: a
          comissão de aluguel já é sua no momento em que a parcela é paga; a de
          seguro é paga pela corretora depois, e por isso tem estado próprio.
        </p>
      )}
    </section>
  )
}
