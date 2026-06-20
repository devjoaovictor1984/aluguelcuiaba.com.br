'use client'

import { useState, useTransition } from 'react'
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
  GripVertical, FileDown, Loader2, AlertCircle, X, Plus,
  Eye, Upload, FileCheck, CheckCircle2,
} from 'lucide-react'
import { rodarChecklistAdm, type DadosChecklistAdm } from '@/lib/contratos/checklist'
import { PLACEHOLDERS } from '@/lib/contratos/placeholders'
import { atualizarClausula, criarClausula } from '../../../../contratos/clausulas/actions'
import {
  atualizarOrdemClausulasAdm, alternarClausulaNaGeracaoAdm,
  atualizarTestemunhasAdm, atualizarAnexosDocumentosAdm,
  uploadAdmAssinado,
} from '../actions'

// Placeholders úteis em cláusulas de administração (proprietária, imóvel, admin, termos).
const PLACEHOLDERS_ADM = PLACEHOLDERS.filter(p => /^(ADM|ADMIN|LOCADOR|IMOVEL)/.test(p.chave))

interface ClausulaLista {
  id: string
  tipo: 'administracao'
  categoria: string
  titulo: string
  numero: number
  corpo: string
}

interface Pessoa {
  id: string
  nome: string
  cpf_cnpj: string | null
  tipo: string
}

type ChecklistBase = Omit<DadosChecklistAdm, 'categorias_presentes'>

interface Props {
  contratoAdmId: string
  codigo: string
  checklistBase: ChecklistBase
  geracao: {
    id: string
    clausula_ids: string[]
    testemunha_ids: string[]
    anexo_documento_ids: string[]
    pdf_assinado_url: string | null
    assinado_em: string | null
    status: string
  }
  todasClausulas: ClausulaLista[]
  pessoas: Pessoa[]
  documentosPartes: Array<{ id: string; tipo: string; nome_original: string; pessoa_nome: string }>
}

export function EditorContratoAdm({ contratoAdmId, codigo, checklistBase, geracao, todasClausulas, pessoas, documentosPartes }: Props) {
  const router = useRouter()
  const [clausulaIds, setClausulaIds] = useState(geracao.clausula_ids)
  const [testemunhaIds, setTestemunhaIds] = useState<string[]>(geracao.testemunha_ids)
  const [anexoIds, setAnexoIds] = useState<string[]>(geracao.anexo_documento_ids)
  const [mostrarAdicionais, setMostrarAdicionais] = useState(false)
  const [erro, setErro] = useState('')
  const [pdfAssinadoUrl, setPdfAssinadoUrl] = useState(geracao.pdf_assinado_url)
  const [assinadoEm, setAssinadoEm] = useState(geracao.assinado_em)
  const [erroUpload, setErroUpload] = useState('')
  const [isPending, startTransition] = useTransition()

  // Edição de cláusula em modal
  const [clausulaEdicao, setClausulaEdicao] = useState<ClausulaLista | null>(null)

  // Modal nova cláusula
  const [modalNova, setModalNova] = useState(false)
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novoCorpo, setNovoCorpo] = useState('')
  const [erroNova, setErroNova] = useState('')

  const mapaClausulas = new Map(todasClausulas.map(c => [c.id, c]))
  const selecionadas = clausulaIds.map(id => mapaClausulas.get(id)).filter((c): c is ClausulaLista => !!c)
  const disponiveis = todasClausulas.filter(c => !clausulaIds.includes(c.id))

  // Checklist — só os bloqueios (estilo do editor de locação), recalcula conforme as cláusulas.
  const itensChecklist = rodarChecklistAdm({
    ...checklistBase,
    categorias_presentes: selecionadas.map(c => c.categoria),
  })
  const bloqueios = itensChecklist.filter(i => i.severidade === 'block')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = clausulaIds.indexOf(active.id as string)
    const newIndex = clausulaIds.indexOf(over.id as string)
    const novaOrdem = arrayMove(clausulaIds, oldIndex, newIndex)
    setClausulaIds(novaOrdem)
    startTransition(async () => {
      const r = await atualizarOrdemClausulasAdm(geracao.id, novaOrdem)
      if (r.error) setErro(r.error)
    })
  }

  const onAtualizar = (id: string, titulo: string, corpo: string) => {
    const c = mapaClausulas.get(id)
    if (!c) return
    startTransition(async () => {
      const r = await atualizarClausula(id, { tipo: c.tipo, categoria: c.categoria, titulo, numero: c.numero, corpo })
      if (r.error) { setErro(r.error); return }
      mapaClausulas.set(id, { ...c, titulo, corpo })
      setClausulaIds([...clausulaIds])
    })
  }

  const onRemover = (id: string) => {
    setClausulaIds(curr => curr.filter(x => x !== id))
    startTransition(async () => {
      const r = await alternarClausulaNaGeracaoAdm(geracao.id, id, false)
      if (r.error) setErro(r.error)
    })
  }

  const onIncluir = (id: string) => {
    setClausulaIds(curr => [...curr, id])
    startTransition(async () => {
      const r = await alternarClausulaNaGeracaoAdm(geracao.id, id, true)
      if (r.error) setErro(r.error)
    })
  }

  const onToggleTestemunha = (id: string) => {
    const ja = testemunhaIds.includes(id)
    const nova = ja ? testemunhaIds.filter(x => x !== id) : (testemunhaIds.length >= 2 ? testemunhaIds : [...testemunhaIds, id])
    if (!ja && testemunhaIds.length >= 2) {
      setErro('Máximo 2 testemunhas.')
      return
    }
    setTestemunhaIds(nova)
    startTransition(async () => {
      const r = await atualizarTestemunhasAdm(geracao.id, nova)
      if (r.error) setErro(r.error)
      else router.refresh() // atualiza as sugestões de signatários (testemunhas)
    })
  }

  const onToggleAnexo = (id: string) => {
    const nova = anexoIds.includes(id) ? anexoIds.filter(x => x !== id) : [...anexoIds, id]
    setAnexoIds(nova)
    startTransition(async () => {
      const r = await atualizarAnexosDocumentosAdm(geracao.id, nova)
      if (r.error) setErro(r.error)
    })
  }

  const onUploadAssinado = (file: File | null) => {
    setErroUpload('')
    if (!file) return
    if (file.type !== 'application/pdf') { setErroUpload('PDF only.'); return }
    const fd = new FormData()
    fd.set('file', file)
    startTransition(async () => {
      const r = await uploadAdmAssinado(geracao.id, fd)
      if (r.error || !r.url) { setErroUpload(r.error ?? 'Falha ao subir.'); return }
      setPdfAssinadoUrl(r.url)
      setAssinadoEm(new Date().toISOString())
    })
  }

  const onCriarNova = () => {
    setErroNova('')
    if (novoTitulo.trim().length < 3) { setErroNova('Título curto demais.'); return }
    if (novoCorpo.trim().length < 10) { setErroNova('Corpo curto demais.'); return }
    startTransition(async () => {
      const r = await criarClausula({ tipo: 'administracao', categoria: 'custom', titulo: novoTitulo.trim(), numero: 100 + clausulaIds.length, corpo: novoCorpo.trim() })
      if (r.error || !r.id) { setErroNova(r.error ?? 'Falha.'); return }
      const r2 = await alternarClausulaNaGeracaoAdm(geracao.id, r.id, true)
      if (r2.error) { setErroNova(r2.error); return }
      setClausulaIds(prev => [...prev, r.id!])
      router.refresh()
      setModalNova(false)
      setNovoTitulo('')
      setNovoCorpo('')
    })
  }

  const pdfUrl = `/api/contratos-admin/${contratoAdmId}/pdf`

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      <aside className="space-y-4">
        {/* Testemunhas */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Testemunhas</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">Até 2</p>
          </div>
          {pessoas.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Nenhuma pessoa cadastrada.</p>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {pessoas.map(p => {
                const sel = testemunhaIds.includes(p.id)
                return (
                  <label key={p.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${sel ? 'bg-violet-50 border border-violet-300' : 'hover:bg-gray-50 border border-transparent'}`}>
                    <input type="checkbox" checked={sel} onChange={() => onToggleTestemunha(p.id)} disabled={isPending || (!sel && testemunhaIds.length >= 2)} className="accent-violet-600 shrink-0" />
                    <span className="text-xs font-semibold text-gray-900 truncate flex-1">{p.nome}</span>
                  </label>
                )
              })}
            </div>
          )}
        </section>

        {/* Anexos */}
        {documentosPartes.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <FileDown size={12} /> Anexos
              </h2>
              <p className="text-[10px] text-gray-400 mt-0.5">Docs das partes no final do PDF (marque o que anexar).</p>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {documentosPartes.map(d => {
                const sel = anexoIds.includes(d.id)
                return (
                  <label key={d.id} className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer ${sel ? 'bg-violet-50 border border-violet-300' : 'hover:bg-gray-50 border border-transparent'}`}>
                    <input type="checkbox" checked={sel} onChange={() => onToggleAnexo(d.id)} disabled={isPending} className="accent-violet-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{d.nome_original}</p>
                      <p className="text-[10px] text-gray-500"><span className="font-mono uppercase">{d.tipo}</span> · {d.pessoa_nome}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </section>
        )}

        {/* Upload assinado */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <FileCheck size={12} /> Contrato assinado
            </h2>
            <p className="text-[10px] text-gray-400 mt-0.5">PDF assinado pra anexar.</p>
          </div>
          {pdfAssinadoUrl ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-green-800">
                <CheckCircle2 size={14} />
                <span className="text-xs font-semibold">Assinado</span>
                {assinadoEm && <span className="text-[10px] text-green-700/80">em {new Date(assinadoEm).toLocaleString('pt-BR')}</span>}
              </div>
              <a href={pdfAssinadoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 rounded"><Eye size={11} /> Abrir</a>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-violet-200 rounded-lg cursor-pointer hover:bg-violet-50">
              <Upload size={16} className="text-violet-600 mb-1" />
              <span className="text-xs font-semibold text-violet-700">Anexar PDF assinado</span>
              <input type="file" accept="application/pdf" className="hidden" onChange={e => onUploadAssinado(e.target.files?.[0] ?? null)} disabled={isPending} />
            </label>
          )}
          {erroUpload && <p className="text-[11px] text-red-600 flex items-start gap-1"><AlertCircle size={11} className="mt-0.5 shrink-0" /> {erroUpload}</p>}
        </section>

        {/* Pendências antes de gerar (só bloqueios) */}
        {bloqueios.length > 0 && (
          <section className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
              <AlertCircle size={12} /> Pendências antes de gerar ({bloqueios.length})
            </h2>
            <ul className="text-[11px] text-rose-700 space-y-1">
              {bloqueios.map(b => (
                <li key={b.id} className="flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0">•</span>
                  <span><strong>{b.rotulo}:</strong> {b.mensagem}</span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-rose-600">Corrija no cadastro do contrato/cláusulas ou gere mesmo assim por sua conta.</p>
          </section>
        )}

        {/* Botões PDF */}
        <div className="grid gap-2">
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-3 rounded-xl">
            <Eye size={14} /> Visualizar PDF
          </a>
          <a href={pdfUrl} download={`contrato-adm-${codigo}.pdf`} className="flex items-center justify-center gap-1.5 bg-white hover:bg-violet-50 text-violet-700 text-sm font-semibold px-4 py-2.5 rounded-xl border border-violet-200">
            <FileDown size={14} /> Baixar PDF
          </a>
        </div>
      </aside>

      <section className="space-y-2">
        {erro && (
          <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle size={14} className="mt-0.5 shrink-0" /> {erro}
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={clausulaIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {selecionadas.map((c, idx) => (
                <ClausulaCard
                  key={c.id}
                  numero={idx + 1}
                  clausula={c}
                  isPending={isPending}
                  onEditar={() => setClausulaEdicao(c)}
                  onRemover={() => onRemover(c.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {selecionadas.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
            Nenhuma cláusula no contrato.
          </div>
        )}

        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="button" onClick={() => setMostrarAdicionais(v => !v)} className="flex items-center justify-center gap-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 py-3 rounded-xl border-2 border-dashed border-violet-200">
            <Plus size={13} /> {mostrarAdicionais ? 'Esconder' : 'Adicionar'} do banco ({disponiveis.length})
          </button>
          <button type="button" onClick={() => { setModalNova(true); setNovoTitulo(''); setNovoCorpo(''); setErroNova('') }} className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 py-3 rounded-xl border-2 border-dashed border-amber-300">
            <Plus size={13} /> Criar cláusula nova
          </button>
        </div>

        {mostrarAdicionais && (
          <div className="mt-2 space-y-1.5">
            {disponiveis.map(c => (
              <button key={c.id} type="button" onClick={() => onIncluir(c.id)} disabled={isPending} className="w-full text-left bg-white hover:bg-violet-50 border border-gray-200 hover:border-violet-300 rounded-lg p-3 transition-colors disabled:opacity-50">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[9px] text-gray-400">{c.categoria}</span>
                  <Plus size={12} className="text-violet-600 shrink-0" />
                </div>
                <p className="text-xs font-semibold text-gray-900">{c.titulo}</p>
                <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{c.corpo.slice(0, 100)}…</p>
              </button>
            ))}
            {disponiveis.length === 0 && (
              <p className="text-xs text-center text-gray-400 py-4">Todas as cláusulas já estão no contrato.</p>
            )}
          </div>
        )}

        {/* Modal nova cláusula */}
        {modalNova && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isPending && setModalNova(false)}>
            <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Nova cláusula de administração</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Cria no banco e já inclui aqui.</p>
                </div>
                <button type="button" onClick={() => setModalNova(false)} disabled={isPending} className="p-1 text-gray-400 hover:text-gray-700"><X size={16} /></button>
              </div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Título</label>
              <input type="text" value={novoTitulo} onChange={e => setNovoTitulo(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm mb-3" />
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Corpo <span className="text-gray-400 font-normal">(clique num placeholder pra inserir {'{{X}}'})</span>
              </label>
              <textarea value={novoCorpo} onChange={e => setNovoCorpo(e.target.value)} rows={8} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-xs font-mono leading-relaxed resize-y" />

              {/* Picker de placeholders de administração */}
              <details className="mt-2 group">
                <summary className="text-[11px] font-semibold text-violet-700 cursor-pointer select-none">
                  Placeholders disponíveis ({PLACEHOLDERS_ADM.length})
                </summary>
                <div className="mt-2 max-h-40 overflow-y-auto flex flex-wrap gap-1.5 bg-gray-50 rounded-lg p-2">
                  {PLACEHOLDERS_ADM.map(p => (
                    <button
                      key={p.chave}
                      type="button"
                      title={`${p.label} — ex.: ${p.exemplo}`}
                      onClick={() => setNovoCorpo(prev => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}{{${p.chave}}}`)}
                      className="text-[10px] font-mono bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 px-1.5 py-0.5 rounded"
                    >
                      {`{{${p.chave}}}`}
                    </button>
                  ))}
                </div>
              </details>

              {erroNova && <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertCircle size={11} /> {erroNova}</p>}
              <div className="flex gap-2 mt-4 justify-end">
                <button type="button" onClick={() => setModalNova(false)} disabled={isPending} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
                <button type="button" onClick={onCriarNova} disabled={isPending || !novoTitulo.trim() || !novoCorpo.trim()} className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                  {isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Criar e adicionar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de edição da cláusula (com sidebar de placeholders) */}
        {clausulaEdicao && (
          <ModalEditarClausulaAdm
            clausula={clausulaEdicao}
            isPending={isPending}
            onFechar={() => setClausulaEdicao(null)}
            onSalvar={(t, b) => { onAtualizar(clausulaEdicao.id, t, b); setClausulaEdicao(null) }}
          />
        )}
      </section>
    </div>
  )
}

function ClausulaCard({ numero, clausula, isPending, onEditar, onRemover }: {
  numero: number
  clausula: ClausulaLista
  isPending: boolean
  onEditar: () => void
  onRemover: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: clausula.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-start gap-1 px-3 py-2 bg-gray-50 border-b border-gray-100">
        <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 p-1 -ml-1 touch-none">
          <GripVertical size={14} />
        </button>
        <span className="text-xs font-mono font-bold text-violet-700 px-1.5">{numero}.</span>
        <h3 className="flex-1 text-sm font-bold text-gray-900 py-0.5">{clausula.titulo}</h3>
      </div>
      <div className="p-3">
        <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed line-clamp-4">{clausula.corpo}</p>
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" onClick={onEditar} className="text-xs font-semibold text-violet-700 hover:bg-violet-50 px-2 py-1 rounded">Editar</button>
          <button type="button" onClick={onRemover} disabled={isPending} className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded disabled:opacity-50">
            <X size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

// Modal de edição da cláusula com barra lateral de placeholders (estilo do editor de locação).
function ModalEditarClausulaAdm({ clausula, isPending, onSalvar, onFechar }: {
  clausula: ClausulaLista
  isPending: boolean
  onSalvar: (titulo: string, corpo: string) => void
  onFechar: () => void
}) {
  const [titulo, setTitulo] = useState(clausula.titulo)
  const [corpo, setCorpo] = useState(clausula.corpo)
  const inserir = (chave: string) => setCorpo(prev => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}{{${chave}}}`)

  const grupos = PLACEHOLDERS_ADM.reduce<Record<string, typeof PLACEHOLDERS_ADM>>((acc, p) => {
    (acc[p.origem] ??= []).push(p); return acc
  }, {})
  const labelOrigem: Record<string, string> = {
    admin: 'Administradora', locador: 'Proprietária', imovel: 'Imóvel',
    valores: 'Valores', prazo: 'Prazo', garantia: 'Garantia',
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isPending && onFechar()}>
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between gap-3 p-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Editar cláusula</h2>
            <p className="text-[11px] text-amber-700 mt-0.5">⚠️ Altera a cláusula no <strong>seu</strong> banco (privado). Reflete neste e nos contratos futuros. Contratos já assinados não mudam.</p>
          </div>
          <button type="button" onClick={onFechar} disabled={isPending} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </header>

        <div className="grid lg:grid-cols-[1fr_240px] gap-0 flex-1 overflow-hidden">
          <div className="p-4 space-y-3 overflow-y-auto">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Título</label>
              <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} className="w-full text-sm font-medium text-gray-900 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Corpo</label>
              <textarea value={corpo} onChange={e => setCorpo(e.target.value)} rows={Math.max(10, Math.min(24, corpo.split('\n').length + 2))} className="w-full text-xs font-mono leading-relaxed border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y" />
              <p className="text-[10px] text-gray-400 mt-1">Clique num placeholder ao lado pra inserir no texto — no PDF vira o dado real.</p>
            </div>
          </div>

          <aside className="border-t lg:border-t-0 lg:border-l border-gray-100 bg-gray-50 p-3 overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Placeholders</p>
            <p className="text-[10px] text-gray-400 mb-3">Clique pra inserir no corpo.</p>
            <div className="space-y-3">
              {Object.entries(grupos).map(([origem, lista]) => (
                <div key={origem}>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{labelOrigem[origem] ?? origem}</p>
                  <div className="flex flex-wrap gap-1">
                    {lista.map(p => (
                      <button key={p.chave} type="button" onClick={() => inserir(p.chave)} title={`${p.label} · Ex: ${p.exemplo}`} className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-white border-gray-200 text-gray-700 hover:bg-violet-50 hover:border-violet-300">
                        {`{{${p.chave}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <footer className="flex items-center justify-end gap-2 p-3 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onFechar} disabled={isPending} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
          <button type="button" onClick={() => onSalvar(titulo, corpo)} disabled={isPending || !titulo.trim() || !corpo.trim()} className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            {isPending ? <Loader2 size={13} className="animate-spin" /> : 'Salvar'}
          </button>
        </footer>
      </div>
    </div>
  )
}
