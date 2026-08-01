'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Link2, Loader2, Copy, Check, MessageCircle, Plus, X, AlertCircle,
  Eye, CheckCircle2, Clock, Ban, ChevronDown, Trash2,
} from 'lucide-react'
import { maskCep, maskMoney, parseMoney } from '@/lib/formatters'
import { formatarBRL } from '@/lib/formatters'
import { criarLinkAnalise, revogarLinkAnalise, excluirLinkAnalise } from '../../../actions-link'

interface ImovelOpcao {
  id: string
  titulo: string
  preco: number
  cep: string | null
  condominio: number | null
  iptu: number | null
  tipo: string | null
}

interface LinkView {
  id: string
  url: string
  titulo: string | null
  pessoaNome: string | null
  imovelTitulo: string | null
  aluguel: number | null
  expiraEm: string
  abertoEm: string | null
  preenchidoEm: string | null
  revogadoEm: string | null
  analiseId: string | null
  erro: string | null
  criadoEm: string
}

interface Props {
  baseUrl: string
  imoveis: ImovelOpcao[]
  links: LinkView[]
}

const input = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900'
const label = 'text-xs font-medium text-gray-600 block mb-1'

/** Fora do componente: `Date.now()` no corpo do render viola react-hooks/purity. */
function expirou(iso: string): boolean {
  return new Date(iso).getTime() < Date.now()
}

export function GerenciadorLinks({ imoveis, links }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [criando, setCriando] = useState(links.length === 0)
  const [erro, setErro] = useState('')
  const [novoLink, setNovoLink] = useState<{ url: string; expira: string } | null>(null)

  const [imovelId, setImovelId] = useState('')
  const [cep, setCep] = useState('')
  const [aluguel, setAluguel] = useState('')
  const [condominio, setCondominio] = useState('')
  const [iptu, setIptu] = useState('')
  const [meses, setMeses] = useState('30')
  const [finalidade, setFinalidade] = useState<'R' | 'C'>('R')
  const [completa, setCompleta] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [dias, setDias] = useState('7')

  const escolherImovel = (id: string) => {
    setImovelId(id)
    const i = imoveis.find(x => x.id === id)
    if (!i) return
    if (i.cep) setCep(maskCep(i.cep))
    setAluguel(maskMoney(String(Math.round(i.preco * 100))))
    setCondominio(i.condominio ? maskMoney(String(Math.round(i.condominio * 100))) : '')
    setIptu(i.iptu ? maskMoney(String(Math.round(i.iptu * 100))) : '')
  }

  const gerar = () => {
    setErro('')
    if (cep.replace(/\D/g, '').length !== 8) return setErro('Informe o CEP do imóvel.')
    if (parseMoney(aluguel) <= 0) return setErro('Informe o valor do aluguel.')

    startTransition(async () => {
      const r = await criarLinkAnalise({
        imovelId: imovelId || null,
        mensagem: mensagem || null,
        tipoAnalise: finalidade === 'C' || completa ? 'completa' : 'reduzida',
        diasValidade: parseInt(dias, 10) || 7,
        dadosImovel: {
          cep,
          aluguel: parseMoney(aluguel),
          condominio: parseMoney(condominio) || null,
          iptu: parseMoney(iptu) || null,
          finalidade,
          tipo: imoveis.find(i => i.id === imovelId)?.tipo ?? null,
          periodoContratoMeses: parseInt(meses, 10) || 30,
          pinturaNova: true,
        },
      })
      if (r.error) { setErro(r.error); return }
      setNovoLink({ url: r.url ?? '', expira: r.expiraEm ?? '' })
      setCriando(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {novoLink && (
        <CardLinkNovo url={novoLink.url} expira={novoLink.expira} onFechar={() => setNovoLink(null)} />
      )}

      {!criando ? (
        <button
          type="button"
          onClick={() => { setCriando(true); setNovoLink(null) }}
          className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold py-3 rounded-xl"
        >
          <Plus size={15} /> Gerar novo link
        </button>
      ) : (
        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Dados do imóvel</h2>
            {links.length > 0 && (
              <button type="button" onClick={() => setCriando(false)} className="text-gray-400 hover:text-gray-700" aria-label="Fechar">
                <X size={16} />
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 -mt-1">
            O inquilino só preenche os dados pessoais dele — o imóvel vai definido por você.
          </p>

          {imoveis.length > 0 && (
            <div>
              <label className={label}>Puxar de um imóvel</label>
              <div className="relative">
                <select value={imovelId} onChange={e => escolherImovel(e.target.value)} className={`${input} appearance-none pr-8`}>
                  <option value="">— preencher manualmente —</option>
                  {imoveis.map(i => <option key={i.id} value={i.id}>{i.titulo}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>CEP <span className="text-red-500">*</span></label>
              <input value={cep} onChange={e => setCep(maskCep(e.target.value))} className={input} inputMode="numeric" />
            </div>
            <div>
              <label className={label}>Finalidade</label>
              <div className="relative">
                <select value={finalidade} onChange={e => setFinalidade(e.target.value as 'R' | 'C')} className={`${input} appearance-none pr-8`}>
                  <option value="R">Residencial</option>
                  <option value="C">Comercial</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={label}>Aluguel <span className="text-red-500">*</span></label>
              <input value={aluguel} onChange={e => setAluguel(maskMoney(e.target.value))} className={input} inputMode="numeric" />
            </div>
            <div>
              <label className={label}>Condomínio</label>
              <input value={condominio} onChange={e => setCondominio(maskMoney(e.target.value))} className={input} inputMode="numeric" />
            </div>
            <div>
              <label className={label}>IPTU</label>
              <input value={iptu} onChange={e => setIptu(maskMoney(e.target.value))} className={input} inputMode="numeric" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>Duração (meses)</label>
              <input value={meses} onChange={e => setMeses(e.target.value.replace(/\D/g, ''))} className={input} inputMode="numeric" />
            </div>
            <div>
              <label className={label}>Link válido por (dias)</label>
              <input value={dias} onChange={e => setDias(e.target.value.replace(/\D/g, ''))} className={input} inputMode="numeric" />
            </div>
          </div>

          <div>
            <label className={label}>Recado pro inquilino (opcional)</label>
            <textarea
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              rows={2}
              placeholder="Ex.: preencha pra gente dar andamento na locação do apartamento."
              className={`${input} resize-y`}
            />
          </div>

          <label className={`flex items-start gap-2 ${finalidade === 'C' ? 'opacity-60' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={finalidade === 'C' || completa}
              disabled={finalidade === 'C'}
              onChange={e => setCompleta(e.target.checked)}
              className="accent-violet-600 mt-0.5"
            />
            <span>
              <p className="text-sm text-gray-900">Análise completa</p>
              <p className="text-[11px] text-gray-500 leading-tight">
                {finalidade === 'C'
                  ? 'Obrigatória para imóvel comercial.'
                  : 'Pede nascimento e sexo, mas inclui mais seguradoras.'}
              </p>
            </span>
          </label>

          {erro && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /> <span>{erro}</span>
            </div>
          )}

          <button
            type="button"
            onClick={gerar}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl"
          >
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
            Gerar link
          </button>
        </section>
      )}

      {links.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Links gerados ({links.length})
          </h2>
          {links.map(l => <CardLink key={l.id} l={l} />)}
        </section>
      )}
    </div>
  )
}

function CardLinkNovo({ url, expira, onFechar }: { url: string; expira: string; onFechar: () => void }) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {/* */}
  }

  const whatsapp = () => {
    const msg = `Olá! Pra dar andamento na locação, preencha seus dados pra análise do seguro fiança neste link (válido até ${new Date(expira).toLocaleDateString('pt-BR')}):\n\n${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2.5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-bold text-green-900 flex items-center gap-1.5">
          <CheckCircle2 size={15} /> Link pronto
        </p>
        <button type="button" onClick={onFechar} className="text-green-700/60 hover:text-green-900" aria-label="Fechar">
          <X size={15} />
        </button>
      </div>
      <div className="bg-white border border-green-200 rounded-lg px-3 py-2">
        <p className="text-xs text-gray-600 break-all">{url}</p>
      </div>
      <p className="text-[11px] text-green-800">
        Válido até {new Date(expira).toLocaleString('pt-BR')}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={whatsapp} className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-lg">
          <MessageCircle size={14} /> WhatsApp
        </button>
        <button type="button" onClick={copiar} className="flex items-center justify-center gap-1.5 bg-white border border-green-200 hover:bg-green-50 text-green-800 text-sm font-semibold px-4 py-2.5 rounded-lg">
          {copiado ? <Check size={14} /> : <Copy size={14} />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </section>
  )
}

function CardLink({ l }: { l: LinkView }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [copiado, setCopiado] = useState(false)

  const expirado = !l.preenchidoEm && !l.revogadoEm && expirou(l.expiraEm)

  const estado = l.preenchidoEm
    ? { label: 'Preenchido', cor: 'bg-green-100 text-green-700', Icone: CheckCircle2 }
    : l.revogadoEm
      ? { label: 'Cancelado', cor: 'bg-gray-100 text-gray-500', Icone: Ban }
      : expirado
        ? { label: 'Expirado', cor: 'bg-red-100 text-red-700', Icone: Clock }
        : l.abertoEm
          ? { label: 'Aberto', cor: 'bg-blue-100 text-blue-700', Icone: Eye }
          : { label: 'Aguardando', cor: 'bg-amber-100 text-amber-700', Icone: Clock }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(l.url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {/* */}
  }

  const revogar = () => {
    startTransition(async () => {
      const r = await revogarLinkAnalise(l.id)
      if (r.error) { alert(r.error); return }
      router.refresh()
    })
  }

  const excluir = () => {
    if (!confirm('Excluir este link?')) return
    startTransition(async () => {
      const r = await excluirLinkAnalise(l.id)
      if (r.error) { alert(r.error); return }
      router.refresh()
    })
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {l.pessoaNome ?? l.imovelTitulo ?? 'Link de análise'}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {l.imovelTitulo && l.pessoaNome && <>{l.imovelTitulo} · </>}
            {l.aluguel != null && <>{formatarBRL(l.aluguel)}</>}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            criado {new Date(l.criadoEm).toLocaleDateString('pt-BR')}
            {!l.preenchidoEm && !l.revogadoEm && (
              <> · vence {new Date(l.expiraEm).toLocaleDateString('pt-BR')}</>
            )}
          </p>
          {l.erro && <p className="text-[11px] text-red-600 mt-1 line-clamp-1">{l.erro}</p>}
        </div>
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full flex items-center gap-1 shrink-0 ${estado.cor}`}>
          <estado.Icone size={10} /> {estado.label}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-gray-50">
        {l.analiseId ? (
          <Link href={`/painel/seguros/fianca/${l.analiseId}`} className="text-xs font-semibold text-violet-700 hover:text-violet-800">
            Ver análise →
          </Link>
        ) : l.preenchidoEm || l.revogadoEm ? null : (
          <>
            <button type="button" onClick={copiar} className="text-xs text-gray-500 hover:text-violet-700 flex items-center gap-1">
              {copiado ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
              {copiado ? 'Copiado' : 'Copiar link'}
            </button>
            <button type="button" onClick={revogar} disabled={isPending} className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1">
              <Ban size={12} /> Cancelar
            </button>
          </>
        )}
        <button type="button" onClick={excluir} disabled={isPending} className="text-xs text-gray-400 hover:text-red-600 flex items-center gap-1 ml-auto">
          <Trash2 size={12} /> Excluir
        </button>
      </div>
    </div>
  )
}
