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
  FilePlus2, Plus, Trash2, Loader2, X, FileText, Download, Pencil, Users, PenLine, CheckCircle2, Clock,
  GripVertical,
} from 'lucide-react'
import { PainelAssinatura } from '@/app/(auth)/painel/contratos/_components/painel-assinatura'
import type { ProcessoPainel } from '@/lib/crm/assinatura-painel'
import {
  clausulasPadraoAditivo, normalizarClausulas, mesmasClausulas, FECHAMENTO_PADRAO_ADITIVO, type ClausulaAditivo,
} from '@/lib/crm/aditivo-clausulas'

/**
 * Seção "Termos aditivos", compartilhada entre o contrato de locação e o
 * de administração. Muda só o que é de cada um — tipos, textos, actions,
 * rota do PDF e tipo de assinatura —, que vêm dos wrappers
 * `aditivos-secao` e `aditivos-adm-secao`.
 */

export interface TermoAditivoRow {
  id: string
  numero: number
  data_aditivo: string
  tipo: string
  titulo: string | null
  objeto: string
  testemunha_ids: string[] | null
  contrato_originario_ref?: string | null
  clausulas?: ClausulaAditivo[] | null
  fechamento?: string | null
}

export interface PessoaTestemunha {
  id: string
  nome: string
  tipo: string
  cpf_cnpj: string | null
}

export interface TipoTermo {
  valor: string
  label: string
  modelo: string
}

export interface TermoAditivoInput {
  contrato_id: string
  tipo: string
  titulo: string
  data_aditivo: string
  objeto: string
  testemunha_ids: string[]
  contrato_originario_ref: string
  /** null = igual ao padrão (não congela cópia). */
  clausulas: ClausulaAditivo[] | null
  fechamento: string | null
}

export interface SugestaoSignatario { nome: string; email: string; papel: string }

/** Assinatura eletrônica de cada aditivo: processos já abertos + quem assina. */
export interface AssinaturaAditivos {
  tipo: 'aditivo_locacao' | 'aditivo_administracao'
  baseUrl: string
  porAditivo: Record<string, { processos: ProcessoPainel[]; sugestoes: SugestaoSignatario[] }>
}

type Resultado = { error?: string; id?: string }

interface Props {
  contratoId: string
  /** Código do contrato, pro título do processo de assinatura. */
  codigoContrato: string
  /**
   * Como o aditivo cita o contrato originário quando o campo fica em branco:
   * "nº X, firmado em dd/mm/aaaa" se foi assinado pela plataforma; null se não.
   */
  originarioPadrao: string | null
  /** Cidade do foro no texto padrão, formato "Cuiabá-MT" (mesma regra do PDF). */
  cidadeUf: string
  aditivos: TermoAditivoRow[]
  pessoas: PessoaTestemunha[]
  tipos: TipoTermo[]
  /** Prefixo da rota do PDF; o id do aditivo e `/pdf` são acrescentados. */
  pdfBase: string
  textoVazio: string
  subtitulo: string
  placeholderTitulo: string
  assinatura: AssinaturaAditivos
  criar: (input: TermoAditivoInput) => Promise<Resultado>
  atualizar: (id: string, input: TermoAditivoInput) => Promise<Resultado>
  excluir: (id: string, contratoId: string) => Promise<Resultado>
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"

function fmtData(d: string): string {
  const s = d.slice(0, 10)
  const [y, m, dd] = s.split('-')
  return `${dd}/${m}/${y}`
}

function fmtCpf(s: string | null): string {
  if (!s) return 'sem CPF'
  const d = s.replace(/\D/g, '')
  if (d.length === 11) return `CPF ${d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')}`
  if (d.length === 14) return `CNPJ ${d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}`
  return s
}

/** Mesma regra de situacaoAssinaturaDocumento (servidor), a partir dos processos já carregados. */
function situacaoDe(processos: ProcessoPainel[] | undefined): 'concluido' | 'enviado' | null {
  const ativos = (processos ?? []).filter(p => p.status !== 'cancelado')
  if (ativos.some(p => p.status === 'concluido')) return 'concluido'
  return ativos.length > 0 ? 'enviado' : null
}

/**
 * As cláusulas do aditivo não têm id no banco (é um JSONB de {titulo, texto}),
 * mas o dnd-kit precisa de uma chave estável pra arrastar sem embaralhar o
 * texto que está sendo digitado. Então o modal carrega cada uma com um `uid`
 * só de tela, que some de novo na hora de salvar.
 */
type ClausulaEdit = ClausulaAditivo & { uid: string }

let seqUid = 0
const comUid = (lista: ClausulaAditivo[]): ClausulaEdit[] =>
  lista.map(c => ({ ...c, uid: `cl${++seqUid}` }))
const semUid = (lista: ClausulaEdit[]): ClausulaAditivo[] =>
  lista.map(({ titulo, texto }) => ({ titulo, texto }))

const hoje = () => new Date().toISOString().slice(0, 10)

export function TermosAditivosSecao({
  contratoId, codigoContrato, originarioPadrao, cidadeUf, aditivos, pessoas, tipos, pdfBase, textoVazio, subtitulo, placeholderTitulo,
  assinatura, criar, atualizar, excluir,
}: Props) {
  const router = useRouter()
  const tipoPadrao = tipos[0]
  const [modalAberto, setModalAberto] = useState(false)
  // null = criando um novo; senão, o aditivo em edição
  const [editando, setEditando] = useState<TermoAditivoRow | null>(null)
  const [tipo, setTipo] = useState(tipoPadrao.valor)
  const [titulo, setTitulo] = useState('')
  const [dataAditivo, setDataAditivo] = useState(hoje)
  const [objeto, setObjeto] = useState('')
  const [testemunhaIds, setTestemunhaIds] = useState<string[]>([])
  const [originario, setOriginario] = useState('')
  const contratoTipo = assinatura.tipo === 'aditivo_administracao' ? 'administracao' : 'locacao'
  const clausulasPadrao = useMemo(() => clausulasPadraoAditivo(contratoTipo, cidadeUf), [contratoTipo, cidadeUf])
  const [clausulas, setClausulas] = useState<ClausulaEdit[]>([])
  const [fechamento, setFechamento] = useState('')
  const [erro, setErro] = useState('')
  const [erroLista, setErroLista] = useState('')
  const [removendo, setRemovendo] = useState<string | null>(null)
  // Aditivo com o painel de assinatura aberto (um por vez)
  const [assinandoId, setAssinandoId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const proximoNumero = aditivos.length + 1
  const tipoLabel = useMemo(() => Object.fromEntries(tipos.map(t => [t.valor, t.label])), [tipos])
  const nomePorId = useMemo(() => new Map(pessoas.map(p => [p.id, p.nome])), [pessoas])

  // Quem está cadastrado como testemunha vem primeiro, igual ao editor do contrato
  const pessoasOrdenadas = useMemo(() => [...pessoas].sort((a, b) => {
    if (a.tipo === 'testemunha' && b.tipo !== 'testemunha') return -1
    if (b.tipo === 'testemunha' && a.tipo !== 'testemunha') return 1
    return a.nome.localeCompare(b.nome)
  }), [pessoas])

  const escolherTipo = (t: string) => {
    setTipo(t)
    const modelo = tipos.find(x => x.valor === t)?.modelo ?? ''
    // só preenche o modelo se o campo ainda estiver vazio (não sobrescreve edição)
    if (!objeto.trim()) setObjeto(modelo)
  }

  const abrirNovo = () => {
    setEditando(null)
    setTitulo(''); setErro(''); setTestemunhaIds([]); setOriginario('')
    setClausulas(comUid(clausulasPadrao)); setFechamento(FECHAMENTO_PADRAO_ADITIVO)
    setDataAditivo(hoje())
    setTipo(tipoPadrao.valor)
    setObjeto(tipoPadrao.modelo)
    setModalAberto(true)
  }

  const abrirEdicao = (a: TermoAditivoRow) => {
    setEditando(a)
    setTipo(tipoLabel[a.tipo] ? a.tipo : 'outro')
    setTitulo(a.titulo ?? '')
    setDataAditivo(a.data_aditivo.slice(0, 10))
    setObjeto(a.objeto)
    setTestemunhaIds(a.testemunha_ids ?? [])
    setOriginario(a.contrato_originario_ref ?? '')
    setClausulas(comUid(a.clausulas?.length ? a.clausulas : clausulasPadrao))
    setFechamento(a.fechamento?.trim() || FECHAMENTO_PADRAO_ADITIVO)
    setErro('')
    setModalAberto(true)
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

  // Só reordena na tela; a ordem nova vai junto no salvar, como o resto do texto.
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
    if (!objeto.trim()) { setErro('Descreva o que está sendo aditado.'); return }
    // Igual ao padrão grava null: o aditivo segue acompanhando o texto padrão
    // (e o foro da imobiliária) em vez de congelar uma cópia dele.
    const clausulasLimpas = normalizarClausulas(semUid(clausulas))
    const fechamentoLimpo = fechamento.trim()
    const input = {
      contrato_id: contratoId, tipo, titulo, data_aditivo: dataAditivo, objeto,
      testemunha_ids: testemunhaIds, contrato_originario_ref: originario,
      clausulas: mesmasClausulas(clausulasLimpas, clausulasPadrao) ? null : clausulasLimpas,
      fechamento: !fechamentoLimpo || fechamentoLimpo === FECHAMENTO_PADRAO_ADITIVO ? null : fechamentoLimpo,
    }
    startTransition(async () => {
      const r = editando ? await atualizar(editando.id, input) : await criar(input)
      if (r.error) { setErro(r.error); return }
      setModalAberto(false)
      setEditando(null)
      router.refresh()
      // abre o PDF já com o que acabou de ser salvo
      if (r.id) window.open(`${pdfBase}/${r.id}/pdf`, '_blank')
    })
  }

  const remover = (id: string) => {
    if (!confirm('Excluir este termo aditivo? Esta ação não pode ser desfeita.')) return
    setErroLista('')
    setRemovendo(id)
    startTransition(async () => {
      const r = await excluir(id, contratoId)
      setRemovendo(null)
      if (r.error) { setErroLista(r.error); return }
      router.refresh()
    })
  }

  const numeroModal = editando?.numero ?? proximoNumero

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <FilePlus2 size={14} className="text-violet-600" />
          Termos aditivos
          <span className="text-xs font-normal text-gray-400">({aditivos.length})</span>
        </h2>
        <button
          type="button"
          onClick={abrirNovo}
          className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-800 border border-violet-200 hover:bg-violet-50 px-2.5 py-1 rounded-lg transition-colors"
        >
          <Plus size={12} /> Novo aditivo
        </button>
      </div>

      {erroLista && <p className="text-xs text-rose-600 mb-2">{erroLista}</p>}

      {aditivos.length === 0 ? (
        <p className="text-xs text-gray-400">{textoVazio}</p>
      ) : (
        <ul className="space-y-2">
          {aditivos.map(a => {
            const testemunhas = (a.testemunha_ids ?? []).map(id => nomePorId.get(id)).filter(Boolean)
            const dadosAss = assinatura.porAditivo[a.id]
            const situacao = situacaoDe(dadosAss?.processos)
            // Em assinatura ou assinado, o texto não muda mais (ver msgDocumentoTravado)
            const motivoTrava = situacao === 'concluido'
              ? 'Já assinado por todas as partes — para mudar algo, faça um novo aditivo'
              : situacao === 'enviado'
                ? 'Em assinatura — cancele o envio no painel de assinatura para editar'
                : null
            const assinando = assinandoId === a.id
            return (
              <li key={a.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold">{a.numero}º aditivo</span>
                      {a.titulo?.trim() || tipoLabel[a.tipo] || 'Aditamento'}
                      <span className="text-[11px] font-normal text-gray-400">· {fmtData(a.data_aditivo)}</span>
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
                    </p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2 whitespace-pre-wrap">{a.objeto}</p>
                    <p className={`text-[11px] mt-1 flex items-center gap-1 ${testemunhas.length ? 'text-gray-500' : 'text-amber-600'}`}>
                      <Users size={11} />
                      {testemunhas.length ? `Testemunhas: ${testemunhas.join(', ')}` : 'Sem testemunhas — o PDF sai com as linhas em branco'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={() => setAssinandoId(assinando ? null : a.id)}
                      className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg ${
                        assinando ? 'bg-violet-100 text-violet-800' : 'text-violet-700 hover:bg-violet-50'
                      }`}
                      title="Assinatura eletrônica: selfie, código por e-mail e assinatura desenhada"
                    >
                      <PenLine size={13} /> Assinatura
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirEdicao(a)}
                      disabled={isPending || !!motivoTrava}
                      className="flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-100 px-2 py-1.5 rounded-lg disabled:opacity-40 disabled:hover:bg-transparent"
                      title={motivoTrava ?? 'Editar texto, data e testemunhas'}
                    >
                      <Pencil size={13} /> Editar
                    </button>
                    <a
                      href={`${pdfBase}/${a.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-violet-700 hover:bg-violet-50 px-2 py-1.5 rounded-lg"
                      title="Abrir PDF do aditivo"
                    >
                      <FileText size={13} /> PDF
                    </a>
                    <button
                      type="button"
                      onClick={() => remover(a.id)}
                      disabled={isPending || !!motivoTrava}
                      className="text-gray-300 hover:text-rose-600 p-1.5 disabled:opacity-40 disabled:hover:text-gray-300"
                      title={motivoTrava ?? 'Excluir aditivo'}
                    >
                      {removendo === a.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>

                {assinando && (
                  <div className="mt-3">
                    {!situacao && testemunhas.length === 0 && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-2">
                        Este aditivo está sem testemunhas. Escolha em <strong>Editar</strong> antes de enviar — depois
                        de enviado, não dá mais pra mudar.
                      </p>
                    )}
                    <PainelAssinatura
                      tipoContrato={assinatura.tipo}
                      contratoId={a.id}
                      titulo={`${codigoContrato} · ${a.numero}º aditivo`}
                      baseUrl={assinatura.baseUrl}
                      sugestoes={dadosAss?.sugestoes ?? []}
                      processos={dadosAss?.processos ?? []}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isPending && setModalAberto(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FilePlus2 size={16} className="text-violet-600" />
                {editando ? `Editar ${numeroModal}º termo aditivo` : `${numeroModal}º Termo aditivo`}
              </h2>
              <button type="button" onClick={() => setModalAberto(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X size={16} />
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mb-3">
              {subtitulo}
              {editando && ' Editar aqui muda só o documento — valores e parcelas continuam como estão.'}
            </p>

            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                <select value={tipo} onChange={e => escolherTipo(e.target.value)} className={inputCls}>
                  {tipos.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data do aditivo</label>
                <input type="date" value={dataAditivo} onChange={e => setDataAditivo(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Título (opcional)</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={placeholderTitulo} className={inputCls} />
              </div>
            </div>

            {/* Como citar o contrato originário. Número e data da plataforma só
                valem pra contrato assinado por ela — ver contrato-originario.ts. */}
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
                  : <>Este contrato não foi assinado pela plataforma. Em branco, o aditivo cita só <strong>&ldquo;o contrato celebrado entre as partes&rdquo;</strong>, sem número. Se quiser, escreva como está no papel.</>}
              </p>
            </div>

            <label className="block text-xs font-semibold text-gray-600 mb-1">Cláusula 1ª — O que está sendo aditado *</label>
            <textarea
              value={objeto}
              onChange={e => setObjeto(e.target.value)}
              rows={12}
              placeholder="Descreva a alteração. Use uma linha em branco entre parágrafos — cada um vira um item numerado (1.1, 1.2…) no PDF."
              className={`${inputCls} resize-y leading-relaxed`}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Linha em branco entre parágrafos numera cada item (1.1, 1.2…). Preâmbulo com as partes, data e
              assinaturas o PDF monta sozinho.
            </p>

            {/* Cláusulas 2ª em diante: já vêm com o texto padrão (ratificação,
                assinatura eletrônica, foro). Igual ao padrão não é gravado. */}
            <div className="mt-4">
              <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
                <label className="text-xs font-semibold text-gray-600">Demais cláusulas</label>
                <button
                  type="button"
                  onClick={() => { setClausulas(comUid(clausulasPadrao)); setFechamento(FECHAMENTO_PADRAO_ADITIVO) }}
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
                        numero={i + 2}
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
                A cláusula nova entra no fim. Arraste pela alça <GripVertical size={10} className="inline -mt-0.5" />
                {' '}pra colocar na ordem que deve sair no PDF.
              </p>

              <label className="block text-xs font-semibold text-gray-600 mt-3 mb-1">Fechamento</label>
              <textarea
                value={fechamento}
                onChange={e => setFechamento(e.target.value)}
                rows={2}
                className={`${inputCls} resize-y leading-relaxed`}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Vem logo antes da data e das assinaturas. Assinado pela plataforma, o certificado de assinatura sai
                anexo ao PDF final.
              </p>
            </div>

            {/* Testemunhas — até 2 do cadastro, igual ao contrato */}
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
              <p className="text-[10px] text-gray-400 mt-1">
                Escolhidas saem com nome, CPF e RG na folha de assinatura. Sem escolher, o PDF deixa as linhas em branco.
              </p>
            </div>

            {erro && <p className="text-xs text-rose-600 mt-2">{erro}</p>}

            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setModalAberto(false)} disabled={isPending} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancelar
              </button>
              <button type="button" onClick={salvar} disabled={isPending || !objeto.trim()} className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {editando ? 'Salvar e abrir PDF' : 'Criar e gerar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ── Uma cláusula do aditivo no modal: arrastável pela alça, editável inline ──
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
          placeholder="Título (ex: Da ratificação)"
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
