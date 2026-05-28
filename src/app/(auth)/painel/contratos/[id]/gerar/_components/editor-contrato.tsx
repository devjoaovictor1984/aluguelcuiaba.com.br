'use client'

import { useState, useTransition, useMemo } from 'react'
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
  Settings, Eye, Upload, FileCheck, CheckCircle2, Star, Key,
} from 'lucide-react'
import { atualizarClausula, criarClausula } from '../../../clausulas/actions'
import {
  atualizarOpcoesGeracao, atualizarOrdemClausulas, alternarClausulaNaGeracao,
  atualizarTestemunhas, atualizarClausulasSeguradora,
  uploadContratoAssinado, removerContratoAssinado,
  atualizarAnexosDocumentos, marcarComoGerado, atualizarItensEntrega,
} from '../actions'
import type { TipoClausula } from '@/lib/contratos/placeholders'
import { PLACEHOLDERS } from '@/lib/contratos/placeholders'
import { ProgressoContrato } from './progresso-contrato'
import { SECOES_ESSENCIAIS, isCategoriaEssencial } from '@/lib/contratos/secoes-essenciais'

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
  qtdChavesInicial?: number
  qtdControlesInicial?: number
  qtdTagsInicial?: number
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

export function EditorContrato({ contratoId, codigo, garantiaTipo, qtdChavesInicial, qtdControlesInicial, qtdTagsInicial, geracao, todasClausulas, pessoas, documentosPartes }: Props) {
  const router = useRouter()
  const [tipoSeguroIncendio, setTipoSeguroIncendio] = useState(geracao.tipo_seguro_incendio)
  const [saidaSemMulta12m, setSaidaSemMulta12m] = useState(geracao.saida_sem_multa_12m)
  const [clausulaIds, setClausulaIds] = useState(geracao.clausula_ids)
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

  // Itens entregues (vão pro Termo de Entrega de Chaves no PDF)
  const [qtdChaves, setQtdChaves] = useState(String(qtdChavesInicial ?? 0))
  const [qtdControles, setQtdControles] = useState(String(qtdControlesInicial ?? 0))
  const [qtdTags, setQtdTags] = useState(String(qtdTagsInicial ?? 0))

  const onChangeItensEntrega = (campo: 'chaves' | 'controles' | 'tags', valor: string) => {
    if (campo === 'chaves') setQtdChaves(valor)
    if (campo === 'controles') setQtdControles(valor)
    if (campo === 'tags') setQtdTags(valor)
  }

  const persistirItensEntrega = () => {
    const qc = parseInt(qtdChaves) || 0
    const qr = parseInt(qtdControles) || 0
    const qt = parseInt(qtdTags) || 0
    // Salva apenas se mudou de fato (evita request desnecessário)
    if (qc === (qtdChavesInicial ?? 0) && qr === (qtdControlesInicial ?? 0) && qt === (qtdTagsInicial ?? 0)) return
    startTransition(async () => {
      const r = await atualizarItensEntrega(contratoId, { qtd_chaves: qc, qtd_controles: qr, qtd_tags: qt })
      if (r.error) setErro(r.error)
    })
  }

  // Seção essencial a vincular à nova cláusula. 'nao' = adicional (não conta no progresso).
  // Os outros valores são ids de SECOES_ESSENCIAIS — a primeira categoria daquela seção é usada.
  const [novaClausulaSecao, setNovaClausulaSecao] = useState<string>('nao')

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
    // Resolve categoria/tipo conforme escolha de seção essencial
    let tipoEscolhido: TipoClausula = 'adicional'
    let categoriaEscolhida = 'custom'
    if (novaClausulaSecao !== 'nao') {
      const sec = SECOES_ESSENCIAIS.find(s => s.id === novaClausulaSecao)
      if (sec) {
        categoriaEscolhida = sec.categorias[0]
        // tipo da cláusula = 'generica' por padrão, mas algumas seções têm tipos próprios
        if (sec.id === 'fundamentacao') tipoEscolhido = 'fundamentacao'
        else if (sec.id === 'garantia') tipoEscolhido = 'adicional' // user escolhe garantia depois
        else tipoEscolhido = 'generica'
      }
    }
    startTransition(async () => {
      const r = await criarClausula({
        tipo: tipoEscolhido,
        categoria: categoriaEscolhida,
        titulo: novaClausulaTitulo.trim(),
        numero: 100 + clausulaIds.length,
        corpo: novaClausulaCorpo.trim(),
      })
      if (r.error || !r.id) {
        setErroNovaClausula(r.error ?? 'Falha ao criar.')
        return
      }
      const r2 = await alternarClausulaNaGeracao(geracao.id, r.id, true)
      if (r2.error) {
        setErroNovaClausula(r2.error)
        return
      }
      setClausulaIds(prev => [...prev, r.id!])
      router.refresh()
      setModalNovaClausula(false)
      setNovaClausulaTitulo('')
      setNovaClausulaCorpo('')
      setNovaClausulaSecao('nao')
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

  const onAtualizarClausula = (
    id: string,
    novoTitulo: string,
    novoCorpo: string,
    novaCategoria?: string,
    novoTipo?: TipoClausula,
  ) => {
    const c = mapaClausulas.get(id)
    if (!c) return
    const tipoFinal = novoTipo ?? c.tipo
    const categoriaFinal = novaCategoria ?? c.categoria
    startTransition(async () => {
      const r = await atualizarClausula(id, {
        tipo: tipoFinal,
        categoria: categoriaFinal,
        titulo: novoTitulo,
        numero: c.numero,
        corpo: novoCorpo,
      })
      if (r.error) { setErro(r.error); return }
      const novaCl = { ...c, titulo: novoTitulo, corpo: novoCorpo, tipo: tipoFinal, categoria: categoriaFinal }
      mapaClausulas.set(id, novaCl)
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

  const categoriasIncluidas = clausulasSelecionadas.map(c => c.categoria)

  return (
    <div className="space-y-4">
      {/* Barra de progresso gamificada */}
      <ProgressoContrato
        categoriasIncluidas={categoriasIncluidas}
        totalClausulas={clausulasSelecionadas.length}
        status={statusGeracao}
      />

      <div className="grid lg:grid-cols-[260px_300px_1fr] gap-4">
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
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <FileDown size={12} /> Anexos pro contrato
            </h2>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Documentos das partes que vão ao final do PDF (RG, comprovantes, etc.).
            </p>
          </div>

          {documentosPartes.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800 space-y-1">
              <p className="font-semibold">Nenhum documento cadastrado ainda.</p>
              <p>
                Pra anexar RG, CPF, comprovante de renda ou outros documentos no final do contrato,
                vai em <strong>Clientes</strong> → abre a pessoa (locador / locatário / fiador) →
                sobe os arquivos na seção <strong>Documentos</strong>.
              </p>
              <p>
                Voltando aqui, os arquivos aparecem listados — você marca quais vão no PDF.
              </p>
            </div>
          ) : (
            <>
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
                Selecionados: <strong>{anexoIds.length}</strong> · vão no final do PDF na ordem listada.
              </p>
            </>
          )}
        </section>

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

        {/* Itens entregues — vão no Termo de Entrega de Chaves */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Key size={12} /> Itens entregues
          </h2>
          <p className="text-[10px] text-gray-400 -mt-1">Vão no Termo de Entrega de Chaves do PDF.</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-gray-600 block mb-0.5">Chaves</label>
              <input
                type="number"
                min={0}
                max={50}
                value={qtdChaves}
                onChange={e => onChangeItensEntrega('chaves', e.target.value)}
                onBlur={persistirItensEntrega}
                disabled={isPending}
                className="w-full px-2 py-1.5 text-sm text-center rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-600 block mb-0.5">Controles</label>
              <input
                type="number"
                min={0}
                max={50}
                value={qtdControles}
                onChange={e => onChangeItensEntrega('controles', e.target.value)}
                onBlur={persistirItensEntrega}
                disabled={isPending}
                className="w-full px-2 py-1.5 text-sm text-center rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-600 block mb-0.5">Tags</label>
              <input
                type="number"
                min={0}
                max={50}
                value={qtdTags}
                onChange={e => onChangeItensEntrega('tags', e.target.value)}
                onBlur={persistirItensEntrega}
                disabled={isPending}
                className="w-full px-2 py-1.5 text-sm text-center rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>
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

      {/* Catálogo de cláusulas disponíveis (sempre visível) */}
      <CatalogoDisponiveis
        clausulas={clausulasDisponiveis}
        isPending={isPending}
        onIncluir={onIncluir}
        onCriarNova={() => { setModalNovaClausula(true); setNovaClausulaTitulo(''); setNovaClausulaCorpo(''); setErroNovaClausula('') }}
      />

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
                  onSalvar={(t, b, cat, tp) => onAtualizarClausula(c.id, t, b, cat, tp)}
                  onRemover={() => onRemover(c.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {clausulasSelecionadas.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
            Contrato em branco. Use o catálogo à esquerda pra adicionar cláusulas.
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
                Esta cláusula cobre uma seção essencial?
                <span className="text-gray-400 font-normal ml-1">(conta no progresso do contrato)</span>
              </label>
              <select
                value={novaClausulaSecao}
                onChange={e => setNovaClausulaSecao(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm mb-3"
              >
                <option value="nao">Não — é adicional (não conta no progresso)</option>
                {SECOES_ESSENCIAIS.map(s => (
                  <option key={s.id} value={s.id}>⭐ {s.label}</option>
                ))}
              </select>

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
  onSalvar: (titulo: string, corpo: string, categoria?: string, tipo?: TipoClausula) => void
  onRemover: () => void
}) {
  const [modalAberto, setModalAberto] = useState(false)

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: clausula.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`bg-white rounded-xl border overflow-hidden transition-colors ${
          isCategoriaEssencial(clausula.categoria)
            ? 'border-amber-200 hover:border-amber-300'
            : 'border-gray-200 hover:border-violet-300'
        }`}
      >
        <div className={`flex items-start gap-1 px-3 py-2 border-b border-gray-100 ${
          isCategoriaEssencial(clausula.categoria) ? 'bg-amber-50' : 'bg-gray-50'
        }`}>
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
          {isCategoriaEssencial(clausula.categoria) && (
            <span title="Cláusula essencial">
              <Star size={11} className="text-amber-600 fill-amber-400 mt-1" />
            </span>
          )}
          <h3 className="flex-1 text-sm font-bold text-gray-900 py-0.5">
            {clausula.titulo}
          </h3>
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded shrink-0">
            {clausula.tipo === 'generica' ? 'geral' : clausula.tipo}
          </span>
        </div>

        <div className="p-3">
          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed line-clamp-4">
            {clausula.corpo}
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setModalAberto(true)}
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
        </div>
      </div>

      {modalAberto && (
        <ModalEdicaoClausula
          clausula={clausula}
          isPending={isPending}
          onFechar={() => setModalAberto(false)}
          onSalvar={(t, b, cat, tp) => { onSalvar(t, b, cat, tp); setModalAberto(false) }}
        />
      )}
    </>
  )
}

// ── Modal de edição da cláusula com sidebar de placeholders ──
function ModalEdicaoClausula({
  clausula, isPending, onSalvar, onFechar,
}: {
  clausula: ClausulaLista
  isPending: boolean
  onSalvar: (titulo: string, corpo: string, categoria?: string, tipo?: TipoClausula) => void
  onFechar: () => void
}) {
  const [titulo, setTitulo] = useState(clausula.titulo)
  const [corpo, setCorpo] = useState(clausula.corpo)
  const [copiado, setCopiado] = useState<string | null>(null)
  // Pré-seleciona seção essencial atual (ou 'nao' = não conta no progresso)
  const secaoAtualId = SECOES_ESSENCIAIS.find(s => s.categorias.includes(clausula.categoria))?.id ?? 'nao'
  const [secaoEscolhida, setSecaoEscolhida] = useState<string>(secaoAtualId)

  const copiarPlaceholder = async (chave: string) => {
    const txt = `{{${chave}}}`
    try {
      await navigator.clipboard.writeText(txt)
      setCopiado(chave)
      setTimeout(() => setCopiado(null), 1200)
    } catch {
      // fallback silencioso
    }
  }

  // Agrupa placeholders por origem pra UI mais navegável
  const grupos = PLACEHOLDERS.reduce<Record<string, typeof PLACEHOLDERS>>((acc, p) => {
    if (!acc[p.origem]) acc[p.origem] = []
    acc[p.origem].push(p)
    return acc
  }, {})

  const labelOrigem: Record<string, string> = {
    locador: 'Locador',
    locatario: 'Locatário',
    conjuge_locatario: 'Cônjuge',
    admin: 'Administradora',
    imovel: 'Imóvel',
    valores: 'Valores',
    prazo: 'Prazo',
    garantia: 'Garantia',
    fiador: 'Fiador',
    seguro: 'Seguro',
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => !isPending && onFechar()}
    >
      <div
        className="bg-white rounded-2xl max-w-5xl w-full shadow-xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 p-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Editar cláusula</h2>
            <p className="text-[11px] text-amber-700 mt-0.5">
              ⚠️ Altera a cláusula no <strong>seu</strong> banco (privado, não afeta outros usuários).
              Reflete neste contrato e em todos os <strong>futuros</strong> que usarem essa cláusula.
              Contratos já assinados (com PDF anexado) não mudam.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={isPending}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </header>

        {/* Body: split editor + placeholders */}
        <div className="grid lg:grid-cols-[1fr_240px] gap-0 flex-1 overflow-hidden">
          {/* Editor */}
          <div className="p-4 space-y-3 overflow-y-auto">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Título</label>
              <input
                type="text"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                className="w-full text-sm font-medium text-gray-900 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Esta cláusula cobre uma seção essencial?
                <span className="text-gray-400 font-normal ml-1">(conta no progresso do contrato)</span>
              </label>
              <select
                value={secaoEscolhida}
                onChange={e => setSecaoEscolhida(e.target.value)}
                className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="nao">Não — é adicional (não conta no progresso)</option>
                {SECOES_ESSENCIAIS.map(s => (
                  <option key={s.id} value={s.id}>⭐ {s.label}</option>
                ))}
              </select>
              {secaoEscolhida !== 'nao' && secaoEscolhida !== secaoAtualId && (
                <p className="text-[10px] text-amber-700 mt-1">
                  ⚠ Vai mudar a categoria dessa cláusula no seu banco — ela passará a contar como essa seção no progresso de futuros contratos.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Corpo</label>
              <textarea
                value={corpo}
                onChange={e => setCorpo(e.target.value)}
                rows={Math.max(10, Math.min(24, corpo.split('\n').length + 2))}
                className="w-full text-xs font-mono leading-relaxed border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Use placeholders <span className="font-mono">{'{{CHAVE}}'}</span> que serão substituídos no PDF.
              </p>
            </div>
          </div>

          {/* Sidebar de placeholders */}
          <aside className="border-t lg:border-t-0 lg:border-l border-gray-100 bg-gray-50 p-3 overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
              Placeholders disponíveis
            </p>
            <p className="text-[10px] text-gray-400 mb-3">
              Clique pra copiar e colar no corpo.
            </p>
            <div className="space-y-3">
              {Object.entries(grupos).map(([origem, lista]) => (
                <div key={origem}>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    {labelOrigem[origem] ?? origem}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {lista.map(p => (
                      <button
                        key={p.chave}
                        type="button"
                        onClick={() => copiarPlaceholder(p.chave)}
                        title={p.label + ' · Ex: ' + p.exemplo}
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                          copiado === p.chave
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-violet-50 hover:border-violet-300'
                        }`}
                      >
                        {copiado === p.chave ? '✓ copiado' : `{{${p.chave}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-end gap-2 p-3 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onFechar}
            disabled={isPending}
            className="text-xs text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              // Se trocou seção essencial, deriva nova categoria/tipo
              let cat: string | undefined = undefined
              let tp: TipoClausula | undefined = undefined
              if (secaoEscolhida !== secaoAtualId) {
                if (secaoEscolhida === 'nao') {
                  cat = 'custom'
                  tp = 'adicional'
                } else {
                  const sec = SECOES_ESSENCIAIS.find(s => s.id === secaoEscolhida)
                  if (sec) {
                    cat = sec.categorias[0]
                    tp = sec.id === 'fundamentacao' ? 'fundamentacao' : 'generica'
                  }
                }
              }
              onSalvar(titulo, corpo, cat, tp)
            }}
            disabled={isPending || !titulo.trim() || !corpo.trim()}
            className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Salvar
          </button>
        </footer>
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

// ── Catálogo de cláusulas disponíveis (coluna do meio) ──
function CatalogoDisponiveis({
  clausulas, isPending, onIncluir, onCriarNova,
}: {
  clausulas: ClausulaLista[]
  isPending: boolean
  onIncluir: (id: string) => void
  onCriarNova: () => void
}) {
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')

  const tipos = useMemo(() => {
    const set = new Set(clausulas.map(c => c.tipo))
    return Array.from(set)
  }, [clausulas])

  const filtradas = useMemo(() => {
    const b = busca.trim().toLowerCase()
    return clausulas.filter(c => {
      if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false
      if (!b) return true
      return (
        c.titulo.toLowerCase().includes(b) ||
        c.categoria.toLowerCase().includes(b) ||
        c.corpo.toLowerCase().includes(b)
      )
    })
  }, [clausulas, busca, filtroTipo])

  const labelTipo = (t: string): string => {
    if (t === 'generica') return 'Geral'
    if (t === 'atuacao') return 'Atuação'
    if (t === 'aluguel_pacote') return 'Aluguel pacote'
    if (t === 'fundamentacao') return 'Fundamentação'
    return t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')
  }

  return (
    <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col max-h-[85vh] overflow-hidden">
      <header className="p-3 border-b border-gray-100 space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Catálogo · {clausulas.length}
          </h2>
          <button
            type="button"
            onClick={onCriarNova}
            className="text-[11px] font-semibold text-amber-700 hover:bg-amber-50 px-2 py-1 rounded inline-flex items-center gap-1"
            title="Criar cláusula nova (banco do usuário)"
          >
            <Plus size={11} /> Nova
          </button>
        </div>
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por título…"
          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        {tipos.length > 1 && (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setFiltroTipo('todos')}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                filtroTipo === 'todos' ? 'bg-violet-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            {tipos.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setFiltroTipo(t)}
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                  filtroTipo === t ? 'bg-violet-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {labelTipo(t)}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filtradas.length === 0 ? (
          <p className="text-xs text-center text-gray-400 py-8">
            {clausulas.length === 0
              ? 'Todas as cláusulas já estão no contrato.'
              : 'Nenhuma encontrada com este filtro.'}
          </p>
        ) : (
          filtradas.map(c => {
            const essencial = isCategoriaEssencial(c.categoria)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onIncluir(c.id)}
                disabled={isPending}
                className={`w-full text-left hover:shadow-sm rounded-lg p-2.5 transition-all disabled:opacity-50 group border ${
                  essencial
                    ? 'bg-amber-50 border-amber-200 hover:bg-amber-100 hover:border-amber-300'
                    : 'bg-gray-50 border-gray-100 hover:bg-violet-50 hover:border-violet-300'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5 mb-1">
                  <div className="flex items-center gap-1">
                    {essencial && (
                      <span title="Cláusula essencial — conta no progresso do contrato">
                        <Star size={11} className="text-amber-600 fill-amber-400" />
                      </span>
                    )}
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                      essencial ? 'text-amber-700 bg-white border-amber-200' : 'text-gray-400 bg-white border-gray-200'
                    }`}>
                      {labelTipo(c.tipo)}
                    </span>
                  </div>
                  <Plus size={12} className={`shrink-0 mt-0.5 ${essencial ? 'text-amber-400 group-hover:text-amber-700' : 'text-gray-300 group-hover:text-violet-700'}`} />
                </div>
                <p className="text-xs font-semibold text-gray-900 line-clamp-2">{c.titulo}</p>
                <p className="text-[10px] text-gray-500 line-clamp-2 mt-1">{c.corpo.slice(0, 120)}…</p>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
