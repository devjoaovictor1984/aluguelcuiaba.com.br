'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Save } from 'lucide-react'
import { atualizarContratoAdmin } from '../../actions'

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-gray-900 text-sm transition"

interface Inicial {
  proprietario_id: string
  imovel_id: string | null
  data_inicio: string
  data_termino: string | null
  prazo_meses: number | null
  renovacao_automatica: boolean
  taxa_tipo: 'percentual' | 'fixo'
  taxa_valor: number
  primeira_parcela_cheia: boolean
  dia_repasse: number | null
  recebimento_comissao: 'mensal' | 'pagamento_unico'
  exclusividade: boolean
  multa_rescisao_meses: number | null
  aviso_previo_dias: number
  observacoes: string
}

interface Props {
  id: string
  inicial: Inicial
  pessoas: Array<{ id: string; nome: string; cpf_cnpj: string | null; tipo: string }>
  imoveis: Array<{ id: string; titulo: string; endereco_resumido: string | null }>
}

export function FormEditarAdm({ id, inicial, pessoas, imoveis }: Props) {
  const router = useRouter()
  const [proprietarioId, setProprietarioId] = useState(inicial.proprietario_id)
  const [imovelId, setImovelId] = useState(inicial.imovel_id ?? '')
  const [dataInicio, setDataInicio] = useState(inicial.data_inicio)
  const [dataTermino, setDataTermino] = useState(inicial.data_termino ?? '')
  const [prazoSel, setPrazoSel] = useState<string>(() => {
    const m = inicial.prazo_meses
    if (!m || m <= 0) return 'indeterminado'
    if (m % 12 === 0 && m / 12 <= 5) return String(m / 12)
    return 'outro'
  })
  const [prazoMesesCustom, setPrazoMesesCustom] = useState<string>(() => {
    const m = inicial.prazo_meses
    return (m && (m % 12 !== 0 || m / 12 > 5)) ? String(m) : ''
  })
  const [renovacaoAuto, setRenovacaoAuto] = useState(inicial.renovacao_automatica)
  const [taxaTipo, setTaxaTipo] = useState<'percentual' | 'fixo'>(inicial.taxa_tipo)
  const [taxaValor, setTaxaValor] = useState(String(inicial.taxa_valor))
  const [primeiraCheia, setPrimeiraCheia] = useState(inicial.primeira_parcela_cheia)
  const [diaRepasse, setDiaRepasse] = useState(String(inicial.dia_repasse ?? ''))
  const [recebimentoComissao, setRecebimentoComissao] = useState<'mensal' | 'pagamento_unico'>(inicial.recebimento_comissao)
  const [exclusividade, setExclusividade] = useState(inicial.exclusividade)
  const [multaMeses, setMultaMeses] = useState(String(inicial.multa_rescisao_meses ?? ''))
  const [avisoPrevio, setAvisoPrevio] = useState(String(inicial.aviso_previo_dias))
  const [observacoes, setObservacoes] = useState(inicial.observacoes)

  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const onSalvar = () => {
    setErro('')
    const taxa = parseFloat(taxaValor.replace(',', '.'))
    if (!taxa || taxa <= 0) { setErro('Informe a taxa.'); return }

    startTransition(async () => {
      const r = await atualizarContratoAdmin(id, {
        proprietario_id: proprietarioId,
        imovel_id: imovelId || null,
        data_inicio: dataInicio,
        data_termino: dataTermino || null,
        prazo_meses: prazoSel === 'indeterminado' ? null
          : prazoSel === 'outro' ? (parseInt(prazoMesesCustom, 10) || null)
          : parseInt(prazoSel, 10) * 12,
        renovacao_automatica: renovacaoAuto,
        taxa_tipo: taxaTipo,
        taxa_valor: taxa,
        primeira_parcela_cheia: primeiraCheia,
        dia_repasse: parseInt(diaRepasse, 10) || null,
        recebimento_comissao: recebimentoComissao,
        exclusividade,
        multa_rescisao_meses: parseInt(multaMeses, 10) || null,
        aviso_previo_dias: parseInt(avisoPrevio, 10) || 30,
        observacoes: observacoes.trim() || null,
      })
      if (r.error) { setErro(r.error); return }
      router.push(`/painel/administracoes/${id}`)
    })
  }

  const proprietarios = pessoas.filter(p => p.tipo === 'proprietario' || p.tipo === 'outro')

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
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600 block mb-1">Imóvel</span>
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
            <span className="text-xs font-medium text-gray-600 block mb-1">Término</span>
            <input type="date" value={dataTermino} onChange={e => setDataTermino(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 block mb-1">Prazo</span>
            <select value={prazoSel} onChange={e => setPrazoSel(e.target.value)} className={inputCls}>
              <option value="1">1 ano</option>
              <option value="2">2 anos</option>
              <option value="3">3 anos</option>
              <option value="4">4 anos</option>
              <option value="5">5 anos</option>
              <option value="indeterminado">Indeterminado</option>
              <option value="outro">Outro (meses)</option>
            </select>
            {prazoSel === 'outro' && (
              <input
                type="number" min={1} value={prazoMesesCustom}
                onChange={e => setPrazoMesesCustom(e.target.value)}
                placeholder="meses (ex: 30)"
                className={`${inputCls} mt-2`}
              />
            )}
          </label>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={renovacaoAuto} onChange={e => setRenovacaoAuto(e.target.checked)} className="accent-violet-600" />
          <span className="text-sm text-gray-700">Renovação automática</span>
        </label>
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
            <span className="text-xs font-medium text-gray-600 block mb-1">Taxa {taxaTipo === 'percentual' ? '(%)' : '(R$)'}</span>
            <input type="text" inputMode="decimal" value={taxaValor} onChange={e => setTaxaValor(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 block mb-1">Dia repasse</span>
            <input type="number" min={1} max={31} value={diaRepasse} onChange={e => setDiaRepasse(e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={primeiraCheia} onChange={e => setPrimeiraCheia(e.target.checked)} className="accent-violet-600" />
          <span className="text-sm text-gray-700">Primeira parcela 100% pra administradora</span>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600 block mb-1">Recebimento da comissão</span>
          <select value={recebimentoComissao} onChange={e => setRecebimentoComissao(e.target.value as 'mensal' | 'pagamento_unico')} className={inputCls}>
            <option value="mensal">Mensal (taxa descontada mês a mês)</option>
            <option value="pagamento_unico">Pagamento único (intermediação + taxa do período à vista)</option>
          </select>
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
            Salvar alterações
          </button>
        </div>
      </div>
    </div>
  )
}
