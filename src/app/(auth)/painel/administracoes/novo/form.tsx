'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Save } from 'lucide-react'
import { criarContratoAdmin } from '../actions'

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-gray-900 text-sm transition"

interface Props {
  pessoas: Array<{ id: string; nome: string; cpf_cnpj: string | null; tipo: string }>
  imoveis: Array<{ id: string; titulo: string; endereco_resumido: string | null }>
}

export function FormNovoAdm({ pessoas, imoveis }: Props) {
  const router = useRouter()
  const [proprietarioId, setProprietarioId] = useState('')
  const [imovelId, setImovelId] = useState('')
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10))
  const [prazoMeses, setPrazoMeses] = useState<string>('12')
  const [renovacaoAuto, setRenovacaoAuto] = useState(true)
  const [taxaTipo, setTaxaTipo] = useState<'percentual' | 'fixo'>('percentual')
  const [taxaValor, setTaxaValor] = useState('10')
  const [primeiraCheia, setPrimeiraCheia] = useState(false)
  const [diaRepasse, setDiaRepasse] = useState('5')
  const [exclusividade, setExclusividade] = useState(true)
  const [multaMeses, setMultaMeses] = useState('3')
  const [avisoPrevio, setAvisoPrevio] = useState('30')
  const [observacoes, setObservacoes] = useState('')

  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const proprietarios = pessoas.filter(p => p.tipo === 'proprietario' || p.tipo === 'outro')

  const onSalvar = () => {
    setErro('')
    if (!proprietarioId) { setErro('Selecione o proprietário.'); return }
    const taxa = parseFloat(taxaValor.replace(',', '.'))
    if (!taxa || taxa <= 0) { setErro('Informe a taxa de administração.'); return }
    const prazoNum = parseInt(prazoMeses, 10)
    const dataTermino = prazoNum > 0
      ? new Date(new Date(dataInicio + 'T00:00:00').setMonth(new Date(dataInicio + 'T00:00:00').getMonth() + prazoNum) - 24 * 3600 * 1000).toISOString().slice(0, 10)
      : null

    startTransition(async () => {
      const r = await criarContratoAdmin({
        proprietario_id: proprietarioId,
        imovel_id: imovelId || null,
        data_inicio: dataInicio,
        data_termino: dataTermino,
        prazo_meses: prazoNum > 0 ? prazoNum : null,
        renovacao_automatica: renovacaoAuto,
        taxa_tipo: taxaTipo,
        taxa_valor: taxa,
        primeira_parcela_cheia: primeiraCheia,
        dia_repasse: parseInt(diaRepasse, 10) || null,
        exclusividade,
        multa_rescisao_meses: parseInt(multaMeses, 10) || null,
        aviso_previo_dias: parseInt(avisoPrevio, 10) || 30,
        observacoes: observacoes.trim() || null,
      })
      if (r.error || !r.id) { setErro(r.error ?? 'Falha ao criar.'); return }
      router.push(`/painel/administracoes/${r.id}`)
    })
  }

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Partes</h2>
        <label className="block">
          <span className="text-xs font-medium text-gray-600 block mb-1">Proprietário</span>
          <select value={proprietarioId} onChange={e => setProprietarioId(e.target.value)} required className={inputCls}>
            <option value="">— selecione —</option>
            {proprietarios.map(p => (
              <option key={p.id} value={p.id}>{p.nome}{p.cpf_cnpj ? ` · ${p.cpf_cnpj}` : ''}</option>
            ))}
          </select>
          {proprietarios.length === 0 && (
            <p className="text-[11px] text-amber-700 mt-1">Cadastre uma pessoa do tipo &ldquo;proprietário&rdquo; antes.</p>
          )}
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600 block mb-1">Imóvel (opcional — pode definir depois)</span>
          <select value={imovelId} onChange={e => setImovelId(e.target.value)} className={inputCls}>
            <option value="">— sem imóvel definido —</option>
            {imoveis.map(im => (
              <option key={im.id} value={im.id}>{im.titulo}{im.endereco_resumido ? ` · ${im.endereco_resumido}` : ''}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Prazo</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600 block mb-1">Início</span>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} required className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 block mb-1">Prazo (meses)</span>
            <input type="number" min={0} value={prazoMeses} onChange={e => setPrazoMeses(e.target.value)} placeholder="12" className={inputCls} />
            <span className="text-[10px] text-gray-400">0 = indeterminado</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer sm:mt-6">
            <input type="checkbox" checked={renovacaoAuto} onChange={e => setRenovacaoAuto(e.target.checked)} className="accent-violet-600" />
            <span className="text-sm text-gray-700">Renovação automática</span>
          </label>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Taxa e repasse</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600 block mb-1">Tipo</span>
            <select value={taxaTipo} onChange={e => setTaxaTipo(e.target.value as 'percentual' | 'fixo')} className={inputCls}>
              <option value="percentual">Percentual (%)</option>
              <option value="fixo">Valor fixo (R$)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 block mb-1">
              Taxa {taxaTipo === 'percentual' ? '(%)' : '(R$)'}
            </span>
            <input type="text" inputMode="decimal" value={taxaValor} onChange={e => setTaxaValor(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 block mb-1">Dia do repasse</span>
            <input type="number" min={1} max={31} value={diaRepasse} onChange={e => setDiaRepasse(e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={primeiraCheia} onChange={e => setPrimeiraCheia(e.target.checked)} className="accent-violet-600" />
          <span className="text-sm text-gray-700">Primeira parcela 100% pra administradora (comissão de intermediação)</span>
        </label>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Condições</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={exclusividade} onChange={e => setExclusividade(e.target.checked)} className="accent-violet-600" />
            <span className="text-sm text-gray-700">Em regime de exclusividade</span>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 block mb-1">Aviso prévio (dias)</span>
            <input type="number" min={0} value={avisoPrevio} onChange={e => setAvisoPrevio(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 block mb-1">Multa rescisória (meses de taxa)</span>
            <input type="number" min={0} value={multaMeses} onChange={e => setMultaMeses(e.target.value)} className={inputCls} />
          </label>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Observações</h2>
        <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} className={inputCls} />
      </section>

      {erro && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {erro}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 pt-3 pb-4">
        <div className="max-w-3xl mx-auto">
          <button
            type="button"
            onClick={onSalvar}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-60 text-white font-bold py-4 rounded-2xl"
          >
            {isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Criar contrato de administração
          </button>
        </div>
      </div>
    </div>
  )
}
