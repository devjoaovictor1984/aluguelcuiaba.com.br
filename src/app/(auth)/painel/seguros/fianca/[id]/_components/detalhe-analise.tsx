'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  RefreshCw, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle,
  FileText, ScanFace, Trash2, RotateCcw, Copy, Check, FileSignature, ShieldCheck,
} from 'lucide-react'
import { STATUS_ANALISE, STATUS_BIOMETRIA, statusAprovado, statusPendente } from '@/lib/seguros/tabelas'
import { formatarBRL } from '@/lib/formatters'
import { sincronizarAnalise, reanalisar, excluirAnalise } from '../../../actions'

interface ParecerView {
  id: string
  seguradoraSigla: string
  seguradoraNome: string | null
  codigoStatus: number | null
  descricaoStatus: string | null
  codigoAnalise: string | null
  limiteAprovado: number | null
  statusBiometria: number | null
  linkBiometria: string | null
  msg: string | null
  atualizadoEm: string
}

interface ArquivoView {
  id: string
  seguradoraSigla: string | null
  codigoTipo: number
  descricao: string | null
  recebidoEm: string
  url: string | null
}

interface ContratacaoView {
  id: string
  seguradoraSigla: string
  tipoPlano: string | null
  formaPagto: string | null
  qtdParcelas: number | null
  valorParcela: number | null
  premioTotal: number | null
  inicioVigencia: string | null
  fimVigencia: string | null
  status: string
  apoliceNumero: string | null
  erro: string | null
}

interface Props {
  analiseId: string
  contratoId: string | null
  transmitida: boolean
  erro: string | null
  pareceres: ParecerView[]
  arquivos: ArquivoView[]
  contratacao: ContratacaoView | null
}

export function DetalheAnalise({
  analiseId, transmitida, erro, pareceres, arquivos, contratacao,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState('')
  const [erroAcao, setErroAcao] = useState('')

  const temPendente = pareceres.some(p => statusPendente(p.codigoStatus))
  const recusadas = pareceres.filter(p => p.codigoStatus === 3).map(p => p.seguradoraSigla)
  const aprovadas = pareceres.filter(p => statusAprovado(p.codigoStatus))
  const podeContratar = aprovadas.length > 0 && !contratacao

  const sincronizar = () => {
    setErroAcao(''); setMsg('')
    startTransition(async () => {
      const r = await sincronizarAnalise(analiseId)
      if (r.error) { setErroAcao(r.error); return }
      setMsg(`Atualizado — ${r.pareceres} parecer(es), ${r.arquivos} documento(s).`)
      router.refresh()
    })
  }

  const tentarDeNovo = () => {
    setErroAcao(''); setMsg('')
    startTransition(async () => {
      const r = await reanalisar(analiseId, recusadas)
      if (r.error) { setErroAcao(r.error); return }
      setMsg('Reanálise enviada.')
      router.refresh()
    })
  }

  const excluir = () => {
    if (!confirm('Excluir esta cotação e seus documentos? Não dá pra desfazer.')) return
    startTransition(async () => {
      const r = await excluirAnalise(analiseId)
      if (r.error) { setErroAcao(r.error); return }
      router.push('/painel/seguros/fianca')
    })
  }

  return (
    <div className="space-y-4">
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Falha ao transmitir</p>
            <p className="text-xs mt-0.5">{erro}</p>
          </div>
        </div>
      )}

      {transmitida && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={sincronizar}
            disabled={isPending}
            className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Atualizar status
          </button>
          {recusadas.length > 0 && (
            <button
              type="button"
              onClick={tentarDeNovo}
              disabled={isPending}
              className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-semibold px-4 py-2.5 rounded-xl"
            >
              <RotateCcw size={14} /> Tentar de novo ({recusadas.length})
            </button>
          )}
        </div>
      )}

      {temPendente && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <Clock size={12} /> Alguma seguradora ainda está analisando. O status chega sozinho — ou clique em atualizar.
        </p>
      )}

      {/* Aprovado e ainda não contratado: o passo que gera a apólice. */}
      {podeContratar && (
        <Link
          href={`/painel/seguros/fianca/${analiseId}/contratar`}
          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 rounded-xl"
        >
          <FileSignature size={16} />
          Contratar seguro
          {aprovadas.length > 1 && ` (${aprovadas.length} seguradoras aprovaram)`}
        </Link>
      )}

      {contratacao && <CardContratacao c={contratacao} />}

      {msg && <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{msg}</p>}
      {erroAcao && <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{erroAcao}</p>}

      {/* Pareceres: uma análise, N respostas independentes. */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Seguradoras ({pareceres.length})
        </h2>
        {pareceres.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white border border-gray-100 rounded-2xl p-6 text-center">
            Nenhum parecer ainda.
          </p>
        ) : (
          pareceres.map(p => <CardParecer key={p.id} p={p} />)
        )}
      </section>

      {arquivos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Documentos</h2>
          <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
            {arquivos.map(a => (
              <a
                key={a.id}
                href={a.url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2.5 px-4 py-3 hover:bg-gray-50 ${!a.url ? 'pointer-events-none opacity-50' : ''}`}
              >
                <FileText size={15} className="text-violet-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 truncate">{a.descricao ?? `Documento ${a.codigoTipo}`}</p>
                  <p className="text-[11px] text-gray-400">
                    {a.seguradoraSigla?.toUpperCase()} · {new Date(a.recebidoEm).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={excluir}
          disabled={isPending}
          className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
          <Trash2 size={14} /> Excluir
        </button>
      </div>
    </div>
  )
}

function CardContratacao({ c }: { c: ContratacaoView }) {
  const emitida = c.status === 'emitida'
  const falhou = c.status === 'erro'

  const cor = emitida
    ? 'border-green-200 bg-green-50'
    : falhou ? 'border-red-200 bg-red-50'
    : 'border-blue-200 bg-blue-50'

  return (
    <section className={`border rounded-2xl px-4 py-3 space-y-1.5 ${cor}`}>
      <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
        <ShieldCheck size={15} className={emitida ? 'text-green-600' : falhou ? 'text-red-500' : 'text-blue-600'} />
        {emitida ? 'Apólice emitida' : falhou ? 'Falha na contratação' : 'Contratação enviada'}
      </p>

      {falhou ? (
        <p className="text-xs text-red-800">{c.erro}</p>
      ) : (
        <>
          <p className="text-sm text-gray-800">
            {c.seguradoraSigla.toUpperCase()}
            {c.formaPagto && <> · {c.formaPagto}</>}
            {c.qtdParcelas && c.valorParcela != null && (
              <> · {c.qtdParcelas}× {formatarBRL(c.valorParcela)}</>
            )}
          </p>
          {c.premioTotal != null && (
            <p className="text-base font-bold text-gray-900">{formatarBRL(c.premioTotal)}</p>
          )}
          {c.inicioVigencia && c.fimVigencia && (
            <p className="text-[11px] text-gray-600">
              vigência {new Date(c.inicioVigencia + 'T00:00:00').toLocaleDateString('pt-BR')}
              {' '}a {new Date(c.fimVigencia + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
          )}
          {c.apoliceNumero ? (
            <p className="text-xs font-semibold text-green-800">
              Apólice nº {c.apoliceNumero}
            </p>
          ) : (
            <p className="text-[11px] text-blue-800">
              Aguardando a seguradora emitir. O número da apólice aparece aqui
              assim que chegar.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function CardParecer({ p }: { p: ParecerView }) {
  const [copiado, setCopiado] = useState(false)
  const aprovado = statusAprovado(p.codigoStatus)
  const pendente = statusPendente(p.codigoStatus)

  // O texto oficial vem da tabela: descricaoStatus da API é inconsistente.
  const rotulo = p.codigoStatus != null
    ? STATUS_ANALISE[p.codigoStatus as keyof typeof STATUS_ANALISE] ?? p.descricaoStatus
    : p.descricaoStatus

  const cor = aprovado
    ? 'border-green-200 bg-green-50/50'
    : pendente ? 'border-amber-200 bg-amber-50/50'
    : 'border-red-200 bg-red-50/50'

  const Icone = aprovado ? CheckCircle2 : pendente ? Clock : XCircle
  const iconeCor = aprovado ? 'text-green-600' : pendente ? 'text-amber-600' : 'text-red-500'

  // Pré-aprovado (12) só fecha depois da biometria do inquilino.
  const precisaBiometria = p.linkBiometria && p.statusBiometria === 0

  const copiarLink = async () => {
    if (!p.linkBiometria) return
    try {
      await navigator.clipboard.writeText(p.linkBiometria)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {/* */}
  }

  return (
    <div className={`border rounded-2xl px-4 py-3 ${cor}`}>
      <div className="flex items-start gap-2.5">
        <Icone size={17} className={`${iconeCor} shrink-0 mt-0.5`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900">
              {p.seguradoraNome ?? p.seguradoraSigla.toUpperCase()}
            </p>
            <span className="text-xs text-gray-600">{rotulo}</span>
          </div>

          {/* Aprovação parcial: dá pra fechar renegociando o aluguel. */}
          {p.codigoStatus === 5 && p.limiteAprovado != null && (
            <p className="text-xs text-amber-800 mt-1 bg-amber-100/60 rounded px-2 py-1 inline-block">
              Limite aprovado: <strong>{formatarBRL(p.limiteAprovado)}</strong> — abaixo do solicitado.
            </p>
          )}
          {p.codigoStatus === 1 && p.limiteAprovado != null && (
            <p className="text-xs text-green-800 mt-1">
              Limite: <strong>{formatarBRL(p.limiteAprovado)}</strong>
            </p>
          )}

          {p.msg && <p className="text-xs text-gray-600 mt-1 italic">&ldquo;{p.msg}&rdquo;</p>}

          {p.statusBiometria != null && (
            <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
              <ScanFace size={11} />
              Biometria: {STATUS_BIOMETRIA[p.statusBiometria as keyof typeof STATUS_BIOMETRIA] ?? p.statusBiometria}
            </p>
          )}

          {precisaBiometria && (
            <div className="mt-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-[11px] font-semibold text-amber-900">
                Falta a biometria do inquilino pra aprovar
              </p>
              <p className="text-[10px] text-gray-500 mb-1.5">Envie este link pra ele:</p>
              <div className="flex gap-1.5">
                <a
                  href={p.linkBiometria ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-[11px] text-violet-700 underline truncate"
                >
                  {p.linkBiometria}
                </a>
                <button
                  type="button"
                  onClick={copiarLink}
                  className="text-gray-400 hover:text-violet-700 shrink-0"
                  aria-label="Copiar link da biometria"
                >
                  {copiado ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-400 mt-1.5">
            {p.codigoAnalise && <>nº {p.codigoAnalise} · </>}
            {new Date(p.atualizadoEm).toLocaleString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  )
}
