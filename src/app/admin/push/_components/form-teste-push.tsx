'use client'

import { useState, useTransition } from 'react'
import { Bell, Loader2, Check, AlertCircle, Send } from 'lucide-react'
import { enviarPushTeste } from '../actions'

interface Props {
  totalSubs: number
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900'

const TEMPLATES = [
  {
    nome: '🔔 Sacudida',
    title: 'AluguelCuiabá 🏠',
    body: 'Olha o que tem de novo pra alugar em Cuiabá! Acesse aluguelcuiaba.com.br',
    url: '/',
  },
  {
    nome: '📰 Blog novo',
    title: 'Novo post no blog',
    body: 'A gente acabou de publicar conteúdo novo. Dá uma olhada!',
    url: '/blog',
  },
  {
    nome: '🎁 Promoção',
    title: 'Promoção AluguelCuiabá',
    body: 'Anuncie seu imóvel com desconto especial.',
    url: '/planos',
  },
]

export function FormTestePush({ totalSubs }: Props) {
  const [title, setTitle] = useState(TEMPLATES[0].title)
  const [body, setBody] = useState(TEMPLATES[0].body)
  const [url, setUrl] = useState(TEMPLATES[0].url)
  const [isPending, startTransition] = useTransition()
  const [resultado, setResultado] = useState<{ enviados?: number; falhas?: number; removidos?: number; erro?: string } | null>(null)

  const aplicarTemplate = (t: typeof TEMPLATES[number]) => {
    setTitle(t.title)
    setBody(t.body)
    setUrl(t.url)
  }

  const enviar = () => {
    if (!confirm(`Enviar push pra ${totalSubs} dispositivo${totalSubs === 1 ? '' : 's'} inscrito${totalSubs === 1 ? '' : 's'}?`)) return
    setResultado(null)
    startTransition(async () => {
      const r = await enviarPushTeste({ title, body, url })
      if ('error' in r) {
        setResultado({ erro: r.error })
      } else {
        setResultado({ enviados: r.enviados ?? 0, falhas: r.falhas ?? 0, removidos: r.removidos ?? 0 })
      }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Templates rápidos</p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map(t => (
            <button
              key={t.nome}
              type="button"
              onClick={() => aplicarTemplate(t)}
              className="text-[11px] bg-gray-50 hover:bg-violet-50 hover:text-violet-700 border border-gray-200 hover:border-violet-200 px-2.5 py-1 rounded-full transition-colors"
            >
              {t.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-gray-600 block mb-1">Título</span>
          <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} maxLength={60} />
          <p className="text-[11px] text-gray-400 mt-0.5">{title.length}/60 — recomendado ≤ 40 pra não cortar</p>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-600 block mb-1">Mensagem</span>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={3}
            className={inputCls}
            maxLength={200}
          />
          <p className="text-[11px] text-gray-400 mt-0.5">{body.length}/200</p>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-600 block mb-1">URL ao clicar</span>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="/ (home)"
            className={inputCls}
          />
          <p className="text-[11px] text-gray-400 mt-0.5">Caminho relativo (ex: /imoveis/centro/casa-3-quartos) ou apenas /.</p>
        </label>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <p className="text-xs text-gray-500">
          {totalSubs} dispositivo{totalSubs === 1 ? '' : 's'} receberá{totalSubs === 1 ? '' : 'ão'} o push
        </p>
        <button
          type="button"
          onClick={enviar}
          disabled={isPending}
          className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {isPending ? 'Enviando…' : 'Enviar push'}
        </button>
      </div>

      {resultado && (
        resultado.erro ? (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{resultado.erro}</span>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-1 text-sm">
            <p className="font-semibold text-green-800 flex items-center gap-1.5">
              <Check size={14} /> Push enviado!
            </p>
            <div className="grid grid-cols-3 gap-3 text-xs pt-1">
              <Stat label="Enviados" valor={resultado.enviados ?? 0} cor="text-green-700" />
              <Stat label="Falhas" valor={resultado.falhas ?? 0} cor={(resultado.falhas ?? 0) > 0 ? 'text-amber-700' : 'text-gray-500'} />
              <Stat label="Removidos" valor={resultado.removidos ?? 0} cor="text-gray-500" />
            </div>
            <p className="text-[11px] text-green-800 pt-1 border-t border-green-100">
              Notificação deve chegar em segundos. Se não receber: verifica se o navegador permitiu (cadeado na barra) e se a aba está em background ou app fechado.
            </p>
          </div>
        )
      )}
    </div>
  )
}

function Stat({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-lg p-2 text-center">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{label}</p>
      <p className={`text-lg font-extrabold ${cor}`}>{valor}</p>
    </div>
  )
}
