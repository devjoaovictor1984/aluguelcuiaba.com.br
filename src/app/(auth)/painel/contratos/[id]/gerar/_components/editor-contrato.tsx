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
  GripVertical, Save, FileDown, Loader2, AlertCircle, X, Plus,
  Settings, Eye, Upload, FileCheck, CheckCircle2,
} from 'lucide-react'
import { atualizarClausula, criarClausula } from '../../../clausulas/actions'
import {
  atualizarOpcoesGeracao, atualizarOrdemClausulas, alternarClausulaNaGeracao,
  atualizarTestemunhas, atualizarClausulasSeguradora,
  uploadContratoAssinado, removerContratoAssinado,
  atualizarAnexosDocumentos, marcarComoGerado,
} from '../actions'
import type { TipoClausula } from '@/lib/contratos/placeholders'

interface ClausulaLista {
  id: string
  tipo: TipoClausula
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

interface Props {
  contratoId: string
  codigo: string
  garantiaTipo: string
  geracao: {
    id: string
    tipo_seguro_incendio: 'dispensado' | 'cobrado_parte' | 'embutido_pacote'
    saida_sem_multa_12m: boolean
    clausula_ids: string[]
    testemunha_ids: string[]
    clausulas_seguradora_texto: string
    pdf_assinado_url: string | null
    assinado_em: string | null
    status: string
    anexo_documento_ids: string[]
  }
  todasClausulas: ClausulaLista[]
  pessoas: Pessoa[]
  documentosPartes: Array<{
    id: string
    tipo: string
    nome_original: string
    pessoa_nome: string
  }>
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-gray-900 text-sm transition"

export function EditorContrato({ contratoId, codigo, garantiaTipo, geracao, todasClausulas, pessoas, documentosPartes }: Props) {
  const router = useRouter()
  const [tipoSeguroIncendio, setTipoSeguroIncendio] = useState(geracao.tipo_seguro_incendio)
  const [saidaSemMulta12m, setSaidaSemMulta12m] = useState(geracao.saida_sem_multa_12m)
  const [clausulaIds, setClausulaIds] = useState(geracao.clausula_ids)
  const [mostrarAdicionais, setMostrarAdicionais] = useState(false)
  const [testemunhaIds, setTestemunhaIds] = useState<string[]>(geracao.testemunha_ids)
  const [textoSeguradora, setTextoSeguradora] = useState(geracao.clausulas_seguradora_texto)



  // Upload contrato assinado
  const [statusGeracao, setStatusGeracao] = useState(geracao.status)
  const [pdfAssinadoUrl, setPdfAssinadoUrl] = useState(geracao.pdf_assinado_url)
  const [assinadoEm, setAssinadoEm] = useState(geracao.assinado_em)
  const [erroUpload, setErroUpload] = useState('')

  // Anexos selecionados (IDs em pessoas_documentos)
  const [anexoIds, setAnexoIds] = useState<string[]>(geracao.anexo_documento_ids)

  const onToggleAnexo = (id: string) => {
    const ja = anexoIds.includes(id)
    const novaLista = ja ? anexoIds.filter(x => x !== id) : [...anexoIds, id]
    setAnexoIds(novaLista)
    startTransition(async () => {
      const r = await atualizarAnexosDocumentos(geracao.id, novaLista)
      if (r.error) setErro(r.error)
    })
  }

  // Modal cláusula adicional inline
  const [modalNovaClausula, setModalNovaClausula] = useState(false)
  const [novaClausulaTitulo, setNovaClausulaTitulo] = useState('')
  const [novaClausulaCorpo, setNovaClausulaCorpo] = useState('')
  const [erroNovaClausula, setErroNovaClausula] = useState('')
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  // Pessoas elegíveis pra testemunha — prioriza as marcadas como 'testemunha'
  const pessoasOrdenadas = [...pessoas].sort((a, b) => {
    if (a.tipo === 'testemunha' && b.tipo !== 'testemunha') return -1
    if (b.tipo === 'testemunha' && a.tipo !== 'testemunha') return 1
    return 0
  })

  const onToggleTestemunha = (id: string) => {
    setErro('')
    const ja = testemunhaIds.includes(id)
    let novaLista: string[]
    if (ja) {
      novaLista = testemunhaIds.filter(x => x !== id)
    } else {
      if (testemunhaIds.length >= 2) {
        setErro('Máximo 2 testemunhas. Desmarque uma antes.')
        return
      }
      novaLista = [...testemunhaIds, id]
    }
    setTestemunhaIds(novaLista)
    startTransition(async () => {
      const r = await atualizarTestemunhas(geracao.id, novaLista)
      if (r.error) setErro(r.error)
    })
  }


  // Upload contrato assinado
  const onSelecionarPdfAssinado = (file: File | null) => {
    setErroUpload('')
    if (!file) return
    if (file.type !== 'application/pdf') {
      setErroUpload('O arquivo precisa ser um PDF.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setErroUpload('Arquivo maior que 20MB.')
      return
    }
    const fd = new FormData()
    fd.set('file', file)
    startTransition(async () => {
      const r = await uploadContratoAssinado(geracao.id, fd)
      if (r.error || !r.url) {
        setErroUpload(r.error ?? 'Falha ao subir.')
        return
      }
      setPdfAssinadoUrl(r.url)
      setAssinadoEm(new Date().toISOString())
      setStatusGeracao('assinado')
    })
  }

  const onRemoverAssinado = () => {
    if (!confirm('Remover o contrato assinado anexado? Isso reverte o status pra rascunho.')) return
    startTransition(async () => {
      const r = await removerContratoAssinado(geracao.id)
      if (r.error) { setErroUpload(r.error); return }
      setPdfAssinadoUrl(null)
      setAssinadoEm(null)
      setStatusGeracao('rascunho')
    })
  }

  // Modal: criar cláusula adicional inline
  const onCriarClausulaInline = () => {
    setErroNovaClausula('')
    if (novaClausulaTitulo.trim().length < 3) {
      setErroNovaClausula('Título precisa de pelo menos 3 caracteres.')
      return
    }
    if (novaClausulaCorpo.trim().length < 10) {
      setErroNovaClausula('Corpo precisa de pelo menos 10 caracteres.')
      return
    }
    startTransition(async () => {
      // Cria cláusula no banco (tipo='adicional')
      const r = await criarClausula({
        tipo: 'adicional',
        categoria: 'custom',
        titulo: novaClausulaTitulo.trim(),
        numero: 100 + clausulaIds.length,
        corpo: novaClausulaCorpo.trim(),
      })
      if (r.error || !r.id) {
        setErroNovaClausula(r.error ?? 'Falha ao criar.')
        return
      }
      // Inclui na geração
      const r2 = await alternarClausulaNaGeracao(geracao.id, r.id, true)
      if (r2.error) {
        setErroNovaClausula(r2.error)
        return
      }
      setClausulaIds(prev => [...prev, r.id!])
      // Recarrega pra puxar a nova cláusula em todasClausulas
      router.refresh()
      setModalNovaClausula(false)
      setNovaClausulaTitulo('')
      setNovaClausulaCorpo('')
    })
  }

  const onBlurSeguradora = () => {
    if (textoSeguradora === geracao.clausulas_seguradora_texto) return
    startTransition(async () => {
      const r = await atualizarClausulasSeguradora(geracao.id, textoSeguradora)
      if (r.error) setErro(r.error)
    })
  }

  // Mapa pra resolver id -> cláusula
  const mapaClausulas = new Map(todasClausulas.map(c => [c.id, c]))
  const clausulasSelecionadas = clausulaIds.map(id => mapaClausulas.get(id)).filter((c): c is ClausulaLista => !!c)
  const clausulasDisponiveis = todasClausulas.filter(c => !clausulaIds.includes(c.id))

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
      const r = await atualizarOrdemClausulas(geracao.id, novaOrdem)
      if (r.error) setErro(r.error)
    })
  }

  const onChangeOpcoes = (mudancas: Partial<{ tipo_seguro_incendio: typeof tipoSeguroIncendio; saida_sem_multa_12m: boolean }>) => {
    setErro('')
    const novoIncendio = mudancas.tipo_seguro_incendio ?? tipoSeguroIncendio
    const novoSemMulta = mudancas.saida_sem_multa_12m ?? saidaSemMulta12m
    setTipoSeguroIncendio(novoIncendio)
    setSaidaSemMulta12m(novoSemMulta)
    startTransition(async () => {
      const r = await atualizarOpcoesGeracao(geracao.id, {
        tipo_seguro_incendio: novoIncendio,
        saida_sem_multa_12m: novoSemMulta,
      })
      if (r.error) { setErro(r.error); return }
      if (r.clausula_ids) setClausulaIds(r.clausula_ids)
    })
  }

  const onAtualizarClausula = (id: string, novoTitulo: string, novoCorpo: string) => {
    const c = mapaClausulas.get(id)
    if (!c) return
    startTransition(async () => {
      const r = await atualizarClausula(id, {
        tipo: c.tipo,
        categoria: c.categoria,
        titulo: novoTitulo,
        numero: c.numero,
        corpo: novoCorpo,
      })
      if (r.error) { setErro(r.error); return }
      // Atualiza o estado local
      const novaCl = { ...c, titulo: novoTitulo, corpo: novoCorpo }
      mapaClausulas.set(id, novaCl)
      // Forçar re-render: recriando a referência do array
      setClausulaIds([...clausulaIds])
    })
  }

  const onRemover = (id: string) => {
    setClausulaIds(curr => curr.filter(x => x !== id))
    startTransition(async () => {
      const r = await alternarClausulaNaGeracao(geracao.id, id, false)
      if (r.error) setErro(r.error)
    })
  }

  const onIncluir = (id: string) => {
    setClausulaIds(curr => [...curr, id])
    startTransition(async () => {
      const r = await alternarClausulaNaGeracao(geracao.id, id, true)
      if (r.error) setErro(r.error)
    })
  }

  const pdfUrl = `/api/contratos/${geracao.id}/pdf`

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      {/* Sidebar */}
      <aside className="space-y-4">
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Settings size={12} /> Opções do contrato
          </h2>

          <div>
            <label className="text-[11px] font-semibold text-gray-600 block mb-1">Garantia</label>
            <div className="text-sm bg-gray-50 px-3 py-2 rounded-lg border border-gray-100 text-gray-900">
              {LABEL_GARANTIA[garantiaTipo] ?? garantiaTipo}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Definido no cadastro do contrato.</p>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-600 block mb-1">Seguro incêndio</label>
            <select
              value={tipoSeguroIncendio}
              onChange={e => onChangeOpcoes({ tipo_seguro_incendio: e.target.value as typeof tipoSeguroIncendio })}
              disabled={isPending}
              className={inputCls}
            >
              <option value="dispensado">Dispensado</option>
              <option value="cobrado_parte">Cobrado à parte</option>
              <option value="embutido_pacote">Embutido no pacote</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1">Troca a cláusula correspondente.</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saidaSemMulta12m}
              onChange={e => onChangeOpcoes({ saida_sem_multa_12m: e.target.checked })}
              disabled={isPending}
              className="accent-violet-600"
            />
            <span className="text-sm text-gray-700">Saída sem multa após 12 meses</span>
          </label>

          <div className="pt-3 border-t border-gray-100">
            <p className="text-[10px] text-gray-400">
              Encargos inclusos no aluguel (IPTU/condomínio/água/luz/gás/internet) são definidos
              no <strong>cadastro do contrato</strong> e injetam a variante "pacote" das cláusulas
              7 e 16 automaticamente.
            </p>
          </div>
        </section>

        {/* Testemunhas — escolhe até 2 dos cadastros de pessoas */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Testemunhas</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Até 2 — escolhidas aparecem com nome e CPF no PDF.
            </p>
          </div>
          {pessoasOrdenadas.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Nenhuma pessoa cadastrada ainda.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
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
                      onChange={() => onToggleTestemunha(p.id)}
                      disabled={isPending || (!selecionada && testemunhaIds.length >= 2)}
                      className="accent-violet-600 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{p.nome}</p>
                      <p className="text-[10px] text-gray-500">
                        {p.tipo === 'testemunha' && <span className="text-violet-600 font-bold">testemunha · </span>}
                        {p.cpf_cnpj ? `CPF ${p.cpf_cnpj.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')}` : 'sem CPF'}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
          <p className="text-[10px] text-gray-400">
            Selecionadas: <strong>{testemunhaIds.length}/2</strong>
          </p>
        </section>

        {/* Cláusulas da seguradora — só quando garantia = seguro_fianca */}
        {garantiaTipo === 'seguro_fianca' && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Cláusulas da seguradora</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Cole aqui o texto que a seguradora fornece (Porto, Tokio, etc.). Aparece antes da folha de assinatura.
              </p>
            </div>
            <textarea
              value={textoSeguradora}
              onChange={e => setTextoSeguradora(e.target.value)}
              onBlur={onBlurSeguradora}
              rows={6}
              placeholder="Cláusulas próprias da seguradora..."
              className="w-full text-xs font-mono leading-relaxed border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
            />
            {textoSeguradora && (
              <p className="text-[10px] text-green-700">✓ Texto salvo ao sair do campo</p>
            )}
          </section>
        )}

        {/* Anexos — PDFs/imagens das partes incluídos ao final do contrato */}
        {documentosPartes.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <FileDown size={12} /> Anexos pro contrato
              </h2>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Documentos das partes que vão ao final do PDF (RG, comprovantes, etc.).
              </p>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1">
              {documentosPartes.map(d => {
                const sel = anexoIds.includes(d.id)
                return (
                  <label
                    key={d.id}
                    className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      sel ? 'bg-violet-50 border border-violet-300' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={() => onToggleAnexo(d.id)}
                      disabled={isPending}
                      className="accent-violet-600 mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {d.nome_original}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        <span className="font-mono uppercase">{d.tipo}</span> · {d.pessoa_nome}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400">
              Selecionados: <strong>{anexoIds.length}</strong>
            </p>
          </section>
        )}

        {/* Contrato assinado — upload do PDF assinado */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <FileCheck size={12} /> Contrato assinado
            </h2>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Depois de assinar (ZapSign, Gov.br, físico), sobe o PDF assinado aqui.
            </p>
          </div>

          {pdfAssinadoUrl ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-green-800">
                <CheckCircle2 size={14} />
                <span className="text-xs font-semibold">Assinado</span>
                {assinadoEm && (
                  <span className="text-[10px] text-green-700/80">
                    em {new Date(assinadoEm).toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <a
                  href={pdfAssinadoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 rounded"
                >
                  <Eye size={11} /> Abrir
                </a>
                <button
                  type="button"
                  onClick={onRemoverAssinado}
                  disabled={isPending}
                  className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded"
                >
                  Remover
                </button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-violet-200 rounded-lg cursor-pointer hover:bg-violet-50 transition-colors">
              <Upload size={16} className="text-violet-600 mb-1" />
              <span className="text-xs font-semibold text-violet-700">Anexar PDF assinado</span>
              <span className="text-[10px] text-gray-400 mt-0.5">Máx. 20MB · só PDF</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={e => onSelecionarPdfAssinado(e.target.files?.[0] ?? null)}
                disabled={isPending}
              />
            </label>
          )}
          {erroUpload && (
            <p className="text-[11px] text-red-600 flex items-start gap-1">
              <AlertCircle size={11} className="mt-0.5 shrink-0" /> {erroUpload}
            </p>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Resumo</h2>
          <ul className="text-xs text-gray-600 space-y-1">
            <li><strong>{clausulasSelecionadas.length}</strong> cláusulas no contrato</li>
            <li><strong>{clausulasDisponiveis.length}</strong> disponíveis pra adicionar</li>
            <li><strong>{testemunhaIds.length}/2</strong> testemunhas</li>
            <li>Status: <strong className="capitalize">{statusGeracao}</strong></li>
          </ul>
        </section>

        <div className="grid gap-2">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-3 rounded-xl"
          >
            <Eye size={14} /> Visualizar PDF
          </a>
          <a
            href={pdfUrl}
            download={`contrato-${codigo}.pdf`}
            className="flex items-center justify-center gap-1.5 bg-white hover:bg-violet-50 text-violet-700 text-sm font-semibold px-4 py-2.5 rounded-xl border border-violet-200"
          >
            <FileDown size={14} /> Baixar PDF
          </a>
          {statusGeracao === 'rascunho' && (
            <button
              type="button"
              onClick={() => {
                startTransition(async () => {
                  const r = await marcarComoGerado(geracao.id)
                  if (r.error) { setErro(r.error); return }
                  setStatusGeracao('gerado')
                })
              }}
              disabled={isPending}
              className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Marcar como gerado
            </button>
          )}
        </div>
      </aside>

      {/* Editor */}
      <section className="space-y-2">
        {erro && (
          <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle size={14} className="mt-0.5 shrink-0" /> {erro}
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={clausulaIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {clausulasSelecionadas.map((c, idx) => (
                <ClausulaCardEditor
                  key={c.id}
                  numero={idx + 1}
                  clausula={c}
                  isPending={isPending}
                  onSalvar={(t, b) => onAtualizarClausula(c.id, t, b)}
                  onRemover={() => onRemover(c.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {clausulasSelecionadas.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
            Nenhuma cláusula selecionada. Use &ldquo;Adicionar cláusula&rdquo; abaixo.
          </div>
        )}

        {/* Adicionais */}
        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMostrarAdicionais(v => !v)}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 py-3 rounded-xl border-2 border-dashed border-violet-200"
          >
            <Plus size={13} /> {mostrarAdicionais ? 'Esconder' : 'Adicionar'} do banco ({clausulasDisponiveis.length})
          </button>
          <button
            type="button"
            onClick={() => { setModalNovaClausula(true); setNovaClausulaTitulo(''); setNovaClausulaCorpo(''); setErroNovaClausula('') }}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 py-3 rounded-xl border-2 border-dashed border-amber-300"
          >
            <Plus size={13} /> Criar cláusula nova
          </button>
        </div>

        {mostrarAdicionais && (
          <div className="mt-2 space-y-1.5">
            {clausulasDisponiveis.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => onIncluir(c.id)}
                disabled={isPending}
                className="w-full text-left bg-white hover:bg-violet-50 border border-gray-200 hover:border-violet-300 rounded-lg p-3 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {c.tipo === 'generica' ? 'geral' : c.tipo}
                    </span>
                    <span className="text-[9px] text-gray-400">{c.categoria}</span>
                  </div>
                  <Plus size={12} className="text-violet-600 shrink-0" />
                </div>
                <p className="text-xs font-semibold text-gray-900">{c.titulo}</p>
                <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{c.corpo.slice(0, 100)}…</p>
              </button>
            ))}
            {clausulasDisponiveis.length === 0 && (
              <p className="text-xs text-center text-gray-400 py-4">Todas as cláusulas já estão no contrato.</p>
            )}
          </div>
        )}

        {/* Modal: criar cláusula nova inline */}
        {modalNovaClausula && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !isPending && setModalNovaClausula(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Nova cláusula adicional</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Cria no banco como tipo &ldquo;adicional&rdquo; e já inclui neste contrato.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalNovaClausula(false)}
                  disabled={isPending}
                  className="p-1 text-gray-400 hover:text-gray-700"
                >
                  <X size={16} />
                </button>
              </div>

              <label className="block text-xs font-semibold text-gray-600 mb-1">Título</label>
              <input
                type="text"
                value={novaClausulaTitulo}
                onChange={e => setNovaClausulaTitulo(e.target.value)}
                placeholder="Ex: Da revisão extraordinária do aluguel"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm mb-3"
              />

              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Corpo da cláusula <span className="text-gray-400 font-normal">(pode usar placeholders {'{{X}}'})</span>
              </label>
              <textarea
                value={novaClausulaCorpo}
                onChange={e => setNovaClausulaCorpo(e.target.value)}
                rows={8}
                placeholder="Texto completo da cláusula..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-xs font-mono leading-relaxed resize-y"
              />

              {erroNovaClausula && (
                <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                  <AlertCircle size={11} /> {erroNovaClausula}
                </p>
              )}

              <div className="flex gap-2 mt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setModalNovaClausula(false)}
                  disabled={isPending}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={onCriarClausulaInline}
                  disabled={isPending || !novaClausulaTitulo.trim() || !novaClausulaCorpo.trim()}
                  className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                >
                  {isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Criar e adicionar
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

// ── Card de uma cláusula no editor (sortable + editável) ──
function ClausulaCardEditor({
  numero, clausula, isPending, onSalvar, onRemover,
}: {
  numero: number
  clausula: ClausulaLista
  isPending: boolean
  onSalvar: (titulo: string, corpo: string) => void
  onRemover: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [titulo, setTitulo] = useState(clausula.titulo)
  const [corpo, setCorpo] = useState(clausula.corpo)

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: clausula.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl border ${editando ? 'border-violet-300 shadow-sm' : 'border-gray-200'} overflow-hidden`}
    >
      <div className="flex items-start gap-1 px-3 py-2 bg-gray-50 border-b border-gray-100">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 p-1 -ml-1 touch-none"
          aria-label="Arrastar pra reordenar"
        >
          <GripVertical size={14} />
        </button>
        <span className="text-xs font-mono font-bold text-violet-700 px-1.5">
          {numero}.
        </span>
        {editando ? (
          <input
            type="text"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            className="flex-1 text-sm font-bold text-gray-900 bg-white border border-violet-200 px-2 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        ) : (
          <h3 className="flex-1 text-sm font-bold text-gray-900 py-0.5">
            {clausula.titulo}
          </h3>
        )}
        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded shrink-0">
          {clausula.tipo === 'generica' ? 'geral' : clausula.tipo}
        </span>
      </div>

      <div className="p-3">
        {editando ? (
          <>
            <textarea
              value={corpo}
              onChange={e => setCorpo(e.target.value)}
              rows={Math.max(6, Math.min(20, corpo.split('\n').length + 1))}
              className="w-full text-xs font-mono leading-relaxed border border-gray-200 rounded p-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
            />
            <p className="text-[10px] text-amber-700 mt-1">
              ⚠️ Editar aqui altera a cláusula no seu banco — vai refletir em todos os contratos futuros.
            </p>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => { onSalvar(titulo, corpo); setEditando(false) }}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg"
              >
                {isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Salvar
              </button>
              <button
                type="button"
                onClick={() => { setTitulo(clausula.titulo); setCorpo(clausula.corpo); setEditando(false) }}
                disabled={isPending}
                className="px-3 text-xs text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed line-clamp-4">
              {clausula.corpo}
            </p>
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="text-xs font-semibold text-violet-700 hover:bg-violet-50 px-2 py-1 rounded"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={onRemover}
                disabled={isPending}
                className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded disabled:opacity-50"
                title="Remover deste contrato (não exclui do banco)"
              >
                <X size={12} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const LABEL_GARANTIA: Record<string, string> = {
  sem_garantia: 'Sem garantia',
  caucao: 'Caução em dinheiro',
  fiador: 'Fiador',
  seguro_fianca: 'Seguro fiança',
}
