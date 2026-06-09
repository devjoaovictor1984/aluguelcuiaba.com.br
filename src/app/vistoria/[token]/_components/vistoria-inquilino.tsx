'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import Image from 'next/image'
import {
  Camera, Pencil, AlertCircle, Loader2, Check, X, MessageSquare, Plus, AlertTriangle,
} from 'lucide-react'
import { LABEL_ESTADO, COR_ESTADO, type EstadoItem } from '@/lib/vistorias/modelos'
import { CapturaSelfie } from '@/components/captura-selfie'
import {
  inquilinoObservacaoItem, inquilinoUploadFoto, inquilinoAssinar, inquilinoRecusar,
  inquilinoAdicionarProblema, inquilinoContestarQuantidades,
} from '../actions'

export interface ItemPub {
  id: string
  comodo: string
  item: string
  estado: EstadoItem
  observacao: string | null
  observacao_inquilino: string | null
  ordem: number
  origem?: 'corretor' | 'inquilino'
}

export interface FotoPub {
  id: string
  vistoria_item_id: string | null
  url: string
  origem: 'corretor' | 'inquilino'
  legenda: string | null
}

interface Props {
  token: string
  tipo: 'entrada' | 'saida'
  observacoesGerais: string | null
  qtdChaves: number
  qtdControles: number
  qtdChavesInquilino?: number | null
  qtdControlesInquilino?: number | null
  itens: ItemPub[]
  fotos: FotoPub[]
  /** Modo pré-visualização: todas as ações viram no-op com alert. */
  previewMode?: boolean
}

export function VistoriaInquilino({ token, observacoesGerais, qtdChaves, qtdControles, qtdChavesInquilino, qtdControlesInquilino, itens: itensIniciais, fotos: fotosIniciais, previewMode = false }: Props) {
  const [itens, setItens] = useState(itensIniciais)
  const [fotos, setFotos] = useState(fotosIniciais)
  const [observacoesFinal, setObservacoesFinal] = useState('')
  const [selfie, setSelfie] = useState<string | null>(null)
  const [recusarMotivo, setRecusarMotivo] = useState('')
  const [mostrarRecusa, setMostrarRecusa] = useState(false)
  const [assinado, setAssinado] = useState(false)
  const [recusado, setRecusado] = useState(false)
  const [erroGlobal, setErroGlobal] = useState('')
  const [isPending, startTransition] = useTransition()

  // Reportar problema novo: qual cômodo está com form aberto, texto e foto pendente
  const [reportandoComodo, setReportandoComodo] = useState<string | null>(null)
  const [reportDescricao, setReportDescricao] = useState('')
  const [reportFoto, setReportFoto] = useState<File | null>(null)
  const [reportErro, setReportErro] = useState('')

  // Contestar quantidades de chaves/controles
  const [contestandoQtd, setContestandoQtd] = useState(false)
  const [qtdChavesEdit, setQtdChavesEdit] = useState<number>(qtdChavesInquilino ?? qtdChaves)
  const [qtdControlesEdit, setQtdControlesEdit] = useState<number>(qtdControlesInquilino ?? qtdControles)
  const [qtdContestadaChaves, setQtdContestadaChaves] = useState<number | null>(qtdChavesInquilino ?? null)
  const [qtdContestadaControles, setQtdContestadaControles] = useState<number | null>(qtdControlesInquilino ?? null)
  const [qtdErro, setQtdErro] = useState('')

  const grupos = itens.reduce<Record<string, ItemPub[]>>((acc, it) => {
    if (!acc[it.comodo]) acc[it.comodo] = []
    acc[it.comodo].push(it)
    return acc
  }, {})
  const fotosPorItem = fotos.reduce<Record<string, FotoPub[]>>((acc, f) => {
    const key = f.vistoria_item_id ?? '__geral__'
    if (!acc[key]) acc[key] = []
    acc[key].push(f)
    return acc
  }, {})

  const onChangeObs = (itemId: string, valor: string) => {
    setItens(curr => curr.map(it => it.id === itemId ? { ...it, observacao_inquilino: valor } : it))
  }

  const avisoPreview = () => alert('🧪 Modo pré-visualização — nada é salvo. No envio real, isto ficaria gravado.')

  const onFoto = (item: ItemPub, file: File) => {
    if (previewMode) { avisoPreview(); return }
    const fd = new FormData()
    fd.set('vistoria_item_id', item.id)
    fd.set('file', file)
    startTransition(async () => {
      const r = await inquilinoUploadFoto(token, fd)
      if (r.error || !r.url) { alert(r.error ?? 'Falha ao subir foto.'); return }
      setFotos(curr => [...curr, { id: r.id!, vistoria_item_id: item.id, url: r.url!, origem: 'inquilino', legenda: null }])
    })
  }

  const salvarContestacaoQtd = () => {
    setQtdErro('')
    const c = Number.isFinite(qtdChavesEdit) ? Math.max(0, Math.floor(qtdChavesEdit)) : 0
    const ct = Number.isFinite(qtdControlesEdit) ? Math.max(0, Math.floor(qtdControlesEdit)) : 0
    if (c === qtdChaves && ct === qtdControles) {
      setQtdErro('Os números são iguais ao que o corretor declarou. Não precisa contestar.')
      return
    }
    if (previewMode) {
      avisoPreview()
      setContestandoQtd(false)
      return
    }
    startTransition(async () => {
      const r = await inquilinoContestarQuantidades(token, { qtd_chaves: c, qtd_controles: ct })
      if (r.error) { setQtdErro(r.error); return }
      setQtdContestadaChaves(c)
      setQtdContestadaControles(ct)
      setContestandoQtd(false)
    })
  }

  const limparContestacaoQtd = () => {
    if (previewMode) { avisoPreview(); return }
    startTransition(async () => {
      const r = await inquilinoContestarQuantidades(token, { qtd_chaves: null, qtd_controles: null })
      if (r.error) { setQtdErro(r.error); return }
      setQtdContestadaChaves(null)
      setQtdContestadaControles(null)
      setQtdChavesEdit(qtdChaves)
      setQtdControlesEdit(qtdControles)
      setContestandoQtd(false)
    })
  }

  const fecharReporte = () => {
    setReportandoComodo(null)
    setReportDescricao('')
    setReportFoto(null)
    setReportErro('')
  }

  const onReportarProblema = (comodo: string) => {
    setReportErro('')
    const desc = reportDescricao.trim()
    if (desc.length < 5) { setReportErro('Descreva o problema com mais detalhes (mín. 5 caracteres).'); return }
    if (previewMode) {
      avisoPreview()
      fecharReporte()
      return
    }
    const foto = reportFoto
    startTransition(async () => {
      const r = await inquilinoAdicionarProblema(token, { comodo, descricao: desc })
      if (r.error || !r.item) { setReportErro(r.error ?? 'Falha ao reportar.'); return }
      // Insere o novo item no estado local
      const novoItem: ItemPub = {
        id: r.item.id,
        comodo: r.item.comodo,
        item: r.item.item,
        estado: r.item.estado as EstadoItem,
        observacao: r.item.observacao,
        observacao_inquilino: r.item.observacao_inquilino,
        ordem: r.item.ordem,
        origem: 'inquilino',
      }
      setItens(curr => [...curr, novoItem])

      // Se tem foto, sobe vinculada ao item recém-criado
      if (foto) {
        const fd = new FormData()
        fd.set('vistoria_item_id', novoItem.id)
        fd.set('file', foto)
        const rFoto = await inquilinoUploadFoto(token, fd)
        if (!rFoto.error && rFoto.url && rFoto.id) {
          setFotos(curr => [...curr, {
            id: rFoto.id!, vistoria_item_id: novoItem.id, url: rFoto.url!,
            origem: 'inquilino', legenda: null,
          }])
        }
      }
      fecharReporte()
    })
  }

  // Salva observação no blur (debounced via blur natural)
  const onBlurObs = (itemId: string, valor: string) => {
    if (previewMode) return  // silenciosamente ignora — não polui com alerts
    startTransition(async () => {
      await inquilinoObservacaoItem(token, itemId, valor)
    })
  }

  /* ────────── Canvas de assinatura ─────────── */
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasVazio, setCanvasVazio] = useState(true)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    // Ajusta tamanho do canvas pro DPI do dispositivo
    const dpr = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = rect.width * dpr
    c.height = rect.height * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#1f2937'
  }, [])

  const desenhar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1 && e.pointerType !== 'touch' && e.pointerType !== 'pen') return
    const c = canvasRef.current!
    const rect = c.getBoundingClientRect()
    const ctx = c.getContext('2d')!
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (e.type === 'pointerdown') {
      ctx.beginPath()
      ctx.moveTo(x, y)
      setCanvasVazio(false)
    } else {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const limparCanvas = () => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    setCanvasVazio(true)
  }

  const assinar = () => {
    setErroGlobal('')
    if (canvasVazio) { setErroGlobal('Desenhe sua assinatura no quadro abaixo.'); return }
    if (previewMode) {
      alert('🧪 Pré-visualização — no envio real, aqui a vistoria seria assinada e fechada.\n\nO PDF final teria essa assinatura e a selfie embedadas, mais IP e data/hora.')
      return
    }
    if (!selfie) { setErroGlobal('Tire a selfie antes de assinar.'); return }
    const c = canvasRef.current!
    const dataUrl = c.toDataURL('image/png')
    startTransition(async () => {
      const r = await inquilinoAssinar(token, { assinatura_dataurl: dataUrl, selfie_dataurl: selfie, observacoes: observacoesFinal })
      if (r.error) { setErroGlobal(r.error); return }
      setAssinado(true)
    })
  }

  const recusar = () => {
    setErroGlobal('')
    if (!recusarMotivo.trim()) { setErroGlobal('Diga por que está recusando.'); return }
    if (previewMode) {
      alert('🧪 Pré-visualização — no envio real, a vistoria ficaria com status "recusada" e o motivo apareceria no painel.')
      return
    }
    startTransition(async () => {
      const r = await inquilinoRecusar(token, recusarMotivo)
      if (r.error) { setErroGlobal(r.error); return }
      setRecusado(true)
    })
  }

  if (assinado) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Check size={28} className="text-green-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Obrigado!</h2>
        <p className="text-sm text-gray-500">Sua assinatura foi registrada. Pode fechar essa página.</p>
      </div>
    )
  }

  if (recusado) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={28} className="text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Recusa registrada</h2>
        <p className="text-sm text-gray-500">O anunciante foi avisado. Entrem em contato pra ajustar e enviar uma nova vistoria.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs text-violet-900 space-y-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p>
            <strong>{qtdChaves}</strong> chave{qtdChaves === 1 ? '' : 's'} · <strong>{qtdControles}</strong> controle{qtdControles === 1 ? '' : 's'}
            <span className="block text-[10px] text-violet-700/80 mt-0.5">declarado pelo corretor</span>
          </p>
          {!contestandoQtd && (
            <button
              type="button"
              onClick={() => setContestandoQtd(true)}
              className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 underline underline-offset-2"
            >
              {qtdContestadaChaves !== null || qtdContestadaControles !== null ? 'Editar contestação' : 'Está diferente?'}
            </button>
          )}
        </div>

        {(qtdContestadaChaves !== null || qtdContestadaControles !== null) && !contestandoQtd && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-900">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 mb-0.5">
              Você confirmou
            </p>
            <p>
              <strong>{qtdContestadaChaves ?? qtdChaves}</strong> chave{(qtdContestadaChaves ?? qtdChaves) === 1 ? '' : 's'} ·{' '}
              <strong>{qtdContestadaControles ?? qtdControles}</strong> controle{(qtdContestadaControles ?? qtdControles) === 1 ? '' : 's'}
            </p>
            <button
              type="button"
              onClick={limparContestacaoQtd}
              disabled={isPending}
              className="text-[10px] text-amber-700/80 hover:text-amber-900 mt-1 underline"
            >
              Remover contestação
            </button>
          </div>
        )}

        {contestandoQtd && (
          <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-2 text-gray-900">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
              Quantas você recebeu de fato?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] text-gray-500">Chaves</span>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={qtdChavesEdit}
                  onChange={e => setQtdChavesEdit(parseInt(e.target.value || '0', 10))}
                  className="w-full text-sm px-2 py-1.5 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </label>
              <label className="block">
                <span className="text-[10px] text-gray-500">Controles</span>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={qtdControlesEdit}
                  onChange={e => setQtdControlesEdit(parseInt(e.target.value || '0', 10))}
                  className="w-full text-sm px-2 py-1.5 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </label>
            </div>
            {qtdErro && (
              <p className="text-xs text-red-600 flex items-start gap-1.5">
                <AlertCircle size={12} className="mt-0.5 shrink-0" /> {qtdErro}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={salvarContestacaoQtd}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg"
              >
                {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => { setContestandoQtd(false); setQtdErro('') }}
                disabled={isPending}
                className="px-3 text-xs text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {observacoesGerais && <p className="text-violet-800 italic">&ldquo;{observacoesGerais}&rdquo;</p>}
      </div>

      {/* Itens por cômodo */}
      {Object.entries(grupos).map(([comodo, itensComodo]) => (
        <section key={comodo} className="border border-gray-100 rounded-xl overflow-hidden">
          <header className="bg-gray-50 px-3 py-2">
            <h3 className="text-sm font-bold text-gray-900">{comodo}</h3>
          </header>
          <div className="divide-y divide-gray-50">
            {itensComodo.map(it => (
              <ItemRowPub
                key={it.id}
                item={it}
                fotos={fotosPorItem[it.id] ?? []}
                onChangeObs={v => onChangeObs(it.id, v)}
                onBlurObs={v => onBlurObs(it.id, v)}
                onFoto={file => onFoto(it, file)}
                isPending={isPending}
              />
            ))}
          </div>

          {/* Botão / form pra reportar problema novo nesse cômodo */}
          <div className="bg-gray-50 px-3 py-2 border-t border-gray-100">
            {reportandoComodo === comodo ? (
              <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                  <AlertTriangle size={12} /> Novo problema em {comodo}
                </p>
                <textarea
                  value={reportDescricao}
                  onChange={e => setReportDescricao(e.target.value)}
                  rows={3}
                  placeholder="Ex: Infiltração no teto perto da janela; tomada da parede da TV não funciona; vazamento embaixo da pia."
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
                />
                <div className="flex items-center gap-2 text-xs">
                  <label className="inline-flex items-center gap-1.5 text-amber-700 hover:text-amber-800 cursor-pointer">
                    <Camera size={13} />
                    {reportFoto ? `Foto: ${reportFoto.name.slice(0, 20)}…` : 'Anexar foto (recomendado)'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      className="hidden"
                      onChange={e => setReportFoto(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {reportFoto && (
                    <button type="button" onClick={() => setReportFoto(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={12} />
                    </button>
                  )}
                </div>
                {reportErro && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5">
                    <AlertCircle size={12} /> {reportErro}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onReportarProblema(comodo)}
                    disabled={isPending || !reportDescricao.trim()}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg"
                  >
                    {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Reportar
                  </button>
                  <button
                    type="button"
                    onClick={fecharReporte}
                    disabled={isPending}
                    className="px-3 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { fecharReporte(); setReportandoComodo(comodo) }}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 py-2 rounded-lg transition-colors"
              >
                <Plus size={13} /> Reportar problema neste cômodo
              </button>
            )}
          </div>
        </section>
      ))}

      {/* Observação final */}
      <section className="bg-white border border-gray-100 rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <MessageSquare size={14} /> Algo a acrescentar?
        </h3>
        <textarea
          value={observacoesFinal}
          onChange={e => setObservacoesFinal(e.target.value)}
          rows={3}
          placeholder="Observação geral sobre a vistoria (opcional)"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900 resize-y"
        />
      </section>

      {/* Selfie obrigatória */}
      <section className="bg-white border-2 border-violet-200 rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-bold text-violet-900 flex items-center gap-1.5">
          <Camera size={14} /> Selfie de confirmação <span className="text-red-500">*</span>
        </h3>
        <CapturaSelfie value={selfie} onChange={setSelfie} disabled={isPending} />
      </section>

      {/* Canvas de assinatura */}
      <section className="bg-white border-2 border-violet-200 rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-bold text-violet-900 flex items-center gap-1.5">
          <Pencil size={14} /> Sua assinatura <span className="text-red-500">*</span>
        </h3>
        <p className="text-[11px] text-gray-500">
          Use o dedo (no celular) ou o mouse pra desenhar sua assinatura no quadro abaixo.
        </p>
        <canvas
          ref={canvasRef}
          onPointerDown={desenhar}
          onPointerMove={desenhar}
          className="w-full h-32 border border-gray-300 rounded-lg bg-white touch-none cursor-crosshair"
          style={{ touchAction: 'none' }}
        />
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={limparCanvas}
            disabled={isPending || canvasVazio}
            className="text-xs text-gray-500 hover:text-violet-700 disabled:opacity-50"
          >
            Limpar
          </button>
          {canvasVazio && <span className="text-[11px] text-amber-700">Assine no quadro acima</span>}
        </div>
      </section>

      {erroGlobal && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{erroGlobal}</span>
        </div>
      )}

      {/* Botões */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <button
          type="button"
          onClick={assinar}
          disabled={isPending || canvasVazio || (!previewMode && !selfie)}
          className="flex-1 flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl"
        >
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Confirmar e assinar
        </button>
        <button
          type="button"
          onClick={() => setMostrarRecusa(v => !v)}
          className="text-xs text-red-600 hover:text-red-700 px-3 py-2"
        >
          {mostrarRecusa ? 'Cancelar' : 'Não concordo com a vistoria'}
        </button>
      </div>

      {mostrarRecusa && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-red-900">Conta o que está errado</p>
          <textarea
            value={recusarMotivo}
            onChange={e => setRecusarMotivo(e.target.value)}
            rows={3}
            placeholder="Quais itens você discorda? Tem foto/comprovante?"
            className="w-full text-sm px-3 py-2 rounded-lg border border-red-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            type="button"
            onClick={recusar}
            disabled={isPending || !recusarMotivo.trim()}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
            Recusar vistoria
          </button>
        </div>
      )}
    </div>
  )
}

function ItemRowPub({
  item, fotos, onChangeObs, onBlurObs, onFoto, isPending,
}: {
  item: ItemPub
  fotos: FotoPub[]
  onChangeObs: (v: string) => void
  onBlurObs: (v: string) => void
  onFoto: (f: File) => void
  isPending: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [verContestar, setVerContestar] = useState(!!item.observacao_inquilino)

  const ehDoInquilino = item.origem === 'inquilino'

  return (
    <div className={`px-3 py-2.5 ${ehDoInquilino ? 'bg-amber-50/40 border-l-2 border-amber-400' : ''}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">
            {item.item}
            {ehDoInquilino && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                você reportou
              </span>
            )}
          </p>
          {item.observacao && (
            <p className="text-[11px] text-gray-500 italic mt-0.5">&ldquo;{item.observacao}&rdquo;</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border ${COR_ESTADO[item.estado]}`}>
            {LABEL_ESTADO[item.estado]}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) onFoto(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isPending}
            className="p-1.5 text-gray-400 hover:text-violet-700 hover:bg-violet-50 rounded transition-colors"
            title="Adicionar foto"
          >
            <Camera size={13} />
          </button>
          <button
            type="button"
            onClick={() => setVerContestar(v => !v)}
            className="p-1.5 text-gray-400 hover:text-violet-700 hover:bg-violet-50 rounded transition-colors"
            title="Contestar"
          >
            <MessageSquare size={13} />
          </button>
        </div>
      </div>

      {verContestar && (
        <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 mb-1">Sua observação (opcional)</p>
          <textarea
            value={item.observacao_inquilino ?? ''}
            onChange={e => onChangeObs(e.target.value)}
            onBlur={e => onBlurObs(e.target.value)}
            rows={2}
            placeholder="Discorda? Quer adicionar contexto? Escreva aqui."
            className="w-full text-xs px-2 py-1.5 rounded border border-blue-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          />
        </div>
      )}

      {fotos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {fotos.map(f => (
            <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="relative w-14 h-14 rounded-lg overflow-hidden border bg-gray-50">
              <Image src={f.url} alt={f.legenda ?? 'foto'} fill className="object-cover" unoptimized />
              {f.origem === 'inquilino' && (
                <span className="absolute bottom-0 left-0 right-0 text-[7px] font-semibold bg-blue-600 text-white text-center py-0.5">
                  você
                </span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
