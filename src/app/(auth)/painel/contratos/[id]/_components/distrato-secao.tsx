'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  FileX2, Plus, Trash2, Loader2, X, FileText, Download, Pencil, Users, PenLine,
  CheckCircle2, Clock, GripVertical, AlertTriangle,
} from 'lucide-react'
import { PainelAssinatura } from '@/app/(auth)/painel/contratos/_components/painel-assinatura'
import type { ProcessoPainel } from '@/lib/crm/assinatura-painel'
import { normalizarClausulas, mesmasClausulas, type ClausulaAditivo } from '@/lib/crm/aditivo-clausulas'
import {
  clausulasPadraoDistrato, FECHAMENTO_PADRAO_DISTRATO, MOTIVO_DISTRATO, MODELO_OBJETO,
  type MotivoDistrato,
} from '@/lib/crm/distrato-clausulas'
import { criarDistrato, atualizarDistrato, excluirDistrato } from '../actions-distrato'
import type { SugestaoSignatario } from '@/components/crm/termos-aditivos-secao'

/**
 * Distrato do contrato (v98). Um por contrato — o contrato se dissolve uma
 * vez —, então a seção mostra ou o convite pra criar, ou o documento.
 *
 * O texto segue o molde do termo aditivo (cláusula 1ª livre, demais
 * editáveis e arrastáveis). O que é próprio daqui é o acerto de contas:
 * multa, débitos e caução viram a cláusula 2ª do PDF, com quadro de
 * conferência. São os números que as partes leem antes de assinar.
 */

export interface DistratoRow {
  id: string
  data_distrato: string
  data_desocupacao: string | null
  motivo: string
  titulo: string | null
  objeto: string
  multa_valor: number | string | null
  multa_dispensada: boolean
  debitos_valor: number | string | null
  caucao_devolver: number | string | null
  acerto_observacao: string | null
  quitacao_reciproca: boolean
  testemunha_ids: string[] | null
  contrato_originario_ref: string | null
  clausulas: ClausulaAditivo[] | null
  fechamento: string | null
}

export interface PessoaTestemunha {
  id: string
  nome: string
  tipo: string
  cpf_cnpj: string | null
}

interface Props {
  contratoId: string
  codigoContrato: string
  /** Como citar o contrato originário quando o campo fica em branco. */
  originarioPadrao: string | null
  /** Cidade do foro no texto padrão, formato "Cuiabá-MT". */
  cidadeUf: string
  distrato: DistratoRow | null
  pessoas: PessoaTestemunha[]
  /** Status do contrato: ativo ainda pede o encerramento depois de assinar. */
  statusContrato: string
  caucaoValor: number
  assinatura: {
    baseUrl: string
    processos: ProcessoPainel[]
    sugestoes: SugestaoSignatario[]
  }
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"

const PDF_BASE = '/api/contratos/distratos'

type ClausulaEdit = ClausulaAditivo & { uid: string }

let seqUid = 0
const comUid = (lista: ClausulaAditivo[]): ClausulaEdit[] =>
  lista.map(c => ({ ...c, uid: `dc${++seqUid}` }))
const semUid = (lista: ClausulaEdit[]): ClausulaAditivo[] =>
  lista.map(({ titulo, texto }) => ({ titulo, texto }))

function fmtData(d: string | null): string {
  if (!d) return '—'
  const [y, m, dd] = d.slice(0, 10).split('-')
  return `${dd}/${m}/${y}`
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtCpf(s: string | null): string {
  if (!s) return 'sem CPF'
  const d = s.replace(/\D/g, '')
  if (d.length === 11) return `CPF ${d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')}`
  if (d.length === 14) return `CNPJ ${d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}`
  return s
}

/** Mesma regra de situacaoAssinaturaDocumento (servidor), dos processos já carregados. */
function situacaoDe(processos: ProcessoPainel[]): 'concluido' | 'enviado' | null {
  const ativos = processos.filter(p => p.status !== 'cancelado')
  if (ativos.some(p => p.status === 'concluido')) return 'concluido'
  return ativos.length > 0 ? 'enviado' : null
}

const hoje = () => new Date().toISOString().slice(0, 10)
const num = (v: number | string | null): number => (v === null ? 0 : Number(v))
/** Campo de dinheiro: aceita "1.234,56" e "1234.56". */
const paraNumero = (s: string): number | null => {
  const limpo = s.trim().replace(/\./g, '').replace(',', '.')
  if (!limpo) return null
  const n = Number(limpo)
  return isFinite(n) && n > 0 ? n : null
}

export function DistratoSecao({
  contratoId, codigoContrato, originarioPadrao, cidadeUf, distrato, pessoas,
  statusContrato, caucaoValor, assinatura,
}: Props) {
  const router = useRouter()
  const [modalAberto, setModalAberto] = useState(false)
  const [assinando, setAssinando] = useState(false)
  const [erroLista, setErroLista] = useState('')
  const [isPendingLista, startListaTransition] = useTransition()

  const situacao = situacaoDe(assinatura.processos)
  const motivoTrava = situacao === 'concluido'
    ? 'Já assinado por todas as partes — para corrigir, cancele o distrato e faça um novo'
    : situacao === 'enviado'
      ? 'Em assinatura — cancele o envio no painel de assinatura para editar'
      : null

  const nomePorId = useMemo(() => new Map(pessoas.map(p => [p.id, p.nome])), [pessoas])
  const testemunhas = (distrato?.testemunha_ids ?? []).map(id => nomePorId.get(id)).filter(Boolean)

  const remover = () => {
    if (!distrato) return
    if (!confirm('Excluir este distrato? O documento é apagado e o contrato fica sem distrato.')) return
    setErroLista('')
    startListaTransition(async () => {
      const r = await excluirDistrato(distrato.id, contratoId)
      if (r.error) { setErroLista(r.error); return }
      router.refresh()
    })
  }

  const contratoVivo = statusContrato === 'ativo' || statusContrato === 'inadimplente'

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <FileX2 size={14} className="text-violet-600" />
          Distrato
          {situacao === 'concluido' && (
            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
              <CheckCircle2 size={10} /> Assinado
            </span>
          )}
          {situacao === 'enviado' && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
              <Clock size={10} /> Em assinatura
            </span>
          )}
        </h2>
        {!distrato && (
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-800 border border-violet-200 hover:bg-violet-50 px-2.5 py-1 rounded-lg transition-colors"
          >
            <Plus size={12} /> Gerar distrato
          </button>
        )}
      </div>

      {erroLista && <p className="text-xs text-rose-600 mb-2">{erroLista}</p>}

      {!distrato ? (
        <p className="text-xs text-gray-400">
          Documento que encerra a locação de comum acordo: registra a data da desocupação, se a multa foi
          cobrada ou dispensada, o que resta a pagar ou devolver, e a quitação recíproca entre as partes.
          Gera um PDF próprio, assinável pela plataforma.
        </p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                {distrato.titulo?.trim() || MOTIVO_DISTRATO[distrato.motivo as MotivoDistrato] || 'Distrato'}
                <span className="text-[11px] font-normal text-gray-400">· {fmtData(distrato.data_distrato)}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2 whitespace-pre-wrap">{distrato.objeto}</p>

              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2 text-[11px]">
                <span className="text-gray-500">
                  Desocupação: <strong className="text-gray-700">{fmtData(distrato.data_desocupacao)}</strong>
                </span>
                <span className="text-gray-500">
                  Multa:{' '}
                  <strong className={distrato.multa_dispensada ? 'text-green-700' : 'text-gray-700'}>
                    {distrato.multa_dispensada ? 'dispensada' : num(distrato.multa_valor) > 0 ? fmtBRL(num(distrato.multa_valor)) : '—'}
                  </strong>
                </span>
                {num(distrato.debitos_valor) > 0 && (
                  <span className="text-gray-500">
                    Débitos: <strong className="text-rose-600">{fmtBRL(num(distrato.debitos_valor))}</strong>
                  </span>
                )}
                {num(distrato.caucao_devolver) > 0 && (
                  <span className="text-gray-500">
                    Caução a devolver: <strong className="text-gray-700">{fmtBRL(num(distrato.caucao_devolver))}</strong>
                  </span>
                )}
                {!distrato.quitacao_reciproca && (
                  <span className="text-amber-600 font-semibold flex items-center gap-1">
                    <AlertTriangle size={11} /> sem quitação recíproca
                  </span>
                )}
              </div>

              <p className={`text-[11px] mt-1.5 flex items-center gap-1 ${testemunhas.length ? 'text-gray-500' : 'text-amber-600'}`}>
                <Users size={11} />
                {testemunhas.length ? `Testemunhas: ${testemunhas.join(', ')}` : 'Sem testemunhas — o PDF sai com as linhas em branco'}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => setAssinando(v => !v)}
                className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg ${
                  assinando ? 'bg-violet-100 text-violet-800' : 'text-violet-700 hover:bg-violet-50'
                }`}
                title="Assinatura eletrônica: selfie, código por e-mail e assinatura desenhada"
              >
                <PenLine size={13} /> Assinatura
              </button>
              <button
                type="button"
                onClick={() => setModalAberto(true)}
                disabled={isPendingLista || !!motivoTrava}
                className="flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-100 px-2 py-1.5 rounded-lg disabled:opacity-40 disabled:hover:bg-transparent"
                title={motivoTrava ?? 'Editar texto, valores e testemunhas'}
              >
                <Pencil size={13} /> Editar
              </button>
              <a
                href={`${PDF_BASE}/${distrato.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-violet-700 hover:bg-violet-50 px-2 py-1.5 rounded-lg"
                title="Abrir PDF do distrato"
              >
                <FileText size={13} /> PDF
              </a>
              <button
                type="button"
                onClick={remover}
                disabled={isPendingLista || !!motivoTrava}
                className="text-gray-300 hover:text-rose-600 p-1.5 disabled:opacity-40 disabled:hover:text-gray-300"
                title={motivoTrava ?? 'Excluir distrato'}
              >
                {isPendingLista ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </div>
          </div>

          {/* O documento não mexe no financeiro — quem baixa parcela e libera
              o imóvel é o "Encerrar contrato". Sem este aviso, o corretor
              assina o distrato e acha que o sistema já sabe. */}
          {situacao === 'concluido' && contratoVivo && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
              Distrato assinado, mas o contrato ainda está <strong>{statusContrato}</strong> no sistema. Use
              <strong> Encerrar contrato</strong> pra baixar as parcelas futuras e liberar o imóvel.
            </p>
          )}

          {assinando && (
            <div className="mt-3">
              {!situacao && testemunhas.length === 0 && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-2">
                  Este distrato está sem testemunhas. Escolha em <strong>Editar</strong> antes de enviar — depois
                  de enviado, não dá mais pra mudar.
                </p>
              )}
              <PainelAssinatura
                tipoContrato="distrato_locacao"
                contratoId={distrato.id}
                titulo={`${codigoContrato} · Distrato`}
                baseUrl={assinatura.baseUrl}
                sugestoes={assinatura.sugestoes}
                processos={assinatura.processos}
              />
            </div>
          )}
        </>
      )}

      {modalAberto && (
        <ModalDistrato
          contratoId={contratoId}
          distrato={distrato}
          pessoas={pessoas}
          cidadeUf={cidadeUf}
          originarioPadrao={originarioPadrao}
          caucaoValor={caucaoValor}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </section>
  )
}

// ── Modal de criação / edição ──
function ModalDistrato({
  contratoId, distrato, pessoas, cidadeUf, originarioPadrao, caucaoValor, onFechar,
}: {
  contratoId: string
  distrato: DistratoRow | null
  pessoas: PessoaTestemunha[]
  cidadeUf: string
  originarioPadrao: string | null
  caucaoValor: number
  onFechar: () => void
}) {
  const router = useRouter()
  const clausulasPadrao = useMemo(() => clausulasPadraoDistrato(cidadeUf), [cidadeUf])

  const [motivo, setMotivo] = useState<MotivoDistrato>((distrato?.motivo as MotivoDistrato) ?? 'acordo')
  const [titulo, setTitulo] = useState(distrato?.titulo ?? '')
  const [dataDistrato, setDataDistrato] = useState(distrato?.data_distrato?.slice(0, 10) ?? hoje())
  const [dataDesocupacao, setDataDesocupacao] = useState(distrato?.data_desocupacao?.slice(0, 10) ?? '')
  const [objeto, setObjeto] = useState(distrato?.objeto ?? MODELO_OBJETO.acordo)

  const [multaDispensada, setMultaDispensada] = useState(distrato?.multa_dispensada ?? false)
  const [multa, setMulta] = useState(num(distrato?.multa_valor ?? null) > 0 ? String(num(distrato!.multa_valor)) : '')
  const [debitos, setDebitos] = useState(num(distrato?.debitos_valor ?? null) > 0 ? String(num(distrato!.debitos_valor)) : '')
  const [caucao, setCaucao] = useState(num(distrato?.caucao_devolver ?? null) > 0 ? String(num(distrato!.caucao_devolver)) : '')
  const [acertoObs, setAcertoObs] = useState(distrato?.acerto_observacao ?? '')
  const [quitacao, setQuitacao] = useState(distrato?.quitacao_reciproca ?? true)

  const [testemunhaIds, setTestemunhaIds] = useState<string[]>(distrato?.testemunha_ids ?? [])
  const [originario, setOriginario] = useState(distrato?.contrato_originario_ref ?? '')
  const [clausulas, setClausulas] = useState<ClausulaEdit[]>(
    comUid(distrato?.clausulas?.length ? distrato.clausulas : clausulasPadrao),
  )
  const [fechamento, setFechamento] = useState(distrato?.fechamento?.trim() || FECHAMENTO_PADRAO_DISTRATO)
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const pessoasOrdenadas = useMemo(() => [...pessoas].sort((a, b) => {
    if (a.tipo === 'testemunha' && b.tipo !== 'testemunha') return -1
    if (b.tipo === 'testemunha' && a.tipo !== 'testemunha') return 1
    return a.nome.localeCompare(b.nome)
  }), [pessoas])

  const escolherMotivo = (m: MotivoDistrato) => {
    setMotivo(m)
    // Só preenche o modelo se o campo ainda estiver vazio — não sobrescreve
    // texto que já foi escrito ou editado.
    if (!objeto.trim()) setObjeto(MODELO_OBJETO[m])
  }

  const toggleTestemunha = (id: string) => {
    setErro('')
    if (testemunhaIds.includes(id)) {
      setTestemunhaIds(testemunhaIds.filter(x => x !== id))
    } else if (testemunhaIds.length >= 2) {
      setErro('Máximo 2 testemunhas. Desmarque uma antes.')
    } else {
      setTestemunhaIds([...testemunhaIds, id])
    }
  }

  const setClausula = (uid: string, campo: keyof ClausulaAditivo, v: string) =>
    setClausulas(prev => prev.map(c => (c.uid === uid ? { ...c, [campo]: v } : c)))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const aoArrastar = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setClausulas(prev => {
      const de = prev.findIndex(c => c.uid === active.id)
      const para = prev.findIndex(c => c.uid === over.id)
      return de < 0 || para < 0 ? prev : arrayMove(prev, de, para)
    })
  }

  const salvar = () => {
    setErro('')
    if (!objeto.trim()) { setErro('Descreva o que está sendo distratado.'); return }

    const clausulasLimpas = normalizarClausulas(semUid(clausulas))
    const fechamentoLimpo = fechamento.trim()
    const input = {
      contrato_id: contratoId,
      data_distrato: dataDistrato,
      data_desocupacao: dataDesocupacao || null,
      motivo,
      titulo,
      objeto,
      multa_valor: paraNumero(multa),
      multa_dispensada: multaDispensada,
      debitos_valor: paraNumero(debitos),
      caucao_devolver: paraNumero(caucao),
      acerto_observacao: acertoObs,
      quitacao_reciproca: quitacao,
      testemunha_ids: testemunhaIds,
      contrato_originario_ref: originario,
      // Igual ao padrão grava null: o distrato segue acompanhando o texto
      // padrão (e o foro da imobiliária) em vez de congelar uma cópia.
      clausulas: mesmasClausulas(clausulasLimpas, clausulasPadrao) ? null : clausulasLimpas,
      fechamento: !fechamentoLimpo || fechamentoLimpo === FECHAMENTO_PADRAO_DISTRATO ? null : fechamentoLimpo,
    }

    startTransition(async () => {
      const r = distrato ? await atualizarDistrato(distrato.id, input) : await criarDistrato(input)
      if (r.error) { setErro(r.error); return }
      onFechar()
      router.refresh()
      if (r.id) window.open(`${PDF_BASE}/${r.id}/pdf`, '_blank')
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isPending && onFechar()}>
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileX2 size={16} className="text-violet-600" />
            {distrato ? 'Editar distrato' : 'Distrato do contrato'}
          </h2>
          <button type="button" onClick={onFechar} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mb-3">
          Encerra a locação de comum acordo e gera um PDF assinável. Não mexe nas parcelas nem no status do
          contrato — isso continua sendo o <strong>Encerrar contrato</strong>.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Motivo</label>
            <select value={motivo} onChange={e => escolherMotivo(e.target.value as MotivoDistrato)} className={inputCls}>
              {Object.entries(MOTIVO_DISTRATO).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Título (opcional)</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Saída antecipada 2026" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data do distrato</label>
            <input type="date" value={dataDistrato} onChange={e => setDataDistrato(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data da desocupação</label>
            <input type="date" value={dataDesocupacao} onChange={e => setDataDesocupacao(e.target.value)} className={inputCls} />
            <p className="text-[10px] text-gray-400 mt-1">Quando as chaves voltam. É a data em que cessam aluguéis e encargos.</p>
          </div>
        </div>

        {/* Contrato originário — mesma regra do aditivo */}
        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Contrato originário</label>
          <input
            value={originario}
            onChange={e => setOriginario(e.target.value)}
            placeholder={originarioPadrao ?? 'Ex: nº 045/2023, firmado em 10/01/2023'}
            className={inputCls}
          />
          <p className="text-[10px] text-gray-400 mt-1">
            {originarioPadrao
              ? <>Em branco, sai <strong>&ldquo;{originarioPadrao}&rdquo;</strong> — o contrato foi assinado pela plataforma.</>
              : <>Este contrato não foi assinado pela plataforma. Em branco, o distrato cita só <strong>&ldquo;o contrato celebrado entre as partes&rdquo;</strong>.</>}
          </p>
        </div>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Cláusula 1ª — Da rescisão *</label>
        <textarea
          value={objeto}
          onChange={e => setObjeto(e.target.value)}
          rows={8}
          placeholder="Descreva o encerramento. Use uma linha em branco entre parágrafos — cada um vira um item numerado (1.1, 1.2…) no PDF."
          className={`${inputCls} resize-y leading-relaxed`}
        />
        <p className="text-[10px] text-gray-400 mt-1">
          Linha em branco entre parágrafos numera cada item. Preâmbulo com as partes e assinaturas o PDF monta sozinho.
        </p>

        {/* ── Acerto de contas → cláusula 2ª do PDF ── */}
        <div className="mt-4 border border-gray-100 rounded-xl p-3">
          <label className="text-xs font-semibold text-gray-600">Acerto de contas</label>
          <p className="text-[10px] text-gray-400 mb-2">
            Vira a cláusula 2ª, com quadro de conferência. Campo vazio não é impresso.
          </p>

          <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={multaDispensada}
              onChange={e => setMultaDispensada(e.target.checked)}
              className="accent-violet-600 shrink-0"
            />
            <span className="text-xs text-gray-700">
              <strong>Dispensar a multa</strong> por saída antecipada
              <span className="block text-[10px] text-gray-400">
                Perdão de multa precisa estar escrito — combinado só de boca volta como cobrança depois.
              </span>
            </span>
          </label>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Multa {multaDispensada && <span className="font-normal text-gray-400">(dispensada)</span>}
              </label>
              <input
                value={multa}
                onChange={e => setMulta(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className={inputCls}
              />
              {multaDispensada && (
                <p className="text-[10px] text-gray-400 mt-1">Se preencher, o PDF diz o valor que está sendo perdoado.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Débitos em aberto</label>
              <input value={debitos} onChange={e => setDebitos(e.target.value)} inputMode="decimal" placeholder="0,00" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Caução a devolver</label>
              <input value={caucao} onChange={e => setCaucao(e.target.value)} inputMode="decimal" placeholder="0,00" className={inputCls} />
              {caucaoValor > 0 && (
                <p className="text-[10px] text-gray-400 mt-1">Caução do contrato: {fmtBRL(caucaoValor)}</p>
              )}
            </div>
          </div>

          <label className="block text-xs font-semibold text-gray-600 mt-3 mb-1">Observação do acerto</label>
          <textarea
            value={acertoObs}
            onChange={e => setAcertoObs(e.target.value)}
            rows={2}
            placeholder="Ex: o débito será pago em 3 parcelas de R$ ___, vencendo a primeira em ___."
            className={`${inputCls} resize-y leading-relaxed`}
          />

          <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={quitacao}
              onChange={e => setQuitacao(e.target.checked)}
              className="accent-violet-600 shrink-0"
            />
            <span className="text-xs text-gray-700">
              <strong>Quitação recíproca</strong> — nada mais a reclamar de parte a parte
              <span className="block text-[10px] text-gray-400">
                Desmarque quando resta pendência (ex: dano em apuração na vistoria de saída).
              </span>
            </span>
          </label>
        </div>

        {/* Cláusulas 3ª em diante */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
            <label className="text-xs font-semibold text-gray-600">Demais cláusulas</label>
            <button
              type="button"
              onClick={() => { setClausulas(comUid(clausulasPadrao)); setFechamento(FECHAMENTO_PADRAO_DISTRATO) }}
              className="text-[11px] text-violet-700 hover:underline"
            >
              Restaurar texto padrão
            </button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoArrastar}>
            <SortableContext items={clausulas.map(c => c.uid)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {clausulas.map((c, i) => (
                  <ClausulaCard
                    key={c.uid}
                    clausula={c}
                    numero={i + 3}
                    onChange={(campo, v) => setClausula(c.uid, campo, v)}
                    onRemover={() => setClausulas(prev => prev.filter(x => x.uid !== c.uid))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button
            type="button"
            onClick={() => setClausulas(prev => [...prev, ...comUid([{ titulo: '', texto: '' }])])}
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-800"
          >
            <Plus size={12} /> Adicionar cláusula
          </button>
          <p className="text-[10px] text-gray-400 mt-1">
            A 1ª é a rescisão e a 2ª o acerto de contas, então estas começam na 3ª. A nova entra no fim —
            arraste pela alça <GripVertical size={10} className="inline -mt-0.5" /> pra mudar a ordem.
          </p>

          <label className="block text-xs font-semibold text-gray-600 mt-3 mb-1">Fechamento</label>
          <textarea
            value={fechamento}
            onChange={e => setFechamento(e.target.value)}
            rows={2}
            className={`${inputCls} resize-y leading-relaxed`}
          />
        </div>

        {/* Testemunhas */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-xs font-semibold text-gray-600">Testemunhas</label>
            <span className="text-[10px] text-gray-400">Selecionadas: <strong>{testemunhaIds.length}/2</strong></span>
          </div>
          {pessoasOrdenadas.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Nenhuma pessoa cadastrada ainda. Cadastre em Clientes.</p>
          ) : (
            <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-lg p-1 grid sm:grid-cols-2 gap-1">
              {pessoasOrdenadas.map(p => {
                const selecionada = testemunhaIds.includes(p.id)
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      selecionada ? 'bg-violet-50 border border-violet-300' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selecionada}
                      onChange={() => toggleTestemunha(p.id)}
                      disabled={isPending || (!selecionada && testemunhaIds.length >= 2)}
                      className="accent-violet-600 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{p.nome}</p>
                      <p className="text-[10px] text-gray-500">
                        {p.tipo === 'testemunha' && <span className="text-violet-600 font-bold">testemunha · </span>}
                        {fmtCpf(p.cpf_cnpj)}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {erro && <p className="text-xs text-rose-600 mt-2">{erro}</p>}

        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={onFechar} disabled={isPending} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={isPending || !objeto.trim()}
            className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {distrato ? 'Salvar e abrir PDF' : 'Gerar e abrir PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Uma cláusula no modal: arrastável pela alça, editável inline ──
function ClausulaCard({
  clausula, numero, onChange, onRemover,
}: {
  clausula: ClausulaEdit
  numero: number
  onChange: (campo: keyof ClausulaAditivo, v: string) => void
  onRemover: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: clausula.uid })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg p-2 bg-white ${isDragging ? 'border-violet-300 shadow-md' : 'border-gray-100'}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-600 p-1 -ml-1 shrink-0 touch-none"
          aria-label={`Arrastar a cláusula ${numero}ª pra reordenar`}
          title="Arrastar pra reordenar"
        >
          <GripVertical size={14} />
        </button>
        <span className="text-[11px] font-bold text-gray-500 shrink-0">Cláusula {numero}ª —</span>
        <input
          value={clausula.titulo}
          onChange={e => onChange('titulo', e.target.value)}
          placeholder="Título (ex: Da quitação)"
          className={`${inputCls} py-1`}
        />
        <button
          type="button"
          onClick={onRemover}
          className="text-gray-300 hover:text-rose-600 p-1 shrink-0"
          title="Remover cláusula"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <textarea
        value={clausula.texto}
        onChange={e => onChange('texto', e.target.value)}
        rows={4}
        className={`${inputCls} resize-y leading-relaxed`}
      />
    </div>
  )
}
