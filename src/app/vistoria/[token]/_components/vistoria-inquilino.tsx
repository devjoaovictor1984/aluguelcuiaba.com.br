'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import Image from 'next/image'
import {
  Camera, Pencil, AlertCircle, Loader2, Check, X, MessageSquare,
} from 'lucide-react'
import { LABEL_ESTADO, COR_ESTADO, type EstadoItem } from '@/lib/vistorias/modelos'
import { inquilinoObservacaoItem, inquilinoUploadFoto, inquilinoAssinar, inquilinoRecusar } from '../actions'

export interface ItemPub {
  id: string
  comodo: string
  item: string
  estado: EstadoItem
  observacao: string | null
  observacao_inquilino: string | null
  ordem: number
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
  itens: ItemPub[]
  fotos: FotoPub[]
  /** Modo pré-visualização: todas as ações viram no-op com alert. */
  previewMode?: boolean
}

export function VistoriaInquilino({ token, observacoesGerais, qtdChaves, qtdControles, itens: itensIniciais, fotos: fotosIniciais, previewMode = false }: Props) {
  const [itens, setItens] = useState(itensIniciais)
  const [fotos, setFotos] = useState(fotosIniciais)
  const [observacoesFinal, setObservacoesFinal] = useState('')
  const [recusarMotivo, setRecusarMotivo] = useState('')
  const [mostrarRecusa, setMostrarRecusa] = useState(false)
  const [assinado, setAssinado] = useState(false)
  const [recusado, setRecusado] = useState(false)
  const [erroGlobal, setErroGlobal] = useState('')
  const [isPending, startTransition] = useTransition()

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
      alert('🧪 Pré-visualização — no envio real, aqui a vistoria seria assinada e fechada.\n\nO PDF final teria essa assinatura embedada, mais IP e data/hora.')
      return
    }
    const c = canvasRef.current!
    const dataUrl = c.toDataURL('image/png')
    startTransition(async () => {
      const r = await inquilinoAssinar(token, { assinatura_dataurl: dataUrl, observacoes: observacoesFinal })
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
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs text-violet-900 space-y-1">
        <p><strong>{qtdChaves}</strong> chave{qtdChaves === 1 ? '' : 's'} · <strong>{qtdControles}</strong> controle{qtdControles === 1 ? '' : 's'}</p>
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

      {/* Canvas de assinatura */}
      <section className="bg-white border-2 border-violet-200 rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-bold text-violet-900 flex items-center gap-1.5">
          <Pencil size={14} /> Sua assinatura
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
          disabled={isPending || canvasVazio}
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

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{item.item}</p>
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
