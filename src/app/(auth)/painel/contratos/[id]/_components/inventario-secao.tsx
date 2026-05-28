'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Plus, Trash2, Loader2, X } from 'lucide-react'
import { adicionarItemInventario, removerItemInventario } from '../actions-inventario'

export interface ItemInventario {
  id: string
  descricao: string
  quantidade: number
  marca_modelo: string | null
  estado: string | null
  observacao: string | null
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"
const ESTADOS = ['Novo', 'Bom', 'Regular', 'Ruim']

export function InventarioSecao({ contratoId, itens }: { contratoId: string; itens: ItemInventario[] }) {
  const router = useRouter()
  const [modalAberto, setModalAberto] = useState(false)
  const [descricao, setDescricao] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [marcaModelo, setMarcaModelo] = useState('')
  const [estado, setEstado] = useState('Bom')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const limpar = () => {
    setDescricao(''); setQuantidade('1'); setMarcaModelo(''); setEstado('Bom'); setObservacao(''); setErro('')
  }

  const adicionar = () => {
    setErro('')
    if (!descricao.trim()) { setErro('Descreva o item.'); return }
    startTransition(async () => {
      const r = await adicionarItemInventario({
        contrato_id: contratoId,
        descricao,
        quantidade: parseInt(quantidade) || 1,
        marca_modelo: marcaModelo,
        estado,
        observacao,
      })
      if (r.error) { setErro(r.error); return }
      limpar()
      setModalAberto(false)
      router.refresh()
    })
  }

  const remover = (id: string) => {
    setRemovendo(id)
    startTransition(async () => {
      const r = await removerItemInventario(id, contratoId)
      setRemovendo(null)
      if (r.error) { alert(r.error); return }
      router.refresh()
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Package size={14} className="text-violet-600" />
          Inventário de bens
          <span className="text-xs font-normal text-gray-400">({itens.length})</span>
        </h2>
        <button
          type="button"
          onClick={() => { limpar(); setModalAberto(true) }}
          className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-800 border border-violet-200 hover:bg-violet-50 px-2.5 py-1 rounded-lg transition-colors"
        >
          <Plus size={12} /> Adicionar item
        </button>
      </div>

      {itens.length === 0 ? (
        <p className="text-xs text-gray-400">
          Nenhum bem cadastrado. Use pra imóvel mobiliado — cada item entra numa tabela no PDF, conferível na devolução.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-400 border-b border-gray-100">
              <tr>
                <th className="text-left py-1.5 px-2 font-semibold">Item</th>
                <th className="text-center py-1.5 px-2 font-semibold w-12">Qtd</th>
                <th className="text-left py-1.5 px-2 font-semibold">Marca/modelo</th>
                <th className="text-left py-1.5 px-2 font-semibold w-20">Estado</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {itens.map(it => (
                <tr key={it.id} className="border-b border-gray-50">
                  <td className="py-1.5 px-2 text-gray-900 font-medium">
                    {it.descricao}
                    {it.observacao && <span className="block text-[10px] text-gray-400">{it.observacao}</span>}
                  </td>
                  <td className="py-1.5 px-2 text-center text-gray-700">{it.quantidade}</td>
                  <td className="py-1.5 px-2 text-gray-600">{it.marca_modelo ?? '—'}</td>
                  <td className="py-1.5 px-2 text-gray-600">{it.estado ?? '—'}</td>
                  <td className="py-1.5 px-1 text-right">
                    <button
                      type="button"
                      onClick={() => remover(it.id)}
                      disabled={isPending}
                      className="text-gray-300 hover:text-rose-600 p-1 disabled:opacity-50"
                      title="Remover item"
                    >
                      {removendo === it.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isPending && setModalAberto(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900">Novo item do inventário</h2>
              <button type="button" onClick={() => setModalAberto(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X size={16} />
              </button>
            </div>

            <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição *</label>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Geladeira, sofá 3 lugares, cooktop…" className={`${inputCls} mb-3`} autoFocus />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Quantidade</label>
                <input type="number" min={1} value={quantidade} onChange={e => setQuantidade(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
                <select value={estado} onChange={e => setEstado(e.target.value)} className={inputCls}>
                  {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <label className="block text-xs font-semibold text-gray-600 mb-1">Marca / modelo</label>
            <input value={marcaModelo} onChange={e => setMarcaModelo(e.target.value)} placeholder="Ex: Brastemp, branca" className={`${inputCls} mb-3`} />

            <label className="block text-xs font-semibold text-gray-600 mb-1">Observação</label>
            <input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex: pequeno risco na lateral" className={`${inputCls} mb-3`} />

            {erro && <p className="text-xs text-rose-600 mb-2">{erro}</p>}

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setModalAberto(false)} disabled={isPending} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancelar
              </button>
              <button type="button" onClick={adicionar} disabled={isPending || !descricao.trim()} className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
