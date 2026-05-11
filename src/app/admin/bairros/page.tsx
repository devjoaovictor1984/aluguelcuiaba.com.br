'use client'

import { useState, useEffect, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react'

interface Bairro {
  id: string
  nome: string
  slug: string
  regiao: string | null
}

function gerarSlug(nome: string) {
  return nome.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-')
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900 placeholder:text-gray-400 transition"

export default function AdminBairrosPage() {
  const [bairros, setBairros] = useState<Bairro[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editRegiao, setEditRegiao] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novoSlug, setNovoSlug] = useState('')
  const [novoRegiao, setNovoRegiao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const supabase = createClient()

  const carregar = async () => {
    const { data } = await supabase.from('bairros').select('*').order('nome')
    setBairros(data ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const handleNovo = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!novoNome.trim()) return
    setSalvando(true)
    const { error } = await supabase.from('bairros').insert({
      nome: novoNome.trim(),
      slug: novoSlug.trim() || gerarSlug(novoNome),
      regiao: novoRegiao.trim() || null,
    })
    if (error) { setErro(error.message); setSalvando(false); return }
    setNovoNome(''); setNovoSlug(''); setNovoRegiao('')
    setSalvando(false)
    await carregar()
  }

  const handleSalvarEdit = async (id: string) => {
    const { error } = await supabase.from('bairros').update({
      nome: editNome.trim(),
      slug: editSlug.trim(),
      regiao: editRegiao.trim() || null,
    }).eq('id', id)
    if (!error) { setEditId(null); await carregar() }
  }

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir este bairro? Imóveis vinculados perderão o bairro.')) return
    await supabase.from('bairros').delete().eq('id', id)
    await carregar()
  }

  const startEdit = (b: Bairro) => {
    setEditId(b.id); setEditNome(b.nome); setEditSlug(b.slug); setEditRegiao(b.regiao ?? '')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bairros</h1>

      {/* Form novo */}
      <form onSubmit={handleNovo} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Novo bairro</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Nome *</label>
            <input value={novoNome} onChange={e => { setNovoNome(e.target.value); setNovoSlug(gerarSlug(e.target.value)) }}
              placeholder="Ex: Centro" required className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Slug *</label>
            <input value={novoSlug} onChange={e => setNovoSlug(e.target.value)}
              placeholder="centro" required className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Região</label>
            <input value={novoRegiao} onChange={e => setNovoRegiao(e.target.value)}
              placeholder="Ex: Norte, Sul..." className={inputCls} />
          </div>
        </div>
        {erro && <p className="text-sm text-red-600 mt-2">{erro}</p>}
        <button type="submit" disabled={salvando}
          className="mt-3 flex items-center gap-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50">
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Adicionar bairro
        </button>
      </form>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-violet-500" />
          </div>
        ) : bairros.length === 0 ? (
          <p className="text-center text-gray-400 py-12">Nenhum bairro cadastrado.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {bairros.map(b => (
              <div key={b.id} className="px-5 py-3">
                {editId === b.id ? (
                  <div className="grid sm:grid-cols-3 gap-2 items-end">
                    <input value={editNome} onChange={e => setEditNome(e.target.value)} className={inputCls} />
                    <input value={editSlug} onChange={e => setEditSlug(e.target.value)} className={inputCls} />
                    <div className="flex gap-2">
                      <input value={editRegiao} onChange={e => setEditRegiao(e.target.value)} placeholder="Região" className={`${inputCls} flex-1`} />
                      <button onClick={() => handleSalvarEdit(b.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><Check size={16} /></button>
                      <button onClick={() => setEditId(null)} className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg"><X size={16} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 grid sm:grid-cols-3 gap-2">
                      <p className="font-medium text-gray-900 text-sm">{b.nome}</p>
                      <p className="text-sm text-gray-400 font-mono">{b.slug}</p>
                      <p className="text-sm text-gray-400">{b.regiao ?? '—'}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(b)} className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleExcluir(b.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
