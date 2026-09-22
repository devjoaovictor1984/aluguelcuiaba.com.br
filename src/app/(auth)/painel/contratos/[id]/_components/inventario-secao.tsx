'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Plus, Trash2, Loader2, X, Camera, ImageOff } from 'lucide-react'
import {
  adicionarItemInventario, removerItemInventario,
  definirFotoItem, removerFotoItem,
} from '../actions-inventario'
import { comprimirImagem } from '@/lib/imagens/comprimir'

export interface ItemInventario {
  id: string
  descricao: string
  quantidade: number
  marca_modelo: string | null
  estado: string | null
  observacao: string | null
  /** Signed URL da foto, gerada no servidor. null = item sem foto. */
  foto_url: string | null
}

/**
 * A foto do inventário IDENTIFICA o bem — é ela que resolve "qual
 * geladeira era a sua" na devolução. Por isso 900px bastam: a imagem
 * sai como miniatura no anexo do contrato, e o contrato inteiro ainda
 * precisa passar pelo fluxo de assinatura sem virar um arquivo enorme.
 * Documentar avaria continua sendo trabalho da vistoria.
 */
const PERFIL_FOTO_INVENTARIO = { maxLado: 900, alvoBytes: 250 * 1024 }

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
  const [erroFoto, setErroFoto] = useState('')
  const [subindoFoto, setSubindoFoto] = useState<string | null>(null)
  const [ampliada, setAmpliada] = useState<{ url: string; descricao: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Um input de arquivo só, reaproveitado: qual item está fotografando
  // fica no ref, senão seriam 20 inputs escondidos numa tabela de 20 itens.
  const inputFotoRef = useRef<HTMLInputElement>(null)
  const itemDaFoto = useRef<string | null>(null)

  const escolherFoto = (itemId: string) => {
    setErroFoto('')
    itemDaFoto.current = itemId
    inputFotoRef.current?.click()
  }

  const enviarFoto = async (arquivo: File | null) => {
    const itemId = itemDaFoto.current
    if (inputFotoRef.current) inputFotoRef.current.value = ''
    if (!arquivo || !itemId) return

    setErroFoto('')
    setSubindoFoto(itemId)
    try {
      const fd = new FormData()
      fd.set('item_id', itemId)
      fd.set('file', await comprimirImagem(arquivo, PERFIL_FOTO_INVENTARIO))
      const r = await definirFotoItem(fd)
      if (r.error) { setErroFoto(r.error); return }
      router.refresh()
    } catch {
      setErroFoto('Não deu pra processar essa imagem. Tente outra foto.')
    } finally {
      setSubindoFoto(null)
    }
  }

  const apagarFoto = (itemId: string) => {
    setErroFoto('')
    setSubindoFoto(itemId)
    startTransition(async () => {
      const r = await removerFotoItem(itemId)
      setSubindoFoto(null)
      if (r.error) { setErroFoto(r.error); return }
      router.refresh()
    })
  }

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

      <input
        ref={inputFotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { void enviarFoto(e.target.files?.[0] ?? null) }}
      />

      {erroFoto && <p className="text-xs text-rose-600 mb-2">{erroFoto}</p>}

      {itens.length === 0 ? (
        <p className="text-xs text-gray-400">
          Nenhum bem cadastrado. Use pra imóvel mobiliado — cada item entra numa tabela no PDF, conferível na devolução.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-400 border-b border-gray-100">
              <tr>
                <th className="w-20 py-1.5 px-2 font-semibold text-left">Foto</th>
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
                  <td className="py-1.5 px-2">
                    {subindoFoto === it.id ? (
                      <span className="flex items-center justify-center w-16 h-16 rounded-lg bg-gray-50">
                        <Loader2 size={14} className="animate-spin text-gray-400" />
                      </span>
                    ) : it.foto_url ? (
                      <button
                        type="button"
                        onClick={() => setAmpliada({ url: it.foto_url!, descricao: it.descricao })}
                        className="block w-16 h-16 rounded-lg overflow-hidden ring-1 ring-gray-200 hover:ring-violet-400"
                        title="Ver a foto"
                      >
                        {/* next/image não entra aqui: a URL é assinada e expira. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={it.foto_url} alt={it.descricao} className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => escolherFoto(it.id)}
                        disabled={isPending}
                        className="flex items-center justify-center w-16 h-16 rounded-lg border border-dashed border-gray-200 text-gray-300 hover:text-violet-600 hover:border-violet-300 disabled:opacity-50"
                        title="Fotografar este item"
                      >
                        <Camera size={18} />
                      </button>
                    )}
                  </td>
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
          <p className="text-[10px] text-gray-400 mt-2">
            A foto identifica o bem e sai numa prancha ao fim do anexo do contrato, numerada igual
            à tabela. Avaria e estado de conservação são registrados na vistoria, que tem galeria por item.
          </p>
        </div>
      )}

      {ampliada && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAmpliada(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2 gap-2">
              <h2 className="text-sm font-bold text-gray-900 truncate">{ampliada.descricao}</h2>
              <button type="button" onClick={() => setAmpliada(null)} className="p-1 text-gray-400 hover:text-gray-700 shrink-0">
                <X size={16} />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ampliada.url} alt={ampliada.descricao} className="w-full rounded-xl max-h-[70vh] object-contain bg-gray-50" />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  const alvo = itens.find(i => i.foto_url === ampliada.url)
                  setAmpliada(null)
                  if (alvo) escolherFoto(alvo.id)
                }}
                className="flex items-center gap-1.5 text-xs text-violet-700 hover:bg-violet-50 px-3 py-2 rounded-lg"
              >
                <Camera size={13} /> Trocar foto
              </button>
              <button
                type="button"
                onClick={() => {
                  const alvo = itens.find(i => i.foto_url === ampliada.url)
                  setAmpliada(null)
                  if (alvo) apagarFoto(alvo.id)
                }}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg"
              >
                <ImageOff size={13} /> Remover foto
              </button>
            </div>
          </div>
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
