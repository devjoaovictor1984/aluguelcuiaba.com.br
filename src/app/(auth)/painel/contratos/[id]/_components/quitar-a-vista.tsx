'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, X, Check, Loader2 } from 'lucide-react'
import { formatarBRL } from '@/lib/formatters'
import { bulkMarcarPagamento } from '../../actions'

interface Props {
  parcelaIdsAbertas: string[]
  valorAberto: number
  dataSugerida: string   // YYYY-MM-DD — data do pagamento antecipado ou hoje
}

/**
 * Botão de 1 clique para fechar um contrato pago à vista: marca TODAS as
 * parcelas em aberto como pagas na data em que o valor foi recebido.
 * O repasse ao proprietário segue mensal (não é tocado aqui).
 */
export function QuitarAVista({ parcelaIdsAbertas, valorAberto, dataSugerida }: Props) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [data, setData] = useState(dataSugerida)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [isPending, startTransition] = useTransition()

  const qtd = parcelaIdsAbertas.length

  const confirmar = () => {
    setErro(''); setOk('')
    if (!data) { setErro('Informe a data do recebimento.'); return }
    startTransition(async () => {
      const r = await bulkMarcarPagamento({ parcela_ids: parcelaIdsAbertas, data_pagamento: data })
      if (r.error) { setErro(r.error); return }
      setOk(`✓ ${r.atualizadas} parcela${r.atualizadas === 1 ? '' : 's'} quitada${r.atualizadas === 1 ? '' : 's'} à vista.`)
      setTimeout(() => { setAberto(false); router.refresh() }, 1200)
    })
  }

  return (
    <>
      <button
        onClick={() => { setData(dataSugerida); setErro(''); setOk(''); setAberto(true) }}
        title="Marcar todas as parcelas em aberto como pagas na data do recebimento"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg"
      >
        <Wallet size={13} /> Quitar à vista
      </button>

      {aberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAberto(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Wallet size={16} className="text-green-600" /> Quitar à vista
              </h3>
              <button onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Marca as <strong>{qtd} parcela{qtd === 1 ? '' : 's'} em aberto</strong> ({formatarBRL(valorAberto)})
                como pagas de uma vez, na data em que você recebeu. O repasse ao proprietário continua mensal.
              </p>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Data do recebimento *</label>
                <input type="date" value={data} onChange={e => setData(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
              {erro && <p className="text-xs text-red-600">{erro}</p>}
              {ok && <p className="text-xs text-green-700 font-medium flex items-center gap-1"><Check size={12} />{ok}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setAberto(false)} disabled={isPending}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100">
                Cancelar
              </button>
              <button onClick={confirmar} disabled={isPending || qtd === 0}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
                {isPending && <Loader2 size={14} className="animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
