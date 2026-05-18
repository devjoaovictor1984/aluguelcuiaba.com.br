'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, X, Loader2, AlertCircle, Check } from 'lucide-react'
import { InputMoeda, InputPercentual } from '@/components/inputs/input-mascarado'
import { parseMoney, parsePercentual, formatarBRL } from '@/lib/formatters'
import { regerarParcelas, type RegerarParcelasInput } from '../../actions'

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"

interface Props {
  contratoId: string
  contratoCodigo: string
  diaVencimentoAtual: number
  dataPrimeiroAluguelAtual: string
  valorAluguelAtual: number
  valorSeguroAtual: number
  iptuAtual: number
  condominioAtual: number
  taxaAdminTipo: 'percentual' | 'fixo'
  taxaAdminValor: number
  primeiraParcelaCheiaAtual: boolean
  duracaoMeses: number
  parcelas: Array<{ numero: number; status_pagamento: string; mes_referencia: string }>
}

export function RegerarParcelasBotao(props: Props) {
  const [aberto, setAberto] = useState(false)
  const naoPagas = props.parcelas.filter(p => p.status_pagamento !== 'pago').length

  if (naoPagas === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 border border-amber-200 hover:border-amber-400 hover:bg-amber-50 px-3 py-1.5 rounded-xl transition-colors"
        title="Recalcular parcelas com novo dia de vencimento ou valor"
      >
        <RefreshCw size={12} /> Regerar parcelas
      </button>
      {aberto && <ModalRegerar {...props} onFechar={() => setAberto(false)} />}
    </>
  )
}

function ModalRegerar({
  contratoId, contratoCodigo,
  diaVencimentoAtual, dataPrimeiroAluguelAtual,
  valorAluguelAtual, valorSeguroAtual, iptuAtual, condominioAtual,
  taxaAdminTipo, taxaAdminValor, primeiraParcelaCheiaAtual,
  parcelas,
  onFechar,
}: Props & { onFechar: () => void }) {
  const router = useRouter()

  const pagas = parcelas.filter(p => p.status_pagamento === 'pago')
  const naoPagas = parcelas.filter(p => p.status_pagamento !== 'pago')
  const primeiraNaoPaga = naoPagas[0]

  const [diaVenc, setDiaVenc] = useState(diaVencimentoAtual)
  const [dataInicio, setDataInicio] = useState(dataPrimeiroAluguelAtual.slice(0, 10))
  const [valorAluguel, setValorAluguel] = useState(
    valorAluguelAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
  const [valorSeguro, setValorSeguro] = useState(
    valorSeguroAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
  const [iptu, setIptu] = useState(
    iptuAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
  const [condo, setCondo] = useState(
    condominioAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
  const [taxaTipo, setTaxaTipo] = useState<'percentual' | 'fixo'>(taxaAdminTipo)
  const [taxaValor, setTaxaValor] = useState(
    taxaAdminValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
  const [primeiraCheia, setPrimeiraCheia] = useState(primeiraParcelaCheiaAtual)
  const [aPartirDe, setAPartirDe] = useState<number>(primeiraNaoPaga?.numero ?? 1)

  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [isPending, startTransition] = useTransition()

  const confirmar = () => {
    setErro('')
    setOk('')
    if (diaVenc < 1 || diaVenc > 31) { setErro('Dia de vencimento inválido (1-31).'); return }
    const vAluguel = parseMoney(valorAluguel)
    if (!vAluguel) { setErro('Valor de aluguel inválido.'); return }
    const vTaxa = taxaTipo === 'percentual' ? parsePercentual(taxaValor) : parseMoney(taxaValor)

    const payload: RegerarParcelasInput = {
      contrato_id: contratoId,
      dia_vencimento: diaVenc,
      data_primeiro_aluguel: dataInicio,
      valor_aluguel: vAluguel,
      valor_seguro_fianca_mensal: parseMoney(valorSeguro) || 0,
      iptu_mensal: parseMoney(iptu) || 0,
      condominio_mensal: parseMoney(condo) || 0,
      taxa_admin_tipo: taxaTipo,
      taxa_admin_valor: vTaxa,
      primeira_parcela_cheia: primeiraCheia,
      a_partir_da_parcela: aPartirDe,
    }
    startTransition(async () => {
      const r = await regerarParcelas(payload)
      if (r.error) { setErro(r.error); return }
      setOk(`✓ ${r.parcelas_regeneradas} parcela${r.parcelas_regeneradas === 1 ? '' : 's'} recalculada${r.parcelas_regeneradas === 1 ? '' : 's'} a partir da #${r.a_partir_de}.`)
      setTimeout(() => { onFechar(); router.refresh() }, 1500)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl shadow-xl p-5 max-w-xl w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <RefreshCw size={16} className="text-amber-600" /> Regerar parcelas
            </h3>
            <p className="text-xs text-gray-500 font-mono">{contratoCodigo}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="bg-amber-50 border border-amber-100 text-amber-900 text-xs rounded-lg px-3 py-2 mb-4 flex gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p>Use isso pra corrigir dia de vencimento, valor de aluguel ou outros parâmetros que ficaram errados.</p>
            <p className="mt-1">
              <strong>{pagas.length}</strong> parcela{pagas.length === 1 ? '' : 's'} já paga{pagas.length === 1 ? '' : 's'} {pagas.length === 1 ? 'será mantida' : 'serão mantidas'}.
              As parcelas em aberto a partir da escolhida abaixo serão <strong>deletadas e recalculadas</strong>.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Regerar a partir da parcela *</label>
            <select value={aPartirDe} onChange={e => setAPartirDe(parseInt(e.target.value))} className={inputCls}>
              {naoPagas.map(p => (
                <option key={p.numero} value={p.numero}>
                  #{p.numero} (ref. {p.mes_referencia.slice(0, 7)})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Default: primeira não paga. Parcelas anteriores ficam como estão.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Dia de vencimento *</label>
              <input type="number" min={1} max={31} value={diaVenc}
                onChange={e => setDiaVenc(parseInt(e.target.value) || 0)} className={inputCls} />
              <p className="text-[11px] text-gray-400 mt-0.5">
                era dia {diaVencimentoAtual} → ficará dia {diaVenc || '?'}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Data 1º aluguel</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputCls} />
              <p className="text-[11px] text-gray-400 mt-0.5">não altera parcelas pagas</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Aluguel *</label>
              <InputMoeda value={valorAluguel} onChange={setValorAluguel} className={inputCls} />
              <p className="text-[11px] text-gray-400 mt-0.5">atual: {formatarBRL(valorAluguelAtual)}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Seguro fiança mensal</label>
              <InputMoeda value={valorSeguro} onChange={setValorSeguro} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">IPTU mensal</label>
              <InputMoeda value={iptu} onChange={setIptu} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Condomínio</label>
              <InputMoeda value={condo} onChange={setCondo} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Taxa de administração</label>
              <div className="flex gap-1">
                <button type="button" onClick={() => setTaxaTipo('percentual')}
                  className={`flex-1 text-xs py-2 rounded-lg ${taxaTipo === 'percentual' ? 'bg-violet-700 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  %
                </button>
                <button type="button" onClick={() => setTaxaTipo('fixo')}
                  className={`flex-1 text-xs py-2 rounded-lg ${taxaTipo === 'fixo' ? 'bg-violet-700 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  R$ fixo
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Valor da taxa</label>
              {taxaTipo === 'percentual'
                ? <InputPercentual value={taxaValor} onChange={setTaxaValor} className={inputCls} />
                : <InputMoeda value={taxaValor} onChange={setTaxaValor} className={inputCls} />}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-gray-100">
            <input type="checkbox" checked={primeiraCheia}
              onChange={e => setPrimeiraCheia(e.target.checked)}
              className="w-4 h-4 accent-violet-600" />
            <span className="text-xs text-gray-700">1ª parcela cheia (100% pra imobiliária)</span>
          </label>

          {erro && <p className="text-xs text-red-600">{erro}</p>}
          {ok && <p className="text-xs text-green-700 font-medium flex items-center gap-1"><Check size={12} />{ok}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-gray-100">
          <button onClick={onFechar} disabled={isPending}
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={isPending}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Regerar
          </button>
        </div>
      </div>
    </div>
  )
}
