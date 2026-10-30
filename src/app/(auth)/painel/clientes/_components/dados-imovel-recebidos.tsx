'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Home, Loader2, Check, AlertCircle, Plus, FileSignature } from 'lucide-react'
import { CAMPOS_IMOVEL, LABEL_MOBILIADO } from '@/lib/crm/campos-imovel'
import { TIPOS_IMOVEL } from '@/lib/constants'
import { aplicarDadosImovel } from '../actions-solicitacao'
import type { ImovelOpcao } from './bloco-solicitacao'

export interface CaptacaoRecebida {
  id: string
  preenchido_em: string
  imovel_id: string | null
  dados_imovel: Record<string, string>
}

interface Props {
  pessoaId: string
  captacoes: CaptacaoRecebida[]
  imoveis: ImovelOpcao[]
}

const LABEL_TIPO: Record<string, string> = Object.fromEntries(TIPOS_IMOVEL.map(t => [t.value, t.label]))

function valorLegivel(chave: string, v: string): string {
  if (chave === 'imovel_tipo') return LABEL_TIPO[v] ?? v
  if (chave === 'imovel_mobiliado') return LABEL_MOBILIADO[v] ?? v
  return v
}

/**
 * O que a proprietária mandou no bloco de imóvel do link. Quando o link foi
 * gerado sem imóvel (captação), é daqui que sai o anúncio — ou se aplica
 * num imóvel que já existe.
 */
export function DadosImovelRecebidos({ pessoaId, captacoes, imoveis }: Props) {
  if (captacoes.length === 0) return null
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
          <Home size={16} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Dados do imóvel recebidos</h2>
          <p className="text-xs text-gray-500">
            Preenchidos pela pessoa no link. Os documentos do imóvel estão na lista de documentos acima.
          </p>
        </div>
      </div>
      {captacoes.map(c => <Captacao key={c.id} pessoaId={pessoaId} captacao={c} imoveis={imoveis} />)}
    </section>
  )
}

function Captacao({ pessoaId, captacao, imoveis }: { pessoaId: string; captacao: CaptacaoRecebida; imoveis: ImovelOpcao[] }) {
  const router = useRouter()
  const [imovelId, setImovelId] = useState('')
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const preenchidos = CAMPOS_IMOVEL.filter(c => captacao.dados_imovel[c.chave])
  const vinculado = captacao.imovel_id ? imoveis.find(i => i.id === captacao.imovel_id) : null

  const aplicar = () => {
    if (!imovelId) return
    setErro('')
    startTransition(async () => {
      const r = await aplicarDadosImovel(captacao.id, imovelId)
      if (r.error) { setErro(r.error); return }
      router.refresh()
    })
  }

  return (
    <div className="border border-gray-100 rounded-xl p-4">
      <p className="text-[11px] text-gray-400 mb-3">
        Recebido em {new Date(captacao.preenchido_em).toLocaleString('pt-BR')}
      </p>

      {preenchidos.length === 0 ? (
        <p className="text-xs text-gray-500">Nenhum campo do imóvel foi preenchido.</p>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {preenchidos.map(c => (
            <div key={c.chave} className={c.formato === 'longo' ? 'sm:col-span-2' : ''}>
              <dt className="text-[10px] uppercase tracking-wider text-gray-400">{c.curto}</dt>
              <dd className="text-sm text-gray-900 whitespace-pre-line break-words">
                {valorLegivel(c.chave, captacao.dados_imovel[c.chave])}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100">
        {captacao.imovel_id ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-1.5 text-xs text-green-700">
              <Check size={12} />
              Gravado no imóvel{' '}
              <Link href={`/painel/anuncios/${captacao.imovel_id}/editar`} className="font-semibold underline">
                {vinculado?.titulo ?? 'vinculado'}
              </Link>
            </p>
            <Link
              href={`/painel/administracoes/novo?proprietario=${pessoaId}&imovel=${captacao.imovel_id}`}
              className="flex items-center gap-1 text-xs border border-violet-200 text-violet-700 hover:bg-violet-50 px-3 py-1.5 rounded-lg"
            >
              <FileSignature size={12} /> Criar contrato de administração
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/painel/anuncios/novo?captacao=${captacao.id}`}
              className="flex items-center gap-1 text-xs bg-violet-700 hover:bg-violet-800 text-white font-semibold px-3 py-1.5 rounded-lg"
            >
              <Plus size={12} /> Criar anúncio com estes dados
            </Link>
            {imoveis.length > 0 && (
              <>
                <span className="text-[11px] text-gray-400">ou</span>
                <select
                  value={imovelId}
                  onChange={e => setImovelId(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white max-w-[16rem]"
                >
                  <option value="">Aplicar num imóvel existente…</option>
                  {imoveis.map(im => <option key={im.id} value={im.id}>{im.titulo}</option>)}
                </select>
                <button
                  type="button"
                  onClick={aplicar}
                  disabled={!imovelId || isPending}
                  className="flex items-center gap-1 text-xs border border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-40 px-3 py-1.5 rounded-lg"
                >
                  {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Aplicar
                </button>
              </>
            )}
          </div>
        )}
        {erro && (
          <p className="flex items-center gap-1 text-xs text-red-600 mt-2">
            <AlertCircle size={12} /> {erro}
          </p>
        )}
      </div>
    </div>
  )
}
