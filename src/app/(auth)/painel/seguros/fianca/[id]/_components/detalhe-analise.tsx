'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw, Loader2, AlertTriangle, FileText, Trash2, RotateCcw,
  ShieldCheck, Clock, CheckCircle2, XCircle, Users, ScanFace,
} from 'lucide-react'
import { statusAprovado, statusPendente, statusPreAprovado } from '@/lib/seguros/tabelas'
import { marcaDe } from '@/lib/seguros/marcas'
import { formatarBRL } from '@/lib/formatters'
import { sincronizarAnalise, reanalisar, excluirAnalise, incluirSolidarios } from '../../../actions'
import {
  CamposSolidarios, validarSolidarios, type SolidarioCampo,
} from '../../../_components/campos-solidarios'
import { CardSeguradora, type ParecerCard } from './card-seguradora'

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
  propostaNumero: string | null
  erro: string | null
}

interface Props {
  analiseId: string
  contratoId: string | null
  transmitida: boolean
  erro: string | null
  pareceres: ParecerCard[]
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

  const [solidarios, setSolidarios] = useState<SolidarioCampo[]>([])
  const [abrirSolidarios, setAbrirSolidarios] = useState(false)

  const aprovadas = pareceres.filter(p => statusAprovado(p.codigoStatus))
  const preAprovadas = pareceres.filter(p => statusPreAprovado(p.codigoStatus))
  // "Analisando" exclui as pré-aprovadas: elas não estão esperando a
  // seguradora, estão esperando o inquilino — e isso é ação do corretor.
  const pendentes = pareceres.filter(p => statusPendente(p.codigoStatus) && !statusPreAprovado(p.codigoStatus))
  const recusadas = pareceres.filter(p => p.codigoStatus === 3)
  const podeContratar = aprovadas.length > 0 && !contratacao

  // Limite inferior ou recusa geral: incluir solidário aumenta o limite —
  // é a saída que a própria seguradora sugere na mensagem de retorno.
  const temLimiteInferior = pareceres.some(p => p.codigoStatus === 5)
  const podeIncluirSolidario = !contratacao && transmitida
    && (temLimiteInferior || recusadas.length > 0)

  const enviarSolidarios = () => {
    setErroAcao(''); setMsg('')
    const sol = validarSolidarios(solidarios)
    if ('erro' in sol) { setErroAcao(sol.erro); return }
    if (!sol.solidarios.length) { setErroAcao('Inclua ao menos um solidário.'); return }

    startTransition(async () => {
      const r = await incluirSolidarios(analiseId, sol.solidarios)
      if (r.error) { setErroAcao(r.error); return }
      setMsg('Análise reenviada com os solidários.')
      setAbrirSolidarios(false)
      setSolidarios([])
      router.refresh()
    })
  }

  // Aprovadas primeiro: o corretor abre a tela pra saber com quem fecha.
  // Pré-aprovadas logo atrás — são as que dependem de uma ação dele.
  const ordenados = [...aprovadas, ...preAprovadas, ...pendentes, ...recusadas,
    ...pareceres.filter(p => !aprovadas.includes(p) && !preAprovadas.includes(p)
      && !pendentes.includes(p) && !recusadas.includes(p))]

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
      const r = await reanalisar(analiseId, recusadas.map(p => p.seguradoraSigla))
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
        <div className="rounded-2xl bg-rose-50 ring-1 ring-rose-200 px-4 py-3 text-sm text-rose-800 flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Falha ao transmitir</p>
            <p className="text-xs mt-0.5">{erro}</p>
          </div>
        </div>
      )}

      {/* Placar — a leitura de 1 segundo */}
      {pareceres.length > 0 && (
        <div className={`grid gap-2 ${preAprovadas.length > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <Placar n={aprovadas.length} rotulo="aprovaram" Icone={CheckCircle2}
            cls="bg-emerald-50 text-emerald-700 ring-emerald-100" />
          {preAprovadas.length > 0 && (
            <Placar n={preAprovadas.length} rotulo="pré-aprov." Icone={ScanFace}
              cls="bg-violet-50 text-violet-700 ring-violet-100" />
          )}
          <Placar n={pendentes.length} rotulo="analisando" Icone={Clock}
            cls="bg-amber-50 text-amber-700 ring-amber-100" />
          <Placar n={recusadas.length} rotulo="recusaram" Icone={XCircle}
            cls="bg-rose-50 text-rose-700 ring-rose-100" />
        </div>
      )}

      {/* A fila que depende do corretor, não da seguradora. */}
      {preAprovadas.length > 0 && (
        <p className="text-xs text-violet-900 bg-violet-50 ring-1 ring-violet-100 rounded-xl px-3 py-2.5 flex items-start gap-1.5">
          <ScanFace size={12} className="mt-0.5 shrink-0" />
          <span>
            {preAprovadas.length === 1
              ? 'Uma seguradora pré-aprovou'
              : `${preAprovadas.length} seguradoras pré-aprovaram`}
            {' '}— falta a biometria do pretendente. A contratação só libera
            quando o parecer virar aprovado.
          </span>
        </p>
      )}

      {contratacao && <CardContratacao c={contratacao} />}

      {transmitida && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={sincronizar}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 active:bg-black disabled:opacity-50 px-4 py-3 text-sm font-bold text-white"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Atualizar
          </button>
          {recusadas.length > 0 && !contratacao && (
            <button
              type="button"
              onClick={tentarDeNovo}
              disabled={isPending}
              className="flex items-center justify-center gap-1.5 rounded-xl ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 px-4 py-3 text-sm font-bold text-gray-700"
            >
              <RotateCcw size={14} /> Reanalisar
            </button>
          )}
        </div>
      )}

      {pendentes.length > 0 && (
        <p className="text-xs text-amber-800 bg-amber-50 ring-1 ring-amber-100 rounded-xl px-3 py-2.5 flex items-start gap-1.5">
          <Clock size={12} className="mt-0.5 shrink-0" />
          {pendentes.length === 1 ? 'Uma seguradora ainda está analisando' : `${pendentes.length} seguradoras ainda estão analisando`}.
          O resultado chega sozinho — ou toque em atualizar.
        </p>
      )}

      {/* Aumentar o limite incluindo quem compõe renda */}
      {podeIncluirSolidario && (
        abrirSolidarios ? (
          <section className="rounded-2xl bg-white ring-1 ring-violet-200 p-4 space-y-3">
            {temLimiteInferior && (
              <p className="text-[11px] text-violet-900 bg-violet-50 rounded-lg px-2.5 py-2 leading-snug">
                A seguradora aprovou abaixo do pedido. Incluir quem compõe renda
                costuma resolver — a análise é reenviada com os dados novos.
              </p>
            )}
            <CamposSolidarios
              valores={solidarios}
              onChange={setSolidarios}
              inputCls="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"
              disabled={isPending}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={enviarSolidarios}
                disabled={isPending || solidarios.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-violet-700 hover:bg-violet-800 disabled:opacity-50 px-4 py-3 text-sm font-bold text-white"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                Reenviar com solidários
              </button>
              <button
                type="button"
                onClick={() => { setAbrirSolidarios(false); setSolidarios([]) }}
                disabled={isPending}
                className="rounded-xl ring-1 ring-gray-200 px-4 py-3 text-sm font-bold text-gray-600"
              >
                Cancelar
              </button>
            </div>
          </section>
        ) : (
          <button
            type="button"
            onClick={() => { setAbrirSolidarios(true); setSolidarios([{ nome: '', cpf: '', dataNascimento: '' }]) }}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl ring-1 ring-violet-200 bg-violet-50 hover:bg-violet-100 px-4 py-3 text-sm font-bold text-violet-800"
          >
            <Users size={15} />
            {temLimiteInferior ? 'Aumentar limite com solidário' : 'Incluir locatário solidário'}
          </button>
        )
      )}

      {msg && <p className="text-xs text-emerald-800 bg-emerald-50 ring-1 ring-emerald-100 rounded-xl px-3 py-2.5">{msg}</p>}
      {erroAcao && <p className="text-xs text-rose-800 bg-rose-50 ring-1 ring-rose-100 rounded-xl px-3 py-2.5">{erroAcao}</p>}

      {/* Um card por seguradora */}
      <section className="space-y-2.5">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-0.5">
          Seguradoras ({pareceres.length})
        </h2>
        {pareceres.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white ring-1 ring-gray-100 rounded-2xl p-8 text-center">
            Nenhum parecer ainda.
          </p>
        ) : (
          ordenados.map(p => (
            <CardSeguradora key={p.id} p={p} podeContratar={podeContratar} />
          ))
        )}
      </section>

      {arquivos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-0.5">
            Documentos
          </h2>
          <div className="bg-white ring-1 ring-gray-100 rounded-2xl divide-y divide-gray-50 overflow-hidden">
            {arquivos.map(a => {
              const marca = marcaDe(a.seguradoraSigla)
              return (
                <a
                  key={a.id}
                  href={a.url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2.5 px-4 py-3.5 active:bg-gray-50 ${!a.url ? 'pointer-events-none opacity-40' : ''}`}
                >
                  <span
                    className="shrink-0 w-8 h-8 rounded-lg grid place-items-center"
                    style={{ backgroundColor: marca.corFundo }}
                  >
                    <FileText size={14} style={{ color: marca.cor }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 truncate">
                      {a.descricao ?? `Documento ${a.codigoTipo}`}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {a.seguradoraSigla?.toUpperCase()} · {new Date(a.recebidoEm).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </a>
              )
            })}
          </div>
        </section>
      )}

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={excluir}
          disabled={isPending}
          className="flex items-center gap-1.5 text-sm text-rose-600 active:text-rose-700 px-3 py-2 rounded-lg"
        >
          <Trash2 size={14} /> Excluir cotação
        </button>
      </div>
    </div>
  )
}

function Placar({ n, rotulo, Icone, cls }: {
  n: number
  rotulo: string
  Icone: React.ComponentType<{ size?: number; className?: string }>
  cls: string
}) {
  return (
    <div className={`rounded-2xl ring-1 px-2 py-2.5 text-center ${cls} ${n === 0 ? 'opacity-40' : ''}`}>
      <Icone size={14} className="mx-auto mb-0.5" />
      <p className="text-xl font-black leading-none tabular-nums">{n}</p>
      <p className="text-[10px] font-semibold mt-0.5">{rotulo}</p>
    </div>
  )
}

function CardContratacao({ c }: { c: ContratacaoView }) {
  const marca = marcaDe(c.seguradoraSigla)
  const emitida = c.status === 'emitida'
  const falhou = c.status === 'erro'

  if (falhou) {
    return (
      <section className="rounded-2xl bg-rose-50 ring-1 ring-rose-200 px-4 py-3">
        <p className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
          <AlertTriangle size={15} /> Falha na contratação
        </p>
        <p className="text-xs text-rose-800 mt-1">{c.erro}</p>
      </section>
    )
  }

  return (
    <section
      className="relative overflow-hidden rounded-2xl px-4 py-4 text-white"
      style={{ backgroundColor: marca.cor }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">
            {emitida ? 'Seguro contratado' : 'Contratação enviada'}
          </p>
          <p className="text-lg font-black leading-tight">
            {c.seguradoraSigla.toUpperCase()}
          </p>
        </div>
        <ShieldCheck size={22} className="opacity-90 shrink-0" />
      </div>

      {c.premioTotal != null && (
        <p className="text-2xl font-black tabular-nums mt-2">{formatarBRL(c.premioTotal)}</p>
      )}
      {c.qtdParcelas && c.valorParcela != null && (
        <p className="text-sm opacity-90">
          {c.formaPagto} · {c.qtdParcelas}× {formatarBRL(c.valorParcela)}
        </p>
      )}

      {c.inicioVigencia && c.fimVigencia && (
        <p className="text-[11px] opacity-75 mt-1.5 tabular-nums">
          vigência {new Date(c.inicioVigencia + 'T00:00:00').toLocaleDateString('pt-BR')}
          {' → '}{new Date(c.fimVigencia + 'T00:00:00').toLocaleDateString('pt-BR')}
        </p>
      )}

      <div className="mt-3 pt-3 border-t border-white/20 space-y-0.5">
        {c.propostaNumero && (
          <p className="text-xs opacity-90 tabular-nums">Proposta {c.propostaNumero}</p>
        )}
        {c.apoliceNumero ? (
          <p className="text-sm font-bold tabular-nums">Apólice {c.apoliceNumero}</p>
        ) : (
          <p className="text-[11px] opacity-80 leading-snug">
            Aguardando a seguradora emitir. O número da apólice aparece aqui
            assim que chegar — e desce sozinho pro contrato.
          </p>
        )}
      </div>
    </section>
  )
}
