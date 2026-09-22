'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, Loader2, X, Check, Trash2, Plus } from 'lucide-react'
import { formatarBRL, formatarData } from '@/lib/formatters'
import { abrirSinistro, encerrarSinistro, excluirSinistro } from '../actions-sinistro'

/**
 * Sinistro do seguro fiança (v102).
 *
 * A seção só faz sentido em contrato com garantia de seguro fiança, e é
 * onde o corretor responde duas perguntas: "a seguradora assumiu?" e
 * "quanto ela já cobriu?". Enquanto há sinistro aberto, o modal de
 * pagamento das parcelas passa a perguntar quem pagou.
 */

export interface SinistroRow {
  id: string
  seguradora: string | null
  numero: string | null
  aberto_em: string
  encerrado_em: string | null
  status: string
  motivo: string | null
  observacoes: string | null
  /** Quanto a seguradora já cobriu neste sinistro. */
  total_coberto: number
  /** Quantas parcelas entraram nele. */
  parcelas_cobertas: number
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"
const HOJE = (): string => new Date().toISOString().slice(0, 10)

export function SinistroSecao({
  contratoId, sinistros, seguradoraPadrao,
}: {
  contratoId: string
  sinistros: SinistroRow[]
  seguradoraPadrao: string | null
}) {
  const router = useRouter()
  const [abrindo, setAbrindo] = useState(false)
  const [encerrando, setEncerrando] = useState<SinistroRow | null>(null)
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const aberto = sinistros.find(s => s.status === 'aberto') ?? null
  const encerrados = sinistros.filter(s => s.status !== 'aberto')

  const excluir = (s: SinistroRow) => {
    if (!confirm('Apagar este sinistro? As parcelas já marcadas como pagas pela seguradora continuam como estão.')) return
    setErro('')
    startTransition(async () => {
      const r = await excluirSinistro(s.id)
      if (r.error) { setErro(r.error); return }
      router.refresh()
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ShieldAlert size={14} className={aberto ? 'text-amber-600' : 'text-gray-400'} />
          Sinistro do seguro fiança
          {aberto && (
            <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
              aberto
            </span>
          )}
        </h2>
        {!aberto && (
          <button
            type="button"
            onClick={() => { setErro(''); setAbrindo(true) }}
            className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-800 border border-violet-200 hover:bg-violet-50 px-2.5 py-1 rounded-lg transition-colors"
          >
            <Plus size={12} /> Abrir sinistro
          </button>
        )}
      </div>

      {erro && <p className="text-xs text-rose-600 mb-2">{erro}</p>}

      {!aberto && encerrados.length === 0 && (
        <p className="text-xs text-gray-400">
          Nenhum sinistro. Abra quando o locatário parar de pagar e a seguradora assumir os aluguéis —
          as parcelas cobertas passam a ser marcadas como pagas por ela.
        </p>
      )}

      {aberto && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {aberto.seguradora?.trim() || 'Seguradora não informada'}
                {aberto.numero?.trim() && (
                  <span className="font-normal text-gray-500"> · sinistro nº {aberto.numero}</span>
                )}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Aberto em {formatarData(aberto.aberto_em)}
                {aberto.motivo?.trim() ? ` · ${aberto.motivo}` : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-blue-700">{formatarBRL(aberto.total_coberto)}</p>
              <p className="text-[10px] text-gray-500">
                {aberto.parcelas_cobertas} parcela{aberto.parcelas_cobertas === 1 ? '' : 's'} coberta{aberto.parcelas_cobertas === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-gray-600 mt-2 leading-snug">
            Ao confirmar o pagamento de uma parcela, escolha <strong>Seguradora</strong> para lançá-la aqui.
            O proprietário continua recebendo o repasse normalmente.
          </p>

          <div className="flex items-center gap-1 mt-2 flex-wrap">
            <button
              type="button"
              onClick={() => { setErro(''); setEncerrando(aberto) }}
              disabled={isPending}
              className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg"
            >
              <Check size={13} /> Encerrar sinistro
            </button>
            <button
              type="button"
              onClick={() => excluir(aberto)}
              disabled={isPending}
              className="text-gray-300 hover:text-rose-600 p-1.5 disabled:opacity-40"
              title="Apagar (aberto por engano)"
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        </div>
      )}

      {encerrados.length > 0 && (
        <div className={aberto ? 'mt-3' : ''}>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Encerrados</p>
          <ul className="divide-y divide-gray-50">
            {encerrados.map(s => (
              <li key={s.id} className="py-1.5 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-gray-600">
                  {s.seguradora?.trim() || 'Seguradora não informada'}
                  {s.numero?.trim() ? ` · nº ${s.numero}` : ''}
                  <span className="text-gray-400">
                    {' '}· {formatarData(s.aberto_em)} a {s.encerrado_em ? formatarData(s.encerrado_em) : '—'}
                  </span>
                </span>
                <span className="text-xs text-gray-500">
                  {formatarBRL(s.total_coberto)} em {s.parcelas_cobertas} parcela{s.parcelas_cobertas === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {abrindo && (
        <ModalAbrir
          contratoId={contratoId}
          seguradoraPadrao={seguradoraPadrao}
          onFechar={() => setAbrindo(false)}
          onPronto={() => { setAbrindo(false); router.refresh() }}
        />
      )}

      {encerrando && (
        <ModalEncerrar
          sinistro={encerrando}
          onFechar={() => setEncerrando(null)}
          onPronto={() => { setEncerrando(null); router.refresh() }}
        />
      )}
    </section>
  )
}

function ModalAbrir({
  contratoId, seguradoraPadrao, onFechar, onPronto,
}: {
  contratoId: string
  seguradoraPadrao: string | null
  onFechar: () => void
  onPronto: () => void
}) {
  const [seguradora, setSeguradora] = useState(seguradoraPadrao ?? '')
  const [numero, setNumero] = useState('')
  const [abertoEm, setAbertoEm] = useState(HOJE())
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const salvar = () => {
    setErro('')
    startTransition(async () => {
      const r = await abrirSinistro({
        contrato_id: contratoId,
        seguradora, numero, aberto_em: abertoEm, motivo,
      })
      if (r.error) { setErro(r.error); return }
      onPronto()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isPending && onFechar()}>
      <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-600" /> Abrir sinistro
          </h2>
          <button type="button" onClick={onFechar} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mb-3">
          O contrato passa a <strong>inadimplente</strong>, e as parcelas que a seguradora pagar
          ficam marcadas como dela. O repasse ao proprietário continua igual.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Seguradora</label>
            <input value={seguradora} onChange={e => setSeguradora(e.target.value)} placeholder="Ex: Pottencial" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nº do sinistro</label>
            <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="O que a seguradora informar" className={inputCls} />
          </div>
        </div>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Aberto em *</label>
        <input type="date" value={abertoEm} onChange={e => setAbertoEm(e.target.value)} className={`${inputCls} mb-3`} />

        <label className="block text-xs font-semibold text-gray-600 mb-1">Motivo</label>
        <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: inadimplência a partir de março" className={`${inputCls} mb-3`} />

        {erro && <p className="text-xs text-rose-600 mb-2">{erro}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onFechar} disabled={isPending} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={isPending} className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <ShieldAlert size={13} />}
            Abrir sinistro
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalEncerrar({
  sinistro, onFechar, onPronto,
}: {
  sinistro: SinistroRow
  onFechar: () => void
  onPronto: () => void
}) {
  const [encerradoEm, setEncerradoEm] = useState(HOJE())
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const salvar = () => {
    setErro('')
    startTransition(async () => {
      const r = await encerrarSinistro({
        sinistro_id: sinistro.id,
        encerrado_em: encerradoEm,
        motivo,
      })
      if (r.error) { setErro(r.error); return }
      onPronto()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isPending && onFechar()}>
      <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Check size={16} className="text-green-600" /> Encerrar sinistro
          </h2>
          <button type="button" onClick={onFechar} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mb-3">
          As próximas parcelas voltam a ser cobradas do locatário e o contrato volta a <strong>ativo</strong>.
          As {sinistro.parcelas_cobertas} já cobertas continuam como estão — a seguradora cobra esse valor
          dele por fora.
        </p>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Encerrado em *</label>
        <input type="date" value={encerradoEm} onChange={e => setEncerradoEm(e.target.value)} className={`${inputCls} mb-3`} />

        <label className="block text-xs font-semibold text-gray-600 mb-1">Motivo</label>
        <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: locatário retomou os pagamentos" className={`${inputCls} mb-3`} />

        {erro && <p className="text-xs text-rose-600 mb-2">{erro}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onFechar} disabled={isPending} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={isPending} className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Encerrar
          </button>
        </div>
      </div>
    </div>
  )
}
