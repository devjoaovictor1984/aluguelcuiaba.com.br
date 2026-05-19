'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  MessageCircle, AlertTriangle, Clock, Calendar, Phone, X, Check,
  Pencil, RotateCcw,
} from 'lucide-react'
import { formatarBRL } from '@/lib/formatters'
import { gerarLinkWhatsApp } from '@/lib/utils'

export interface CobrancaRow {
  id: string
  contratoId: string
  contratoCodigo: string
  inquilinoNome: string
  inquilinoTelefone: string | null
  inquilinoEmail: string | null
  imovelTitulo: string | null
  bairroNome: string | null
  vencimento: string
  valor: number
  diasAteVenc: number
}

type Filtro = 'pendentes' | 'atrasados' | 'hoje' | 'esta_semana' | 'todos'

const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: 'pendentes',   label: 'Pendentes (todos)' },
  { valor: 'atrasados',   label: 'Atrasados' },
  { valor: 'hoje',        label: 'Vencem hoje' },
  { valor: 'esta_semana', label: 'Próximos 7 dias' },
  { valor: 'todos',       label: 'Próximos 30 dias' },
]

function templateMensagem(c: CobrancaRow, anunciante: string): string {
  const venc = new Date(c.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')
  const primeiroNome = c.inquilinoNome.split(' ')[0]
  const imovel = c.imovelTitulo ? ` do imóvel ${c.imovelTitulo}` : ''
  const valor = formatarBRL(c.valor)

  if (c.diasAteVenc < 0) {
    const atraso = -c.diasAteVenc
    return `Olá ${primeiroNome}, tudo bem?\n\nNotei que o aluguel${imovel} venceu há ${atraso} dia${atraso === 1 ? '' : 's'} (${venc}) e ainda não consta como pago no meu sistema.\n\nValor: ${valor}\n\nHouve algum imprevisto? Se já fez o pagamento, por favor me envie o comprovante.\n\n— ${anunciante}`
  }
  if (c.diasAteVenc === 0) {
    return `Olá ${primeiroNome}!\n\nLembrete: o aluguel${imovel} vence *hoje* (${venc}).\n\nValor: ${valor}\n\nJá enviei o boleto pra você. Qualquer coisa estou à disposição.\n\n— ${anunciante}`
  }
  if (c.diasAteVenc === 1) {
    return `Olá ${primeiroNome}, tudo bem?\n\nLembrando que o aluguel${imovel} vence *amanhã* (${venc}).\n\nValor: ${valor}\n\n— ${anunciante}`
  }
  if (c.diasAteVenc <= 5) {
    return `Olá ${primeiroNome}, tudo bem?\n\nPassando pra lembrar do aluguel${imovel} com vencimento em ${c.diasAteVenc} dias (${venc}).\n\nValor: ${valor}\n\nQualquer dúvida estou à disposição.\n\n— ${anunciante}`
  }
  return `Olá ${primeiroNome}, tudo bem?\n\nAviso amigável sobre o aluguel${imovel} com vencimento em ${venc}.\n\nValor: ${valor}\n\n— ${anunciante}`
}

interface Props {
  cobrancas: CobrancaRow[]
  anuncianteNome: string
  filtroInicial: string
}

export function ListaCobrancas({ cobrancas, anuncianteNome, filtroInicial }: Props) {
  const filtroInit = (FILTROS.find(f => f.valor === filtroInicial)?.valor ?? 'pendentes') as Filtro
  const [filtro, setFiltro] = useState<Filtro>(filtroInit)
  const [enviadas, setEnviadas] = useState<Set<string>>(new Set())

  const filtradas = useMemo(() => {
    return cobrancas.filter(c => {
      if (filtro === 'atrasados') return c.diasAteVenc < 0
      if (filtro === 'hoje')      return c.diasAteVenc === 0
      if (filtro === 'esta_semana') return c.diasAteVenc >= 0 && c.diasAteVenc <= 7
      if (filtro === 'todos')     return true
      // pendentes: tudo
      return true
    })
  }, [cobrancas, filtro])

  const semWpp = filtradas.filter(c => !c.inquilinoTelefone)
  const comWpp = filtradas.filter(c => c.inquilinoTelefone)
  const totalValor = filtradas.reduce((s, c) => s + c.valor, 0)

  const contadores = {
    pendentes:   cobrancas.length,
    atrasados:   cobrancas.filter(c => c.diasAteVenc < 0).length,
    hoje:        cobrancas.filter(c => c.diasAteVenc === 0).length,
    esta_semana: cobrancas.filter(c => c.diasAteVenc >= 0 && c.diasAteVenc <= 7).length,
    todos:       cobrancas.length,
  }

  const marcarEnviada = (id: string) => {
    setEnviadas(prev => new Set([...prev, id]))
  }

  return (
    <>
      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-wrap items-center gap-1">
        {FILTROS.map(f => {
          const ativo = filtro === f.valor
          const qtd = contadores[f.valor]
          return (
            <button
              key={f.valor}
              type="button"
              onClick={() => setFiltro(f.valor)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                ativo ? 'bg-violet-700 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ativo ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                {qtd}
              </span>
            </button>
          )
        })}
      </div>

      {filtradas.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Check size={32} className="mx-auto mb-3 text-green-300" />
          <p className="text-sm font-medium text-gray-700 mb-1">Nenhuma cobrança neste filtro</p>
          <p className="text-xs text-gray-500">Está tudo em dia 🎉</p>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center justify-between text-sm">
            <span className="text-gray-600">
              <strong className="text-gray-900">{filtradas.length}</strong> cobrança{filtradas.length === 1 ? '' : 's'}
              {comWpp.length > 0 && <span className="text-gray-400"> · {comWpp.length} com WhatsApp</span>}
              {semWpp.length > 0 && <span className="text-amber-700"> · {semWpp.length} sem telefone</span>}
            </span>
            <span className="font-bold text-violet-700">{formatarBRL(totalValor)}</span>
          </div>

          {/* Lista de cobranças com WhatsApp */}
          <div className="space-y-2">
            {comWpp.map(c => {
              const enviada = enviadas.has(c.id)
              return (
                <CobrancaCard
                  key={c.id}
                  cobranca={c}
                  enviada={enviada}
                  anuncianteNome={anuncianteNome}
                  onEnviado={() => marcarEnviada(c.id)}
                />
              )
            })}
          </div>

          {/* Sem WhatsApp */}
          {semWpp.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mt-4">
              <h3 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
                <AlertTriangle size={14} /> Sem WhatsApp ({semWpp.length})
              </h3>
              <p className="text-xs text-amber-800 mb-3">
                Os inquilinos abaixo não têm telefone cadastrado. Atualize a ficha pra poder enviar lembretes.
              </p>
              <ul className="space-y-1 text-xs">
                {semWpp.map(c => (
                  <li key={c.id} className="flex items-center justify-between">
                    <Link href={`/painel/contratos/${c.contratoId}`} className="text-amber-900 hover:underline">
                      {c.inquilinoNome} · {c.imovelTitulo}
                    </Link>
                    <span className="text-amber-700 font-medium">{formatarBRL(c.valor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  )
}

function CobrancaCard({
  cobranca: c, enviada, anuncianteNome, onEnviado,
}: {
  cobranca: CobrancaRow
  enviada: boolean
  anuncianteNome: string
  onEnviado: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const mensagemPadrao = useMemo(() => templateMensagem(c, anuncianteNome), [c, anuncianteNome])
  const [mensagem, setMensagem] = useState(mensagemPadrao)
  const [editado, setEditado] = useState(false)

  // Persiste edições por parcela em localStorage (sobrevive a F5)
  useEffect(() => {
    const salva = localStorage.getItem(`cobranca_msg_${c.id}`)
    if (salva && salva !== mensagemPadrao) {
      setMensagem(salva)
      setEditado(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id])

  const onChangeMsg = (v: string) => {
    setMensagem(v)
    setEditado(v.trim() !== mensagemPadrao.trim())
    if (v.trim() && v.trim() !== mensagemPadrao.trim()) {
      localStorage.setItem(`cobranca_msg_${c.id}`, v)
    } else {
      localStorage.removeItem(`cobranca_msg_${c.id}`)
    }
  }

  const restaurarPadrao = () => {
    setMensagem(mensagemPadrao)
    setEditado(false)
    localStorage.removeItem(`cobranca_msg_${c.id}`)
  }

  const url = gerarLinkWhatsApp(c.inquilinoTelefone!, mensagem)
  const tipo = c.diasAteVenc < 0 ? 'atrasado' : c.diasAteVenc === 0 ? 'hoje' : c.diasAteVenc <= 5 ? 'proximo' : 'futuro'
  const venc = new Date(c.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')

  const corBorda =
    enviada ? 'border-gray-200 opacity-60' :
    tipo === 'atrasado' ? 'border-red-200 bg-red-50/30' :
    tipo === 'hoje' ? 'border-amber-300 bg-amber-50/30' :
    tipo === 'proximo' ? 'border-amber-100' :
    'border-gray-100'

  return (
    <div className={`bg-white rounded-xl border ${corBorda} shadow-sm transition-colors`}>
      <div className="p-3 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/painel/contratos/${c.contratoId}`} className="font-semibold text-gray-900 hover:text-violet-700">
              {c.inquilinoNome}
            </Link>
            <BadgeStatus dias={c.diasAteVenc} />
            {editado && !aberto && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                <Pencil size={9} /> mensagem personalizada
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {c.imovelTitulo}{c.bairroNome && ` · ${c.bairroNome}`}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><Calendar size={10} />Venc. {venc}</span>
            <span className="flex items-center gap-1"><Phone size={10} />{c.inquilinoTelefone}</span>
            <span className="font-mono">{c.contratoCodigo}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-gray-900">{formatarBRL(c.valor)}</span>
          <button
            type="button"
            onClick={() => setAberto(v => !v)}
            className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-colors ${
              aberto
                ? 'bg-violet-100 text-violet-700'
                : 'text-gray-500 hover:text-violet-700 hover:bg-gray-50 border border-gray-200'
            }`}
            title="Ver e editar a mensagem"
          >
            <Pencil size={11} /> {aberto ? 'Fechar' : 'Editar msg'}
          </button>
          {enviada ? (
            <button
              onClick={() => onEnviado()}
              className="flex items-center gap-1.5 bg-gray-100 text-gray-500 text-xs font-medium px-3 py-1.5 rounded-lg"
            >
              <Check size={12} /> Enviado
            </button>
          ) : (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onEnviado}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              <MessageCircle size={12} /> Enviar
            </a>
          )}
        </div>
      </div>

      {aberto && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-50 mt-1 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Mensagem que será enviada
              {editado && <span className="ml-1 text-violet-600 normal-case font-medium">· editada</span>}
            </p>
            <div className="flex items-center gap-1">
              {editado && (
                <button
                  type="button"
                  onClick={restaurarPadrao}
                  className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-violet-700 px-2 py-1 rounded hover:bg-gray-50"
                  title="Voltar à mensagem padrão do sistema"
                >
                  <RotateCcw size={10} /> Padrão
                </button>
              )}
              <button onClick={() => setAberto(false)} className="text-gray-300 hover:text-gray-500 p-1">
                <X size={12} />
              </button>
            </div>
          </div>
          <textarea
            value={mensagem}
            onChange={e => onChangeMsg(e.target.value)}
            rows={Math.max(6, Math.min(14, mensagem.split('\n').length + 1))}
            className="w-full text-[12px] text-gray-800 bg-white border border-gray-200 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200 rounded-lg p-2.5 font-sans leading-relaxed resize-y"
            placeholder="Escreva sua mensagem aqui…"
          />
          <p className="text-[10px] text-gray-400 leading-relaxed">
            💡 Edite à vontade. Sua versão fica salva nesse navegador até você enviar ou clicar em &quot;Padrão&quot;.
            {' '}A mensagem só vai pro WhatsApp quando você clicar em <strong>Enviar</strong>.
          </p>
        </div>
      )}
    </div>
  )
}

function BadgeStatus({ dias }: { dias: number }) {
  if (dias < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
        <AlertTriangle size={9} /> {-dias}d atraso
      </span>
    )
  }
  if (dias === 0) {
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">VENCE HOJE</span>
  }
  if (dias === 1) {
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">amanhã</span>
  }
  if (dias <= 5) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
        <Clock size={9} /> em {dias}d
      </span>
    )
  }
  return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">em {dias}d</span>
}
