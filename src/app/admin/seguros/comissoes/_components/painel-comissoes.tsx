'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  ShieldCheck, Flame, Loader2, CircleCheck, RotateCcw, Percent, Info, AlertTriangle,
} from 'lucide-react'
import { formatarBRL, formatarData } from '@/lib/formatters'
import { marcarComissaoRecebida, reabrirComissao, definirOverride } from '../actions'

interface Lado {
  percentual: number | null
  valor: number | null
  status: string
  recebidoEm: string | null
  valorRecebido: number | null
}

export interface LinhaComissao {
  id: string
  produto: 'fianca' | 'incendio'
  vendedor: string
  cliente: string | null
  seguradoraSigla: string | null
  apoliceNumero: string | null
  premioTotal: number
  competencia: string
  corretor: Lado
  plataforma: Lado
}

const hojeIso = () => new Date().toISOString().slice(0, 10)

const CLS_STATUS: Record<string, string> = {
  prevista:   'bg-gray-100 text-gray-600',
  confirmada: 'bg-blue-50 text-blue-700',
  recebida:   'bg-emerald-50 text-emerald-700',
  estornada:  'bg-rose-50 text-rose-700',
  cancelada:  'bg-gray-100 text-gray-400',
}

export function PainelComissoes({ linhas, overrideAtual }: {
  linhas: LinhaComissao[]
  overrideAtual: string
}) {
  const [filtro, setFiltro] = useState<'abertas' | 'todas'>('abertas')
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')

  const lista = useMemo(
    () => linhas.filter(l =>
      filtro === 'todas' ||
      l.plataforma.status === 'prevista' || l.plataforma.status === 'confirmada' ||
      l.corretor.status === 'prevista' || l.corretor.status === 'confirmada',
    ),
    [linhas, filtro],
  )

  const soma = (sel: (l: LinhaComissao) => Lado, status: string[]) =>
    linhas.filter(l => status.includes(sel(l).status))
      .reduce((s, l) => s + (sel(l).valorRecebido ?? sel(l).valor ?? 0), 0)

  const plataformaAReceber = soma(l => l.plataforma, ['prevista', 'confirmada'])
  const plataformaRecebido = soma(l => l.plataforma, ['recebida'])
  const corretoresAReceber = soma(l => l.corretor, ['prevista', 'confirmada'])
  const semOverride = linhas.some(
    l => l.plataforma.percentual == null &&
      (l.plataforma.status === 'prevista' || l.plataforma.status === 'confirmada'),
  )

  return (
    <div className="space-y-5">
      {erro && <p className="text-sm text-rose-700 bg-rose-50 rounded-xl px-4 py-3">{erro}</p>}
      {msg && <p className="text-sm text-emerald-800 bg-emerald-50 rounded-xl px-4 py-3">{msg}</p>}

      <ConfigOverride atual={overrideAtual} onErro={setErro} onOk={setMsg} />

      {semOverride && (
        <p className="text-xs text-amber-900 bg-amber-50 ring-1 ring-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
          <span>
            Há vendas registradas sem percentual de override. O prêmio — que é a
            base de cálculo — já está guardado; assim que você definir o
            percentual acima, essas linhas passam a mostrar valor.
          </span>
        </p>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Cartao rotulo="Override a receber" valor={formatarBRL(plataformaAReceber)} cor="violet" />
        <Cartao rotulo="Override já recebido" valor={formatarBRL(plataformaRecebido)} cor="emerald" />
        <Cartao rotulo="Comissão dos corretores" valor={formatarBRL(corretoresAReceber)} cor="gray"
          nota="paga direto pela corretora a eles" />
      </section>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-gray-900">Vendas</h2>
        <div className="flex gap-1 text-xs">
          {(['abertas', 'todas'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`px-2.5 py-1 rounded-lg font-semibold ${
                filtro === f ? 'bg-violet-700 text-white' : 'bg-white ring-1 ring-gray-200 text-gray-600'
              }`}
            >
              {f === 'abertas' ? 'Em aberto' : 'Todas'}
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-gray-100 p-10 text-center">
          <p className="text-sm text-gray-500">
            {filtro === 'abertas'
              ? 'Nada em aberto — tudo conciliado.'
              : 'Nenhuma venda de seguro registrada ainda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map(l => (
            <CartaoVenda key={l.id} linha={l} onErro={setErro} onOk={setMsg} />
          ))}
        </div>
      )}
    </div>
  )
}

function ConfigOverride({ atual, onErro, onOk }: {
  atual: string
  onErro: (s: string) => void
  onOk: (s: string) => void
}) {
  const [valor, setValor] = useState(atual)
  const [isPending, startTransition] = useTransition()

  const salvar = () => {
    onErro(''); onOk('')
    startTransition(async () => {
      const r = await definirOverride(Number(valor.replace(',', '.')))
      if (r.error) { onErro(r.error); return }
      onOk(`Override salvo. ${r.atualizadas} comissão(ões) em aberto recalculada(s).`)
    })
  }

  return (
    <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4">
      <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
        <Percent size={14} className="text-violet-600" /> Override da plataforma
      </h2>
      <div className="flex items-end gap-2 mt-2.5">
        <div className="w-32">
          <label className="text-xs font-medium text-gray-600 block mb-1">% sobre o prêmio</label>
          <input
            value={valor}
            onChange={e => setValor(e.target.value)}
            placeholder="ex.: 5"
            inputMode="decimal"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"
          />
        </div>
        <button
          type="button"
          onClick={salvar}
          disabled={isPending}
          className="rounded-xl bg-violet-700 hover:bg-violet-800 disabled:opacity-50 px-4 py-2 text-sm font-bold text-white flex items-center gap-1.5"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />} Salvar
        </button>
      </div>
      <p className="text-[11px] text-gray-500 mt-2 flex items-start gap-1.5 leading-snug">
        <Info size={11} className="mt-0.5 shrink-0 text-gray-400" />
        Aplica só às comissões ainda em aberto. Venda já recebida mantém a taxa
        do dia em que aconteceu — reescrever o passado faria nenhuma conferência
        antiga fechar. Enquanto a tabela da corretora não for acordada, este
        número é premissa de negociação.
      </p>
    </section>
  )
}

function CartaoVenda({ linha: l, onErro, onOk }: {
  linha: LinhaComissao
  onErro: (s: string) => void
  onOk: (s: string) => void
}) {
  const Icone = l.produto === 'fianca' ? ShieldCheck : Flame

  return (
    <div className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate flex items-center gap-1.5">
            <Icone size={14} className={l.produto === 'fianca' ? 'text-violet-600' : 'text-orange-600'} />
            {l.cliente ?? (l.produto === 'fianca' ? 'Seguro fiança' : 'Seguro incêndio')}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {l.vendedor} · {l.seguradoraSigla?.toUpperCase() ?? '—'}
            {l.apoliceNumero && <> · apólice {l.apoliceNumero}</>}
            {' · '}prêmio <strong className="text-gray-700">{formatarBRL(l.premioTotal)}</strong>
          </p>
        </div>
        <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">
          {formatarData(l.competencia)}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
        <LadoComissao id={l.id} lado="plataforma" rotulo="Override da plataforma" dados={l.plataforma} onErro={onErro} onOk={onOk} />
        <LadoComissao id={l.id} lado="corretor" rotulo="Comissão do corretor" dados={l.corretor} onErro={onErro} onOk={onOk} />
      </div>
    </div>
  )
}

function LadoComissao({ id, lado, rotulo, dados, onErro, onOk }: {
  id: string
  lado: 'corretor' | 'plataforma'
  rotulo: string
  dados: Lado
  onErro: (s: string) => void
  onOk: (s: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [valor, setValor] = useState(String(dados.valor ?? ''))
  const [data, setData] = useState(hojeIso())
  const [isPending, startTransition] = useTransition()

  const recebida = dados.status === 'recebida'
  const morta = dados.status === 'cancelada' || dados.status === 'estornada'

  const confirmar = () => {
    onErro(''); onOk('')
    startTransition(async () => {
      const r = await marcarComissaoRecebida({
        id, lado, valor: Number(valor.replace(',', '.')) || 0, data,
      })
      if (r.error) { onErro(r.error); return }
      setAberto(false)
      onOk('Recebimento registrado.')
    })
  }

  const reabrir = () => {
    onErro(''); onOk('')
    startTransition(async () => {
      const r = await reabrirComissao(id, lado)
      if (r.error) onErro(r.error)
    })
  }

  const divergente =
    recebida && dados.valor != null && dados.valorRecebido != null &&
    Math.abs(dados.valorRecebido - dados.valor) >= 0.01

  return (
    <div className="rounded-xl ring-1 ring-gray-100 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{rotulo}</p>
          <p className="text-base font-black text-gray-900 tabular-nums leading-tight">
            {dados.valor != null ? formatarBRL(dados.valorRecebido ?? dados.valor) : 'a definir'}
          </p>
          {dados.percentual != null && (
            <p className="text-[10px] text-gray-400">
              {(dados.percentual * 100).toFixed(2).replace('.', ',')}% do prêmio
              {dados.recebidoEm && <> · pago em {formatarData(dados.recebidoEm)}</>}
            </p>
          )}
          {divergente && (
            <p className="text-[10px] font-bold text-amber-700 mt-0.5">
              recebido difere do previsto ({formatarBRL(dados.valor!)})
            </p>
          )}
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${CLS_STATUS[dados.status] ?? CLS_STATUS.prevista}`}>
          {dados.status}
        </span>
      </div>

      {!morta && (
        <div className="mt-2">
          {recebida ? (
            <button
              type="button"
              onClick={reabrir}
              disabled={isPending}
              className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <RotateCcw size={10} /> Reabrir
            </button>
          ) : aberto ? (
            <div className="flex gap-1.5">
              <input
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="valor"
                inputMode="decimal"
                className="w-24 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900"
              />
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900"
              />
              <button
                type="button"
                onClick={confirmar}
                disabled={isPending}
                className="rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-50 px-2.5 py-1.5 text-xs font-bold text-white shrink-0"
              >
                {isPending ? <Loader2 size={11} className="animate-spin" /> : 'OK'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAberto(true)}
              className="text-[11px] font-semibold text-violet-700 hover:text-violet-800 flex items-center gap-1"
            >
              <CircleCheck size={10} /> Marcar recebida
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Cartao({ rotulo, valor, cor, nota }: {
  rotulo: string
  valor: string
  cor: 'violet' | 'emerald' | 'gray'
  nota?: string
}) {
  const cls = {
    violet: 'bg-violet-50 text-violet-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    gray: 'bg-gray-50 text-gray-800',
  }[cor]

  return (
    <div className={`rounded-2xl px-3.5 py-3 ${cls}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{rotulo}</p>
      <p className="text-xl font-black tabular-nums leading-tight mt-0.5">{valor}</p>
      {nota && <p className="text-[10px] opacity-70 mt-0.5">{nota}</p>}
    </div>
  )
}
