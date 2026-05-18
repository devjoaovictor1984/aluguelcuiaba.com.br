'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, AlertCircle, Trash2 } from 'lucide-react'
import { atualizarContrato, excluirContrato, type ContratoEditavel } from '../../../actions'

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"

interface Props {
  id: string
  dados: {
    status: string
    data_termino: string | null
    observacoes: string | null
    clausulas_extras: string | null
    indice_reajuste: string | null
    data_proximo_reajuste: string | null
    vistoria_ok: boolean | null
    termo_chaves_ok: boolean | null
    forma_pagamento: string | null
    inquilino_mora_no_imovel: boolean | null
  }
}

export function FormEditarContrato({ id, dados }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(dados.status)
  const [dataTermino, setDataTermino] = useState(dados.data_termino?.slice(0, 10) ?? '')
  const [observacoes, setObservacoes] = useState(dados.observacoes ?? '')
  const [clausulas, setClausulas] = useState(dados.clausulas_extras ?? '')
  const [indice, setIndice] = useState(dados.indice_reajuste ?? '')
  const [dataReajuste, setDataReajuste] = useState(dados.data_proximo_reajuste?.slice(0, 10) ?? '')
  const [vistoria, setVistoria] = useState(!!dados.vistoria_ok)
  const [chaves, setChaves] = useState(!!dados.termo_chaves_ok)
  const [formaPag, setFormaPag] = useState(dados.forma_pagamento ?? 'boleto')
  const [inquilinoMora, setInquilinoMora] = useState(dados.inquilino_mora_no_imovel ?? true)

  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const salvar = () => {
    setErro('')
    const payload: ContratoEditavel = {
      status: status as ContratoEditavel['status'],
      data_termino: dataTermino || null,
      observacoes: observacoes || null,
      clausulas_extras: clausulas || null,
      indice_reajuste: indice || null,
      data_proximo_reajuste: dataReajuste || null,
      vistoria_ok: vistoria,
      termo_chaves_ok: chaves,
      forma_pagamento: formaPag as ContratoEditavel['forma_pagamento'],
      inquilino_mora_no_imovel: inquilinoMora,
    }
    startTransition(async () => {
      const r = await atualizarContrato(id, payload)
      if (r.error) { setErro(r.error); return }
      router.push(`/painel/contratos/${id}`)
      router.refresh()
    })
  }

  const excluir = () => {
    if (!confirm('Excluir este contrato? Todas as parcelas serão removidas. NÃO pode ser desfeito.')) return
    startTransition(async () => {
      const r = await excluirContrato(id)
      if (r?.error) { setErro(r.error); return }
      router.push('/painel/contratos')
      router.refresh()
    })
  }

  return (
    <div className="space-y-5 pb-10">
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Status</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Status do contrato</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
              <option value="ativo">Ativo</option>
              <option value="inadimplente">Inadimplente</option>
              <option value="encerrado">Encerrado (no prazo)</option>
              <option value="rescindido">Rescindido</option>
              <option value="rascunho">Rascunho</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Data de término</label>
            <input type="date" value={dataTermino} onChange={e => setDataTermino(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Forma de pagamento</label>
            <select value={formaPag} onChange={e => setFormaPag(e.target.value)} className={inputCls}>
              <option value="boleto">Boleto</option>
              <option value="pix">PIX</option>
              <option value="transferencia">Transferência</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
        </div>

        <div className="flex gap-4 pt-2 border-t border-gray-50 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={vistoria} onChange={e => setVistoria(e.target.checked)} className="w-4 h-4 accent-violet-600" />
            <span className="text-sm text-gray-700">Vistoria realizada</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={chaves} onChange={e => setChaves(e.target.checked)} className="w-4 h-4 accent-violet-600" />
            <span className="text-sm text-gray-700">Termo de entrega de chaves</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={inquilinoMora} onChange={e => setInquilinoMora(e.target.checked)} className="w-4 h-4 accent-violet-600" />
            <span className="text-sm text-gray-700">Inquilino contratante mora no imóvel</span>
          </label>
        </div>
        {!inquilinoMora && (
          <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            ℹ️ Quem assina é o inquilino contratante (responsável pelo pagamento). Cadastre quem realmente mora na seção <strong>Pessoas vinculadas</strong> como &ldquo;Morador adicional&rdquo;.
          </p>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Reajuste</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Índice</label>
            <select value={indice} onChange={e => setIndice(e.target.value)} className={inputCls}>
              <option value="">—</option>
              <option value="IGPM">IGP-M</option>
              <option value="IPCA">IPCA</option>
              <option value="INPC">INPC</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Próximo reajuste</label>
            <input type="date" value={dataReajuste} onChange={e => setDataReajuste(e.target.value)} className={inputCls} />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Notas</h2>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Observações</label>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3}
            className={`${inputCls} resize-y`} placeholder="Notas internas sobre o contrato..." />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Cláusulas extras</label>
          <textarea value={clausulas} onChange={e => setClausulas(e.target.value)} rows={4}
            className={`${inputCls} resize-y`} placeholder="Cláusulas adicionais que não estão no template do contrato..." />
        </div>
      </section>

      {erro && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">
          <AlertCircle size={16} />
          {erro}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={excluir} disabled={isPending}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
          <Trash2 size={14} /> Excluir contrato
        </button>
        <button type="button" onClick={salvar} disabled={isPending}
          className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar alterações
        </button>
      </div>
    </div>
  )
}
