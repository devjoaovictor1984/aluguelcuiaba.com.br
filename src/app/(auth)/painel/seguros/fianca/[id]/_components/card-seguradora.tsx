'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, XCircle, Clock, ScanFace, Copy, Check, Loader2,
  Tag, RefreshCw, ArrowRight, AlertTriangle,
} from 'lucide-react'
import {
  STATUS_ANALISE, STATUS_BIOMETRIA,
  statusAprovado, statusPendente, statusPreAprovado, statusTerminalNegativo,
} from '@/lib/seguros/tabelas'
import { marcaDe } from '@/lib/seguros/marcas'
import { resumirPrecos } from '@/lib/seguros/resumo-precos'
import type { PlanosPreco } from '@/lib/seguros/tipos'
import { formatarBRL } from '@/lib/formatters'
import { buscarPrecosDoParecer } from '../../../actions-contratacao'

export interface ParecerCard {
  id: string
  analiseId: string
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
  precos: PlanosPreco | null
  precosEm: string | null
  precosErro: string | null
}

interface Props {
  p: ParecerCard
  podeContratar: boolean
}

/**
 * Card de uma seguradora — a unidade de leitura da análise.
 *
 * Duas cores convivem aqui, e é proposital:
 *  · a BANDEIRA lateral é a cor da marca, pra reconhecer a seguradora
 *    antes de ler o nome;
 *  · o selo de situação usa cor semântica (verde/âmbar/vermelho).
 * Se a marca definisse o status, "Tokio" pareceria aprovada só por ser
 * verde.
 *
 * Desenhado pro celular primeiro: uma coluna, alvo de toque grande, e o
 * que decide (situação, limite, preço) acima da dobra.
 */
export function CardSeguradora({ p, podeContratar }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [copiado, setCopiado] = useState(false)

  const marca = marcaDe(p.seguradoraSigla)
  const aprovado = statusAprovado(p.codigoStatus)
  const preAprovado = statusPreAprovado(p.codigoStatus)
  const pendente = statusPendente(p.codigoStatus)
  const limiteInferior = p.codigoStatus === 5

  const rotulo = p.codigoStatus != null
    ? STATUS_ANALISE[p.codigoStatus as keyof typeof STATUS_ANALISE] ?? p.descricaoStatus
    : p.descricaoStatus ?? '—'

  // Pré-aprovado é seu próprio selo. Passa por "Aguardando" e o corretor
  // lê como fila normal; passa por verde e ele promete uma aprovação que
  // a biometria ainda pode derrubar.
  const situacao = aprovado
    ? { Icone: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
    : preAprovado
      ? { Icone: ScanFace, cls: 'bg-violet-50 text-violet-700 ring-violet-200' }
      : pendente
        ? { Icone: Clock, cls: 'bg-amber-50 text-amber-700 ring-amber-200' }
        : { Icone: XCircle, cls: 'bg-rose-50 text-rose-700 ring-rose-200' }

  const selo = aprovado
    ? (limiteInferior ? 'Parcial' : 'Aprovado')
    : preAprovado ? 'Pré-aprovado' : pendente ? 'Aguardando' : 'Recusado'

  // A Porto devolve `statusBiometria: 0` ("Aguardando") mesmo quando
  // RECUSA a análise — verificado ao vivo em 16/08/2026. Sem esta guarda o
  // card recusado pedia reconhecimento facial e dizia que "a aprovação só
  // fecha depois", mandando o corretor atrás do inquilino por uma análise
  // que já acabou. Em parecer terminal negativo a biometria não existe
  // mais como assunto.
  const terminalNegativo = statusTerminalNegativo(p.codigoStatus)

  // O link nem sempre chega junto com o status: o webhook de biometria vem
  // separado. Sem link, ainda assim avisamos que a biometria é o que falta.
  const precisaBiometria = !terminalNegativo
    && (p.statusBiometria === 0 || (preAprovado && p.statusBiometria == null))
  const resumo = resumirPrecos(p.precos)

  const copiarLink = async () => {
    if (!p.linkBiometria) return
    try {
      await navigator.clipboard.writeText(p.linkBiometria)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {/* */}
  }

  const buscarPrecos = () => {
    startTransition(async () => {
      await buscarPrecosDoParecer(p.analiseId, p.seguradoraSigla)
      router.refresh()
    })
  }

  return (
    <article className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm">
      {/* Bandeira da marca */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{ backgroundColor: marca.cor }}
      />

      <div className="pl-4 pr-3.5 py-3.5 space-y-3">
        {/* Cabeçalho: marca + situação */}
        <header className="flex items-start gap-2.5">
          <span
            className="shrink-0 w-10 h-10 rounded-xl grid place-items-center text-xs font-black tracking-tight"
            style={{ backgroundColor: marca.corFundo, color: marca.cor }}
          >
            {marca.curto}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-gray-900 leading-tight truncate">
              {p.seguradoraNome ?? marca.nome}
            </p>
            {p.codigoAnalise && (
              <p className="text-[11px] text-gray-400 tabular-nums truncate">
                nº {p.codigoAnalise}
              </p>
            )}
          </div>

          <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${situacao.cls}`}>
            <situacao.Icone size={11} />
            {selo}
          </span>
        </header>

        <p className="text-xs text-gray-600 leading-snug">{rotulo}</p>

        {/* A regra que a corretora pediu para ficar explícita: pré-aprovado
            NÃO é aprovado, e daqui ainda dá pra voltar pra recusa. */}
        {preAprovado && (
          <div className="rounded-xl bg-violet-50 ring-1 ring-violet-100 px-3 py-2.5">
            <p className="text-[11px] font-bold text-violet-900 flex items-center gap-1.5">
              <AlertTriangle size={11} className="shrink-0" />
              Ainda não dá pra contratar
            </p>
            <p className="text-[11px] text-violet-900 leading-snug mt-1">
              A parte financeira passou, mas a identidade do pretendente não
              foi conferida. A contratação só abre quando a biometria concluir
              e o parecer virar <strong>Aprovado</strong> — e ela pode voltar
              para recusado se a biometria não bater.
            </p>
          </div>
        )}

        {/* Limite — o número que decide se dá pra fechar */}
        {p.limiteAprovado != null && (
          <div className={`rounded-xl px-3 py-2.5 ${limiteInferior ? 'bg-amber-50 ring-1 ring-amber-100' : 'bg-gray-50'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Limite aprovado
            </p>
            <p className={`text-xl font-black tabular-nums ${limiteInferior ? 'text-amber-800' : 'text-gray-900'}`}>
              {formatarBRL(p.limiteAprovado)}
            </p>
            {limiteInferior && (
              <p className="text-[11px] text-amber-800 leading-snug mt-0.5">
                Abaixo do solicitado — dá pra fechar renegociando o aluguel ou
                incluindo um locatário solidário.
              </p>
            )}
          </div>
        )}

        {p.msg && (
          <p className="text-[11px] text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-snug">
            {p.msg}
          </p>
        )}

        {/* Biometria — some por inteiro quando o parecer já é terminal. */}
        {!terminalNegativo && (p.statusBiometria != null || preAprovado) && (
          <div className={`rounded-xl px-3 py-2.5 ${precisaBiometria ? 'bg-violet-50 ring-1 ring-violet-100' : 'bg-gray-50'}`}>
            <p className="text-[11px] font-semibold text-gray-700 flex items-center gap-1.5">
              <ScanFace size={12} className={precisaBiometria ? 'text-violet-600' : 'text-gray-400'} />
              Biometria: {p.statusBiometria != null
                ? STATUS_BIOMETRIA[p.statusBiometria as keyof typeof STATUS_BIOMETRIA] ?? p.statusBiometria
                : 'Aguardando'}
            </p>
            {precisaBiometria && (
              <>
                <p className="text-[11px] text-violet-900 mt-1 leading-snug">
                  A aprovação só fecha depois que o inquilino fizer o
                  reconhecimento facial.{' '}
                  {p.linkBiometria
                    ? 'Mande o link pra ele:'
                    : 'O link chega da corretora em instantes — toque em atualizar se demorar.'}
                </p>
                {p.linkBiometria && (
                  <button
                    type="button"
                    onClick={copiarLink}
                    className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-lg bg-violet-700 hover:bg-violet-800 active:bg-violet-900 px-3 py-2.5 text-xs font-bold text-white"
                  >
                    {copiado ? <Check size={13} /> : <Copy size={13} />}
                    {copiado ? 'Link copiado' : 'Copiar link da biometria'}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Preços — só faz sentido em quem aprovou */}
        {aprovado && (
          <div className="rounded-xl bg-gray-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                <Tag size={10} /> {resumo ? `Plano ${resumo.plano}` : 'Preço'}
              </p>
              {p.precosEm && (
                <button
                  type="button"
                  onClick={buscarPrecos}
                  disabled={isPending}
                  className="text-[10px] text-gray-400 hover:text-violet-700 flex items-center gap-1 disabled:opacity-50"
                >
                  {isPending ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}
                  atualizar
                </button>
              )}
            </div>

            {resumo ? (
              <div className="mt-1.5 space-y-1">
                {resumo.parcelado && (
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-gray-600 truncate">
                      {resumo.parcelado.qtdParcelas}× {resumo.parcelado.formaPagamento.toLowerCase()}
                    </span>
                    <span className="text-lg font-black text-gray-900 tabular-nums shrink-0">
                      {formatarBRL(resumo.parcelado.valorParcela)}
                    </span>
                  </div>
                )}
                {resumo.aVista && (
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-gray-600">à vista</span>
                    <span className="text-sm font-bold text-gray-700 tabular-nums shrink-0">
                      {formatarBRL(resumo.aVista.valorParcela)}
                    </span>
                  </div>
                )}
                <p className="text-[10px] text-gray-400 pt-0.5">
                  Referência com os encargos da análise. O valor final sai na
                  contratação.
                </p>
              </div>
            ) : p.precosErro ? (
              <p className="mt-1 text-[11px] text-rose-700 flex items-start gap-1.5">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                {p.precosErro}
              </p>
            ) : (
              <button
                type="button"
                onClick={buscarPrecos}
                disabled={isPending}
                className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-lg bg-white ring-1 ring-gray-200 hover:ring-violet-300 px-3 py-2.5 text-xs font-bold text-gray-700 disabled:opacity-50"
              >
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Tag size={13} />}
                {isPending ? 'Consultando…' : 'Ver preços'}
              </button>
            )}
          </div>
        )}

        {aprovado && podeContratar && (
          <Link
            href={`/painel/seguros/fianca/${p.analiseId}/contratar?seguradora=${p.seguradoraSigla}`}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-sm font-bold text-white active:brightness-95"
            style={{ backgroundColor: marca.cor }}
          >
            Contratar nesta <ArrowRight size={15} />
          </Link>
        )}

        <p className="text-[10px] text-gray-400 tabular-nums">
          atualizado {new Date(p.atualizadoEm).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>
    </article>
  )
}
