'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RefreshCw, CheckCircle2, Pause, RotateCcw, Pencil, Eye } from 'lucide-react'
import { PrecoImovel } from '@/components/preco-imovel'
import { renovarAnuncio, mudarStatusImovel } from './actions'

interface CardImovel {
  id: string
  titulo: string
  preco: number
  preco_antigo?: number | null
  status: string
  expira_em: string
  visualizacoes: number
  data_alugado?: string | null
  fotos?: Array<{ url: string }>
  bairro?: { nome: string } | null
}

function diasParaExpirar(expira_em: string) {
  return Math.ceil((new Date(expira_em).getTime() - Date.now()) / 86_400_000)
}

// Quantos dias o imóvel já está alugado e quantos faltam pra sair do site (janela de 30d)
function infoAlugado(data_alugado?: string | null): { ha: number; saiEm: number } | null {
  if (!data_alugado) return null
  const ha = Math.floor((Date.now() - new Date(data_alugado).getTime()) / 86_400_000)
  return { ha: Math.max(0, ha), saiEm: Math.max(0, 30 - ha) }
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ativo:     { label: 'Ativo',    cls: 'bg-green-100 text-green-700' },
  pausado:   { label: 'Pausado',  cls: 'bg-gray-100 text-gray-500'   },
  alugado:   { label: 'Alugado', cls: 'bg-teal-100 text-teal-700'   },
  expirado:  { label: 'Expirado', cls: 'bg-red-100 text-red-600'     },
  rascunho:  { label: 'Rascunho', cls: 'bg-yellow-100 text-yellow-700' },
}

export function PainelImovelCard({ imovel }: { imovel: CardImovel }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const dias = diasParaExpirar(imovel.expira_em)
  const foto = imovel.fotos?.[0]?.url
  const status = imovel.status
  const expirado = dias <= 0 && status === 'ativo'
  const expiraEmBreve = dias > 0 && dias <= 7 && status === 'ativo'

  const statusInfo = expirado
    ? STATUS_LABEL.expirado
    : STATUS_LABEL[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' }

  async function handle(action: () => Promise<{ error?: string; success?: boolean }>, key: string) {
    setErro('')
    setLoading(key)
    const result = await action()
    if (result?.error) setErro(result.error)
    setLoading(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* ── Info row ── */}
      <div className="flex items-center gap-4 p-4">
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100">
          {foto
            ? <img src={foto} alt={imovel.titulo} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-2xl">🏠</div>
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate text-sm">{imovel.titulo}</p>
          <PrecoImovel preco={imovel.preco} precoAntigo={imovel.preco_antigo} size="sm" />
          <p className="text-xs text-gray-400">{imovel.bairro?.nome ?? '—'}</p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusInfo.cls}`}>
            {expiraEmBreve ? `${dias}d restantes` : statusInfo.label}
          </span>
          <Link
            href={`/painel/anuncios/${imovel.id}/editar`}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-violet-600 transition-colors"
          >
            <Pencil size={10} /> Editar
          </Link>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="px-4 py-2 border-t border-gray-50 flex items-center gap-3 text-xs text-gray-400 flex-wrap">
        <span className="flex items-center gap-1">
          <Eye size={11} />
          {imovel.visualizacoes.toLocaleString('pt-BR')} visualização{imovel.visualizacoes !== 1 ? 'ões' : ''}
        </span>
        {status === 'alugado' && (() => {
          const info = infoAlugado(imovel.data_alugado)
          if (!info) return null
          return (
            <span className="flex items-center gap-1 text-teal-600">
              <CheckCircle2 size={11} />
              Alugado há {info.ha}d · {info.saiEm > 0 ? `sai do site em ${info.saiEm}d` : 'fora do site'}
            </span>
          )
        })()}
      </div>

      {/* ── Ações ── */}
      <div className="px-4 pb-3 pt-0 flex items-center gap-2 flex-wrap border-t border-gray-50">

        {/* Renovar — quando ativo expirando ou expirado */}
        {(expirado || expiraEmBreve) && (
          <button
            onClick={() => handle(() => renovarAnuncio(imovel.id), 'renovar')}
            disabled={loading !== null}
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            <RefreshCw size={11} className={loading === 'renovar' ? 'animate-spin' : ''} />
            Renovar +30 dias
          </button>
        )}

        {/* Marcar alugado — quando ativo */}
        {status === 'ativo' && (
          <button
            onClick={() => handle(() => mudarStatusImovel(imovel.id, 'alugado'), 'alugado')}
            disabled={loading !== null}
            className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            <CheckCircle2 size={11} className={loading === 'alugado' ? 'animate-spin' : ''} />
            Marcar alugado
          </button>
        )}

        {/* Pausar — quando ativo */}
        {status === 'ativo' && (
          <button
            onClick={() => handle(() => mudarStatusImovel(imovel.id, 'pausado'), 'pausado')}
            disabled={loading !== null}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            <Pause size={11} className={loading === 'pausado' ? 'animate-spin' : ''} />
            Pausar
          </button>
        )}

        {/* Reativar — quando alugado ou pausado */}
        {(status === 'alugado' || status === 'pausado') && (
          <button
            onClick={() => handle(() => mudarStatusImovel(imovel.id, 'ativo'), 'ativo')}
            disabled={loading !== null}
            className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            <RotateCcw size={11} className={loading === 'ativo' ? 'animate-spin' : ''} />
            Reativar anúncio
          </button>
        )}

        {erro && <p className="text-xs text-red-500 w-full pt-1">{erro}</p>}
      </div>
    </div>
  )
}
