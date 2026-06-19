'use client'

import { useState, useTransition } from 'react'
import { Link as LinkIcon, Copy, Check, Loader2, MessageCircle, Trash2, Clock, MessageSquareText } from 'lucide-react'
import { gerarLinkRevisao, revogarLinkRevisao } from '../revisao-actions'

interface ConsideracaoLite {
  id: string
  autor_nome: string | null
  texto: string
  created_at: string
}
interface LinkLite {
  id: string
  token: string
  expira_em: string
  revogado_em: string | null
}

interface Props {
  tipoContrato: 'locacao' | 'administracao'
  contratoId: string
  titulo: string
  baseUrl: string
  linksIniciais: LinkLite[]
  consideracoes: ConsideracaoLite[]
}

export function PainelRevisao({ tipoContrato, contratoId, titulo, baseUrl, linksIniciais, consideracoes }: Props) {
  const [links, setLinks] = useState<LinkLite[]>(linksIniciais)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState<string | null>(null)
  const [agora] = useState(() => Date.now())

  const urlDe = (token: string) => `${baseUrl}/revisar-contrato/${token}`
  const ativos = links.filter(l => !l.revogado_em && new Date(l.expira_em).getTime() > agora)

  const gerar = () => {
    setErro('')
    startTransition(async () => {
      const r = await gerarLinkRevisao({ tipo_contrato: tipoContrato, contrato_id: contratoId, titulo, horas_validade: 168 })
      if (r.error || !r.token) { setErro(r.error ?? 'Falha ao gerar link.'); return }
      setLinks(prev => [{ id: r.token!, token: r.token!, expira_em: r.expira_em!, revogado_em: null }, ...prev])
    })
  }

  const copiar = async (token: string) => {
    try {
      await navigator.clipboard.writeText(urlDe(token))
      setCopiado(token)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      setErro('Não consegui copiar — copie manualmente.')
    }
  }

  const whatsapp = (token: string) => {
    const msg = `Olá! Segue o contrato para sua revisão. Se tiver alguma consideração, é só registrar no link (válido por 7 dias):\n\n${urlDe(token)}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  }

  const revogar = (id: string) => {
    if (!confirm('Cancelar este link? O cliente não conseguirá mais acessar.')) return
    startTransition(async () => {
      const r = await revogarLinkRevisao(id)
      if (r.error) { setErro(r.error); return }
      setLinks(prev => prev.map(l => l.id === id ? { ...l, revogado_em: new Date().toISOString() } : l))
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <MessageSquareText size={15} className="text-violet-600" /> Revisão pelo cliente
          </h2>
          <p className="text-xs text-gray-500">Gere um link pro cliente ler o contrato e enviar considerações (sem login).</p>
        </div>
        <button
          type="button"
          onClick={gerar}
          disabled={isPending}
          className="shrink-0 flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg"
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <LinkIcon size={13} />}
          Gerar link
        </button>
      </div>

      {erro && <p className="text-xs text-red-600 mb-2">{erro}</p>}

      {/* Links ativos */}
      {ativos.length > 0 && (
        <div className="space-y-2 mb-4">
          {ativos.map(l => (
            <div key={l.id} className="bg-violet-50 border border-violet-100 rounded-xl p-3">
              <p className="text-[11px] font-mono text-gray-700 break-all bg-white border border-violet-100 rounded-lg p-2 mb-2">{urlDe(l.token)}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => copiar(l.token)} className="flex items-center gap-1 text-xs bg-white border border-violet-200 text-violet-700 px-2.5 py-1.5 rounded-lg hover:bg-violet-50">
                  {copiado === l.token ? <Check size={11} /> : <Copy size={11} />}{copiado === l.token ? 'Copiado!' : 'Copiar'}
                </button>
                <button type="button" onClick={() => whatsapp(l.token)} className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded-lg">
                  <MessageCircle size={11} /> WhatsApp
                </button>
                <span className="text-[10px] text-violet-700 flex items-center gap-1 ml-auto">
                  <Clock size={10} /> expira {new Date(l.expira_em).toLocaleDateString('pt-BR')}
                </span>
                <button type="button" onClick={() => revogar(l.id)} disabled={isPending} className="text-red-500 hover:text-red-700 p-1" title="Cancelar link">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Considerações recebidas */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Considerações recebidas ({consideracoes.length})
        </h3>
        {consideracoes.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Nenhuma consideração ainda.</p>
        ) : (
          <ul className="space-y-2">
            {consideracoes.map(c => (
              <li key={c.id} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-800">{c.autor_nome || 'Cliente'}</span>
                  <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{c.texto}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
