'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PenLine, Plus, Trash2, Loader2, Send, Copy, Check, Clock, CheckCircle2, X, Download, MessageCircle } from 'lucide-react'
import { criarProcessoAssinatura, cancelarProcessoAssinatura } from '../assinatura-actions'

interface Sugestao { nome: string; email: string; papel: string }
interface SignatarioStatus { nome: string; email: string; papel: string | null; status: string; token: string }
interface Processo { id: string; status: string; created_at: string; signatarios: SignatarioStatus[] }

interface Props {
  tipoContrato: 'locacao' | 'administracao'
  contratoId: string
  titulo: string
  baseUrl: string
  sugestoes: Sugestao[]
  processos: Processo[]
}

interface Linha { nome: string; email: string; papel: string }

export function PainelAssinatura({ tipoContrato, contratoId, titulo, baseUrl, sugestoes, processos }: Props) {
  const router = useRouter()
  const [linhas, setLinhas] = useState<Linha[]>(
    sugestoes.length > 0 ? sugestoes.map(s => ({ ...s })) : [{ nome: '', email: '', papel: '' }],
  )
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [origin] = useState(() => (typeof window !== 'undefined' ? window.location.origin : baseUrl))

  const set = (i: number, campo: keyof Linha, v: string) =>
    setLinhas(prev => prev.map((l, idx) => idx === i ? { ...l, [campo]: v } : l))
  const add = () => setLinhas(prev => [...prev, { nome: '', email: '', papel: '' }])
  const rem = (i: number) => setLinhas(prev => prev.filter((_, idx) => idx !== i))

  const enviar = () => {
    setErro('')
    const signatarios = linhas.filter(l => l.nome.trim() && /\S+@\S+\.\S+/.test(l.email))
    if (signatarios.length === 0) { setErro('Adicione ao menos 1 signatário com nome e e-mail válido.'); return }
    startTransition(async () => {
      const r = await criarProcessoAssinatura({ tipo_contrato: tipoContrato, contrato_id: contratoId, titulo, signatarios })
      if (r.error) { setErro(r.error); return }
      setLinhas([{ nome: '', email: '', papel: '' }])
      router.refresh()
    })
  }

  const copiar = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${origin}/assinar/${token}`)
      setCopiado(token); setTimeout(() => setCopiado(null), 2000)
    } catch { setErro('Não consegui copiar.') }
  }

  const whatsapp = (s: SignatarioStatus) => {
    const msg = `Olá ${s.nome.split(' ')[0]}, segue o link para você assinar o contrato ${titulo}${s.papel ? ` (como ${s.papel})` : ''}:\n\n${origin}/assinar/${s.token}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  }

  const cancelar = (id: string) => {
    if (!confirm('Cancelar este processo de assinatura? Os links param de funcionar.')) return
    startTransition(async () => {
      const r = await cancelarProcessoAssinatura(id)
      if (r.error) { setErro(r.error); return }
      router.refresh()
    })
  }

  const ativos = processos.filter(p => p.status !== 'cancelado')

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <PenLine size={15} className="text-violet-600" /> Assinar pela plataforma
        </h2>
        <p className="text-xs text-gray-500">Cada signatário recebe um link, confirma código por e-mail, tira selfie e assina.</p>
      </div>

      {/* Novos signatários */}
      <div className="space-y-2 mb-3">
        {linhas.map((l, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2">
            <input value={l.nome} onChange={e => set(i, 'nome', e.target.value)} placeholder="Nome" className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <input value={l.email} onChange={e => set(i, 'email', e.target.value)} placeholder="E-mail" className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <input value={l.papel} onChange={e => set(i, 'papel', e.target.value)} placeholder="Papel (ex.: Locatário)" className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm w-full sm:w-40 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <button type="button" onClick={() => rem(i)} className="text-gray-300 hover:text-rose-600 p-1.5 justify-self-end"><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={add} className="flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-800"><Plus size={12} /> Adicionar signatário</button>
      </div>

      {/* Chips das partes do contrato (inclui testemunhas selecionadas) */}
      {sugestoes.filter(s => !linhas.some(l => l.email.toLowerCase() === s.email.toLowerCase())).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="text-[11px] text-gray-400">Adicionar das partes:</span>
          {sugestoes
            .filter(s => !linhas.some(l => l.email.toLowerCase() === s.email.toLowerCase()))
            .map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setLinhas(prev => [...prev.filter(l => l.nome.trim() || l.email.trim()), { nome: s.nome, email: s.email, papel: s.papel }])}
                className="text-[11px] bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full"
              >
                + {s.nome} <span className="text-violet-400">({s.papel})</span>
              </button>
            ))}
        </div>
      )}

      {erro && <p className="text-xs text-red-600 mb-2">{erro}</p>}

      <button type="button" onClick={enviar} disabled={isPending} className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl">
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar para assinatura
      </button>

      {/* Processos existentes */}
      {ativos.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100 space-y-3">
          {ativos.map(p => (
            <div key={p.id} className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.status === 'concluido' ? 'bg-green-100 text-green-700' : 'bg-violet-100 text-violet-700'}`}>
                  {p.status === 'concluido' ? 'Concluído' : 'Em assinatura'}
                </span>
                <span className="text-[10px] text-gray-400 flex-1">{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
                {p.status === 'concluido' ? (
                  <a href={`/api/assinaturas/${p.id}/pdf-final`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-semibold text-green-700 hover:text-green-800">
                    <Download size={12} /> Baixar assinado
                  </a>
                ) : (
                  <button type="button" onClick={() => cancelar(p.id)} className="text-red-400 hover:text-red-600 p-1" title="Cancelar"><X size={13} /></button>
                )}
              </div>
              <ul className="space-y-1.5">
                {p.signatarios.map(s => (
                  <li key={s.token} className="flex items-center gap-2 text-xs">
                    {s.status === 'assinado'
                      ? <CheckCircle2 size={13} className="text-green-600 shrink-0" />
                      : <Clock size={13} className="text-amber-500 shrink-0" />}
                    <span className="font-medium text-gray-800">{s.nome}</span>
                    <span className="text-gray-400">{s.papel ? `· ${s.papel}` : ''}</span>
                    <span className="text-gray-300 flex-1 truncate">{s.email}</span>
                    {s.status !== 'assinado' && p.status !== 'concluido' && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        <button type="button" onClick={() => copiar(s.token)} className="text-violet-600 hover:text-violet-800 p-1" title="Copiar link">
                          {copiado === s.token ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                        <button type="button" onClick={() => whatsapp(s)} className="text-green-600 hover:text-green-700 p-1" title="Enviar por WhatsApp">
                          <MessageCircle size={12} />
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
