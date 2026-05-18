'use client'

import { useState, useTransition } from 'react'
import { salvarTemplate } from '../actions'
import {
  Check, Loader2, AlertCircle, ChevronDown, ChevronUp,
  Eye, RotateCcw, Copy,
} from 'lucide-react'

export interface VariavelDoc {
  nome: string
  descricao: string
}

interface Props {
  chave: string
  titulo: string
  descricao: string
  quandoEnviado: string
  variaveis: VariavelDoc[]
  exemplo: Record<string, string>
  assuntoInicial: string
  corpoInicial: string
  assuntoPadrao: string
  corpoPadrao: string
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

export function TemplateForm({
  chave, titulo, descricao, quandoEnviado, variaveis, exemplo,
  assuntoInicial, corpoInicial, assuntoPadrao, corpoPadrao,
}: Props) {
  const [assunto, setAssunto] = useState(assuntoInicial)
  const [corpo, setCorpo] = useState(corpoInicial)
  const [aberto, setAberto] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'erro'>('idle')
  const [isPending, startTransition] = useTransition()
  const [copiada, setCopiada] = useState<string | null>(null)

  const dirty = assunto !== assuntoInicial || corpo !== corpoInicial

  const handleSalvar = () => {
    startTransition(async () => {
      try {
        await salvarTemplate(chave, assunto, corpo)
        setStatus('ok')
        setTimeout(() => setStatus('idle'), 3000)
      } catch {
        setStatus('erro')
      }
    })
  }

  const restaurar = () => {
    if (!confirm('Voltar ao template padrão do sistema? Suas mudanças neste editor serão descartadas — clique em Salvar depois para gravar.')) return
    setAssunto(assuntoPadrao)
    setCorpo(corpoPadrao)
  }

  const preview = () => {
    const html = renderTemplate(corpo, exemplo)
    const win = window.open('', '_blank', 'width=720,height=900')
    if (!win) {
      alert('Bloqueador de pop-up impediu o preview. Libere o pop-up para este site.')
      return
    }
    win.document.write(html)
    win.document.close()
  }

  const copiarVariavel = async (nome: string) => {
    try {
      await navigator.clipboard.writeText(`{{${nome}}}`)
      setCopiada(nome)
      setTimeout(() => setCopiada(null), 1500)
    } catch {
      // alguns browsers exigem HTTPS — silencia
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div>
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            {titulo}
            {dirty && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">alterações não salvas</span>}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">{descricao}</p>
        </div>
        {aberto ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>

      {aberto && (
        <div className="px-6 pb-6 space-y-4 border-t border-gray-50">
          <div className="pt-4 bg-gray-50 -mx-6 px-6 py-3 mb-1">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Quando é enviado</p>
            <p className="text-xs text-gray-700">{quandoEnviado}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Variáveis disponíveis</p>
            <p className="text-[11px] text-gray-400 mb-2">Clique para copiar e cole no assunto ou no corpo.</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {variaveis.map(v => (
                <button
                  key={v.nome}
                  type="button"
                  onClick={() => copiarVariavel(v.nome)}
                  className="flex items-start gap-2 text-left bg-violet-50/50 hover:bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-2 transition-colors group"
                >
                  <code className="text-[11px] bg-white text-violet-700 px-1.5 py-0.5 rounded font-mono whitespace-nowrap shrink-0">{`{{${v.nome}}}`}</code>
                  <span className="text-[11px] text-gray-600 leading-snug flex-1">{v.descricao}</span>
                  {copiada === v.nome
                    ? <Check size={11} className="text-green-600 shrink-0" />
                    : <Copy size={11} className="text-gray-300 group-hover:text-violet-500 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Assunto</label>
            <input
              value={assunto}
              onChange={e => setAssunto(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Corpo (HTML)</label>
            <textarea
              value={corpo}
              onChange={e => setCorpo(e.target.value)}
              rows={16}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900 font-mono resize-y"
            />
            <p className="text-xs text-gray-400">HTML completo (com <code>&lt;html&gt;</code> e <code>&lt;body&gt;</code>). Variáveis em <code>{`{{nome}}`}</code> são substituídas no envio.</p>
          </div>

          {status === 'erro' && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">
              <AlertCircle size={15} />
              Erro ao salvar. Tente novamente.
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={preview}
                className="flex items-center gap-1.5 text-xs border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg"
                title="Abre uma janela com o e-mail renderizado usando dados de exemplo"
              >
                <Eye size={12} /> Pré-visualizar
              </button>
              <button
                type="button"
                onClick={restaurar}
                className="flex items-center gap-1.5 text-xs border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg"
                title="Volta ao template padrão do sistema (precisa clicar em Salvar pra gravar)"
              >
                <RotateCcw size={12} /> Restaurar padrão
              </button>
            </div>
            <button
              onClick={handleSalvar}
              disabled={isPending || !dirty}
              className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : status === 'ok' ? <Check size={14} /> : null}
              {isPending ? 'Salvando...' : status === 'ok' ? 'Salvo!' : 'Salvar template'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
