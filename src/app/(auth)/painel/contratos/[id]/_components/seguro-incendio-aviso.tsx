'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Loader2, X, ShieldOff, ShieldCheck } from 'lucide-react'
import { dispensarSeguroIncendio, exigirSeguroIncendio } from '../actions-apolices'
import type { ResultadoSeguroIncendio } from '@/lib/crm/seguro-incendio-situacao'
import { mensagemSeguroIncendio } from '@/lib/crm/seguro-incendio-situacao'

/**
 * Aviso do seguro incêndio (v104).
 *
 * Aparece quando a apólice venceu, está pra vencer, não existe, ou acaba
 * antes do fim da locação — o caso da prorrogação, em que o contrato foi
 * estendido e a apólice de 12 meses ficou para trás.
 *
 * Só some com ação: apólice nova anexada (a renovação em si) ou dispensa
 * registrada. Some sozinho quando o contrato encerra.
 */
export function SeguroIncendioAviso({
  contratoId, resultado,
}: {
  contratoId: string
  resultado: ResultadoSeguroIncendio
}) {
  const router = useRouter()
  const [dispensando, setDispensando] = useState(false)
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const voltarAExigir = () => {
    setErro('')
    startTransition(async () => {
      const r = await exigirSeguroIncendio(contratoId)
      if (r.error) { setErro(r.error); return }
      router.refresh()
    })
  }

  if (resultado.situacao === 'dispensado') {
    return (
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-3 flex items-start gap-2 flex-wrap">
        <ShieldOff size={15} className="text-gray-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-[12rem]">
          <p className="text-xs text-gray-600">{mensagemSeguroIncendio(resultado)}</p>
          {erro && <p className="text-xs text-rose-600 mt-1">{erro}</p>}
        </div>
        <button
          type="button"
          onClick={voltarAExigir}
          disabled={isPending}
          className="flex items-center gap-1 text-xs text-violet-700 hover:bg-violet-50 px-2.5 py-1.5 rounded-lg disabled:opacity-40"
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
          Voltar a exigir
        </button>
      </section>
    )
  }

  if (!resultado.pendente) return null

  // Sem cobertura hoje é vermelho; o resto é prazo, e prazo é âmbar.
  const grave = resultado.situacao === 'vencida' || resultado.situacao === 'sem_apolice'
  const cor = grave
    ? { fundo: 'bg-rose-50', borda: 'border-rose-200', titulo: 'text-rose-900', texto: 'text-rose-800', icone: 'text-rose-600' }
    : { fundo: 'bg-amber-50', borda: 'border-amber-200', titulo: 'text-amber-900', texto: 'text-amber-800', icone: 'text-amber-600' }

  const TITULOS: Partial<Record<ResultadoSeguroIncendio['situacao'], string>> = {
    sem_apolice: 'Seguro incêndio sem apólice anexada',
    sem_vigencia: 'Seguro incêndio com vigência desconhecida',
    vencida: 'Seguro incêndio vencido',
    vence_em_breve: 'Seguro incêndio vencendo',
    descoberto_ate_fim: 'Seguro incêndio acaba antes do contrato',
  }
  const titulo = TITULOS[resultado.situacao] ?? 'Seguro incêndio'

  return (
    <section className={`${cor.fundo} rounded-2xl border ${cor.borda} p-4`}>
      <div className="flex items-start gap-2">
        <Flame size={16} className={`${cor.icone} shrink-0 mt-0.5`} />
        <div className="flex-1">
          <h2 className={`text-sm font-bold ${cor.titulo}`}>{titulo}</h2>
          <p className={`text-xs ${cor.texto} mt-0.5`}>{mensagemSeguroIncendio(resultado)}</p>
          <p className={`text-[11px] ${cor.texto} opacity-80 mt-1`}>
            Renove em <strong>Apólices</strong>, logo abaixo: anexe o PDF da apólice nova e o aviso sai.
            Enquanto não houver apólice válida, ele continua aqui.
          </p>
          {erro && <p className="text-xs text-rose-600 mt-1">{erro}</p>}

          <button
            type="button"
            onClick={() => { setErro(''); setDispensando(true) }}
            className={`mt-2 flex items-center gap-1 text-xs ${cor.texto} hover:underline`}
          >
            <ShieldOff size={12} /> Não exigir neste contrato
          </button>
        </div>
      </div>

      {dispensando && (
        <ModalDispensa
          contratoId={contratoId}
          onFechar={() => setDispensando(false)}
          onPronto={() => { setDispensando(false); router.refresh() }}
        />
      )}
    </section>
  )
}

function ModalDispensa({
  contratoId, onFechar, onPronto,
}: {
  contratoId: string
  onFechar: () => void
  onPronto: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const salvar = () => {
    setErro('')
    startTransition(async () => {
      const r = await dispensarSeguroIncendio(contratoId, motivo)
      if (r.error) { setErro(r.error); return }
      onPronto()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isPending && onFechar()}>
      <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ShieldOff size={16} className="text-gray-500" /> Não exigir seguro incêndio
          </h2>
          <button type="button" onClick={onFechar} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mb-3">
          O aviso some deste contrato. Vale só para ele — o próximo contrato do mesmo imóvel
          volta a cobrar a apólice. Dá pra voltar atrás quando quiser.
        </p>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Por quê? *</label>
        <input
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Ex: seguro coletivo do condomínio"
          autoFocus
          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900 mb-3"
        />

        {erro && <p className="text-xs text-rose-600 mb-2">{erro}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onFechar} disabled={isPending} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={isPending || !motivo.trim()}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <ShieldOff size={13} />}
            Dispensar
          </button>
        </div>
      </div>
    </div>
  )
}
