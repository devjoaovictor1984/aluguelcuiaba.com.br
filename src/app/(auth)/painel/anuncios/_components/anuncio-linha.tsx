'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Pencil, ExternalLink, MoreHorizontal, RefreshCw, KeyRound, Pause, Play,
  Trash2, Eye, Loader2, BedDouble, Ruler,
} from 'lucide-react'
import { buildImovelUrl, formatarPreco } from '@/lib/utils'
import { thumbSupabase } from '@/lib/img-thumb'
import { TIPOS_IMOVEL } from '@/lib/constants'
import type { StatusImovel } from '@/types'
import { alterarStatusAnuncio, excluirAnuncio, renovarAnuncio30d } from '../actions-crud'

export interface AnuncioItem {
  id: string
  slug: string | null
  titulo: string
  tipo: string
  preco: number
  preco_antigo: number | null
  status: string
  expira_em: string
  visualizacoes: number | null
  data_alugado: string | null
  created_at: string
  updated_at: string
  user_id: string
  quartos: number | null
  area_m2: number | null
  fotos: Array<{ url: string }> | null
  bairro: { nome: string; slug: string } | null
  perfil: { nome: string | null } | null
}

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  ativo:    { label: 'No ar',    cls: 'text-green-700 bg-green-50 ring-green-200',   dot: 'bg-green-500' },
  alugado:  { label: 'Alugado',  cls: 'text-teal-700 bg-teal-50 ring-teal-200',      dot: 'bg-teal-500' },
  pausado:  { label: 'Pausado',  cls: 'text-gray-600 bg-gray-50 ring-gray-200',      dot: 'bg-gray-400' },
  expirado: { label: 'Expirado', cls: 'text-red-700 bg-red-50 ring-red-200',         dot: 'bg-red-500' },
  rascunho: { label: 'Rascunho', cls: 'text-amber-700 bg-amber-50 ring-amber-200',   dot: 'bg-amber-500' },
}

const DIA = 86_400_000

export function AnuncioLinha({ imovel, agora, mostrarAnunciante, ehDono }: {
  /** Instante do request, vindo do servidor: o mesmo relógio para todas as
   *  linhas e para a hidratação (Date.now() aqui daria um no SSR e outro no navegador). */
  imovel: AnuncioItem; agora: number; mostrarAnunciante: boolean; ehDono: boolean
}) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [acao, setAcao] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [menu, setMenu] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fecha o menu ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!menu) return
    const fora = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [menu])

  const dias = Math.ceil((new Date(imovel.expira_em).getTime() - agora) / DIA)
  const expirado = imovel.status === 'expirado' || (imovel.status === 'ativo' && dias <= 0)
  const efetivo = expirado ? 'expirado' : imovel.status
  const st = STATUS[efetivo] ?? { label: efetivo, cls: 'text-gray-600 bg-gray-50 ring-gray-200', dot: 'bg-gray-400' }
  const expiraEmBreve = efetivo === 'ativo' && dias <= 7
  const noSite = efetivo === 'ativo' || efetivo === 'alugado'
  const tipo = TIPOS_IMOVEL.find(t => t.value === imovel.tipo)?.label ?? imovel.tipo
  const foto = imovel.fotos?.[0]?.url

  const rodar = (chave: string, fn: () => Promise<{ error?: string }>) => {
    setErro(''); setMenu(false); setAcao(chave)
    startTransition(async () => {
      const r = await fn()
      if (r?.error) setErro(r.error)
      else router.refresh()
      setAcao(null)
      setConfirmarExclusao(false)
    })
  }
  const status = (s: StatusImovel) => rodar(s, () => alterarStatusAnuncio(imovel.id, s))

  // Linha de "situação": o que a pessoa precisa saber sem abrir o anúncio.
  let situacao: { txt: string; cls: string } | null = null
  if (expirado) situacao = { txt: 'Fora do site — renove para voltar', cls: 'text-red-600' }
  else if (expiraEmBreve) situacao = { txt: `Expira em ${dias} dia${dias === 1 ? '' : 's'}`, cls: 'text-amber-600' }
  else if (efetivo === 'ativo') situacao = { txt: `No ar até ${new Date(imovel.expira_em).toLocaleDateString('pt-BR')}`, cls: 'text-gray-400' }
  else if (efetivo === 'alugado' && imovel.data_alugado) {
    const ha = Math.max(0, Math.floor((agora - new Date(imovel.data_alugado).getTime()) / DIA))
    const sai = Math.max(0, 30 - ha)
    situacao = { txt: sai > 0 ? `Alugado há ${ha}d · faixa "alugado" some em ${sai}d` : `Alugado há ${ha}d · fora do site`, cls: 'text-teal-600' }
  }

  const itemMenu = 'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 disabled:opacity-50'

  return (
    <li className={`relative p-3 sm:p-4 ${pendente ? 'opacity-60' : ''}`}>
      <div className="flex gap-3 sm:gap-4">
        {/* Foto */}
        <Link href={`/painel/anuncios/${imovel.id}/editar`} className="shrink-0 w-20 h-20 sm:w-28 sm:h-20 rounded-xl overflow-hidden bg-gray-100 block">
          {foto
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={thumbSupabase(foto, 240)} alt="" loading="lazy" className="w-full h-full object-cover" />
            : <span className="w-full h-full flex items-center justify-center text-2xl">🏠</span>}
        </Link>

        {/* Dados */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <Link href={`/painel/anuncios/${imovel.id}/editar`} className="flex-1 min-w-0 font-semibold text-gray-900 text-sm sm:text-[15px] leading-snug line-clamp-2 hover:text-violet-700">
              {imovel.titulo}
            </Link>
            <span className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${st.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              {st.label}
            </span>
          </div>

          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {tipo}
            {imovel.bairro?.nome && <> · {imovel.bairro.nome}</>}
            {mostrarAnunciante && <> · <span className="text-violet-700 font-medium">{imovel.perfil?.nome ?? 'sem nome'}</span>{ehDono && ' (você)'}</>}
          </p>

          <div className="flex items-center gap-x-3 gap-y-0.5 mt-1 flex-wrap text-xs text-gray-500">
            <span className="text-sm font-bold text-gray-900">
              {formatarPreco(imovel.preco)}
              {imovel.preco_antigo != null && imovel.preco_antigo > imovel.preco && (
                <span className="ml-1.5 text-xs font-normal text-gray-400 line-through">{formatarPreco(imovel.preco_antigo)}</span>
              )}
            </span>
            {!!imovel.quartos && <span className="inline-flex items-center gap-1"><BedDouble size={12} />{imovel.quartos}</span>}
            {!!imovel.area_m2 && <span className="inline-flex items-center gap-1"><Ruler size={12} />{imovel.area_m2} m²</span>}
            <span className="inline-flex items-center gap-1"><Eye size={12} />{(imovel.visualizacoes ?? 0).toLocaleString('pt-BR')}</span>
          </div>

          {situacao && <p className={`text-[11px] mt-1 ${situacao.cls}`}>{situacao.txt}</p>}
        </div>
      </div>

      {/* Ações: a principal fica à vista; o resto no menu "⋯". */}
      <div className="flex items-center gap-2 mt-3 sm:mt-2 sm:pl-32">
        <Link
          href={`/painel/anuncios/${imovel.id}/editar`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:border-violet-300 hover:text-violet-700 px-3 py-1.5 rounded-lg"
        >
          <Pencil size={12} /> Editar
        </Link>

        {(expirado || expiraEmBreve) && (
          <button
            type="button"
            onClick={() => rodar('renovar', () => renovarAnuncio30d(imovel.id))}
            disabled={pendente}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            <RefreshCw size={12} className={acao === 'renovar' ? 'animate-spin' : ''} /> Renovar +30 dias
          </button>
        )}

        {noSite && (
          <a
            href={buildImovelUrl(imovel)}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-violet-700 px-2 py-1.5"
          >
            <ExternalLink size={12} /> Ver no site
          </a>
        )}

        <div className="relative ml-auto" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenu(m => !m)}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label="Mais ações"
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            {pendente ? <Loader2 size={16} className="animate-spin" /> : <MoreHorizontal size={16} />}
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-gray-100 shadow-lg py-1 z-20">
              {noSite && (
                <a href={buildImovelUrl(imovel)} target="_blank" rel="noopener noreferrer" role="menuitem" className={`${itemMenu} text-gray-700 sm:hidden`}>
                  <ExternalLink size={14} /> Ver no site
                </a>
              )}
              {efetivo === 'ativo' && (
                <>
                  <button role="menuitem" type="button" onClick={() => status('alugado')} className={`${itemMenu} text-teal-700`}>
                    <KeyRound size={14} /> Marcar como alugado
                  </button>
                  <button role="menuitem" type="button" onClick={() => status('pausado')} className={`${itemMenu} text-gray-700`}>
                    <Pause size={14} /> Pausar anúncio
                  </button>
                </>
              )}
              {(efetivo === 'alugado' || efetivo === 'pausado' || efetivo === 'rascunho') && (
                <button role="menuitem" type="button" onClick={() => status('ativo')} className={`${itemMenu} text-green-700`}>
                  <Play size={14} /> {efetivo === 'rascunho' ? 'Publicar' : 'Reativar anúncio'}
                </button>
              )}
              {!expirado && !expiraEmBreve && efetivo === 'ativo' && (
                <button role="menuitem" type="button" onClick={() => rodar('renovar', () => renovarAnuncio30d(imovel.id))} className={`${itemMenu} text-violet-700`}>
                  <RefreshCw size={14} /> Renovar +30 dias
                </button>
              )}
              <div className="my-1 border-t border-gray-100" />
              <button role="menuitem" type="button" onClick={() => { setMenu(false); setConfirmarExclusao(true) }} className={`${itemMenu} text-red-600`}>
                <Trash2 size={14} /> Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmação inline — sem window.confirm (bloqueia a aba e é feio no celular). */}
      {confirmarExclusao && (
        <div className="mt-3 flex items-center gap-2 flex-wrap bg-red-50 ring-1 ring-red-200 rounded-xl px-3 py-2.5">
          <p className="text-xs text-red-800 flex-1 min-w-[180px]">
            Excluir <strong>definitivamente</strong> este anúncio e as fotos? Contratos ligados a ele ficam, sem o vínculo.
            {!ehDono && <> Ele é de <strong>{imovel.perfil?.nome ?? 'outro anunciante'}</strong>.</>}
          </p>
          <button type="button" onClick={() => setConfirmarExclusao(false)} className="text-xs font-semibold text-gray-600 px-3 py-1.5 rounded-lg hover:bg-white">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => rodar('excluir', () => excluirAnuncio(imovel.id))}
            disabled={pendente}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {acao === 'excluir' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Excluir
          </button>
        </div>
      )}

      {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}
    </li>
  )
}
