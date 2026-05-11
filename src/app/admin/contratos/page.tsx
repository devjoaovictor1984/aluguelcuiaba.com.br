'use client'

import { useState, useEffect, FormEvent, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, FileDown, Trash2, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'

interface Contrato {
  id: string
  titulo: string
  descricao: string | null
  arquivo_url: string
  ativo: boolean
  created_at: string
}

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900 placeholder:text-gray-400 transition"

export default function AdminContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const carregar = async () => {
    const { data } = await supabase.from('contratos').select('*').order('ordem').order('created_at', { ascending: false })
    setContratos(data ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!arquivo) { setErro('Selecione um arquivo.'); return }
    if (!titulo.trim()) { setErro('Informe o título.'); return }

    setEnviando(true)
    const path = `${Date.now()}-${arquivo.name.replace(/\s+/g, '-')}`
    const contentType = arquivo.name.endsWith('.docx')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : arquivo.name.endsWith('.doc')
        ? 'application/msword'
        : 'application/pdf'
    const { error: uploadErr } = await supabase.storage.from('contratos').upload(path, arquivo, { contentType, upsert: false })
    if (uploadErr) { setErro(`Erro no upload: ${uploadErr.message}`); setEnviando(false); return }

    const { data: { publicUrl } } = supabase.storage.from('contratos').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('contratos').insert({
      titulo: titulo.trim(), descricao: descricao.trim() || null, arquivo_url: publicUrl,
    })
    if (dbErr) { setErro(dbErr.message); setEnviando(false); return }

    setTitulo(''); setDescricao(''); setArquivo(null)
    if (fileRef.current) fileRef.current.value = ''
    setEnviando(false)
    await carregar()
  }

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from('contratos').update({ ativo: !ativo }).eq('id', id)
    await carregar()
  }

  const excluir = async (id: string, url: string) => {
    if (!confirm('Excluir este contrato?')) return
    const path = url.split('/contratos/')[1]?.split('?')[0]
    if (path) await supabase.storage.from('contratos').remove([path])
    await supabase.from('contratos').delete().eq('id', id)
    await carregar()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Contratos de Locação</h1>

      {/* Upload form */}
      <form onSubmit={handleUpload} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Novo modelo</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Título *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Contrato Residencial" required className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Descrição</label>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Breve descrição..." className={inputCls} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Arquivo (PDF ou Word) *</label>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" required onChange={e => setArquivo(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer" />
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button type="submit" disabled={enviando}
          className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50">
          {enviando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          Fazer upload
        </button>
      </form>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-violet-500" /></div>
        ) : contratos.length === 0 ? (
          <p className="text-center text-gray-400 py-12">Nenhum contrato cadastrado.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {contratos.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <FileDown size={18} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{c.titulo}</p>
                  {c.descricao && <p className="text-xs text-gray-400">{c.descricao}</p>}
                  <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={c.arquivo_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-violet-600 hover:text-violet-800 font-medium border border-violet-200 hover:border-violet-400 px-2.5 py-1.5 rounded-lg transition-colors">
                    Baixar
                  </a>
                  <button onClick={() => toggleAtivo(c.id, c.ativo)}
                    className={`${c.ativo ? 'text-green-600' : 'text-gray-400'} hover:opacity-80 transition-opacity`}
                    title={c.ativo ? 'Ativo — clique para desativar' : 'Inativo — clique para ativar'}>
                    {c.ativo ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                  <button onClick={() => excluir(c.id, c.arquivo_url)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
