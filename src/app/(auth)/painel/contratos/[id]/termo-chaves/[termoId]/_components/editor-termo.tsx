'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  KeyRound, Send, Link2, Check, Loader2, AlertCircle, Trash2, FileText,
  Copy, MessageCircle, RotateCcw, Pencil, UserCheck, ShieldCheck,
} from 'lucide-react'
import { CapturaSelfie } from '@/components/captura-selfie'
import {
  atualizarTermoMeta, enviarTermo, revogarEnvioTermo,
  assinarComoLocador, excluirTermo,
} from '../../actions'

interface Props {
  termoId: string
  contratoId: string
  status: string
  dataEntrega: string | null
  qtdChaves: number
  qtdControles: number
  estadoEntrega: string | null
  observacoes: string | null
  token: string | null
  expiraEm: string | null
  enviadaEm: string | null
  recusadaMotivo: string | null
  assinadoLocatarioEm: string | null
  assinaturaLocatarioUrl: string | null
  selfieLocatarioUrl: string | null
  observacoesLocatario: string | null
  assinadoLocadorEm: string | null
  assinaturaLocadorUrl: string | null
  selfieLocadorUrl: string | null
  whatsappInquilino: string | null
  nomeInquilino: string | null
  baseUrl: string
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900'

export function EditorTermo(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const editavel = props.status === 'rascunho'

  /* ── Meta ── */
  const [dataEntrega, setDataEntrega] = useState(props.dataEntrega ?? '')
  const [qtdChaves, setQtdChaves] = useState(String(props.qtdChaves))
  const [qtdControles, setQtdControles] = useState(String(props.qtdControles))
  const [estadoEntrega, setEstadoEntrega] = useState(props.estadoEntrega ?? '')
  const [observacoes, setObservacoes] = useState(props.observacoes ?? '')
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState('')

  const salvarMeta = () => {
    setErro('')
    startTransition(async () => {
      const r = await atualizarTermoMeta(props.termoId, {
        data_entrega: dataEntrega || null,
        qtd_chaves_entregues: parseInt(qtdChaves || '0', 10),
        qtd_controles_entregues: parseInt(qtdControles || '0', 10),
        estado_entrega: estadoEntrega || null,
        observacoes: observacoes || null,
      })
      if (r.error) { setErro(r.error); return }
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2000)
      router.refresh()
    })
  }

  /* ── Envio do link ── */
  const [link, setLink] = useState<{ url: string; expira: string } | null>(
    props.token && props.expiraEm ? { url: `${props.baseUrl}/termo/${props.token}`, expira: props.expiraEm } : null
  )
  const [copiado, setCopiado] = useState(false)

  const enviar = () => {
    setErro('')
    startTransition(async () => {
      const r = await enviarTermo(props.termoId)
      if (r.error) { setErro(r.error); return }
      setLink({ url: r.url ?? '', expira: r.expira_em ?? '' })
      router.refresh()
    })
  }

  const revogar = () => {
    startTransition(async () => {
      const r = await revogarEnvioTermo(props.termoId)
      if (r.error) { alert(r.error); return }
      setLink(null)
      router.refresh()
    })
  }

  const copiar = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {/* */}
  }

  const compartilharWhatsApp = () => {
    if (!link) return
    const msg = `Olá ${props.nomeInquilino?.split(' ')[0] ?? ''}, segue o termo de entrega de chaves pra você conferir, tirar uma selfie e assinar (válido até ${new Date(link.expira).toLocaleDateString('pt-BR')}):\n\n${link.url}`
    const fone = (props.whatsappInquilino ?? '').replace(/\D/g, '')
    const url = fone
      ? `https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  /* ── Assinatura da administradora (canvas + selfie opcional) ── */
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasVazio, setCanvasVazio] = useState(true)
  const [selfieAdmin, setSelfieAdmin] = useState<string | null>(null)
  const podeAssinarAdmin = props.status === 'assinado_locatario'

  useEffect(() => {
    if (!podeAssinarAdmin) return
    const c = canvasRef.current
    if (!c) return
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
  }, [podeAssinarAdmin])

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

  const assinarAdmin = () => {
    setErro('')
    if (canvasVazio) { setErro('Desenhe sua assinatura no quadro.'); return }
    const dataUrl = canvasRef.current!.toDataURL('image/png')
    startTransition(async () => {
      const r = await assinarComoLocador(props.termoId, {
        assinatura_dataurl: dataUrl,
        selfie_dataurl: selfieAdmin,
      })
      if (r.error) { setErro(r.error); return }
      router.refresh()
    })
  }

  const excluir = () => {
    if (!confirm('Excluir este termo? Esta ação não pode ser desfeita.')) return
    startTransition(async () => {
      const r = await excluirTermo(props.termoId)
      if (r?.error) alert(r.error)
    })
  }

  const pdfUrl = `/api/termos-chaves/${props.termoId}`

  return (
    <div className="space-y-4">
      {/* Status */}
      <BannerStatus status={props.status} recusadaMotivo={props.recusadaMotivo} />

      {/* Dados da entrega */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <KeyRound size={15} className="text-violet-600" /> Dados da entrega
          {!editavel && <span className="text-[10px] font-normal text-gray-400">(bloqueado após envio)</span>}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Data da entrega</label>
            <input type="date" value={dataEntrega} disabled={!editavel} onChange={e => setDataEntrega(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Estado do imóvel</label>
            <input type="text" value={estadoEntrega} disabled={!editavel} onChange={e => setEstadoEntrega(e.target.value)} placeholder="ex: bom, limpo, com desgaste natural" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Chaves devolvidas</label>
            <input type="number" min={0} max={999} value={qtdChaves} disabled={!editavel} onChange={e => setQtdChaves(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Controles devolvidos</label>
            <input type="number" min={0} max={999} value={qtdControles} disabled={!editavel} onChange={e => setQtdControles(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Observações</label>
          <textarea value={observacoes} disabled={!editavel} onChange={e => setObservacoes(e.target.value)} rows={2} placeholder="Acertos, pendências, danos (opcional)" className={`${inputCls} resize-y`} />
        </div>
        {editavel && (
          <button
            type="button"
            onClick={salvarMeta}
            disabled={isPending}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : salvo ? <Check size={14} /> : <Pencil size={14} />}
            {salvo ? 'Salvo' : 'Salvar dados'}
          </button>
        )}
      </section>

      {/* Envio do link pro locatário */}
      {(props.status === 'rascunho' || props.status === 'enviada') && (
        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Send size={15} className="text-violet-600" /> Enviar pro locatário assinar
          </h2>
          {!link ? (
            <button
              type="button"
              onClick={enviar}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl"
            >
              {isPending ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
              Gerar link de assinatura
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <Link2 size={13} className="text-gray-400 shrink-0" />
                <span className="text-xs text-gray-600 truncate flex-1">{link.url}</span>
              </div>
              <p className="text-[11px] text-gray-400">
                Válido até {new Date(link.expira).toLocaleString('pt-BR')}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={compartilharWhatsApp} className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-lg">
                  <MessageCircle size={14} /> WhatsApp
                </button>
                <button type="button" onClick={copiar} className="flex items-center justify-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2.5 rounded-lg">
                  {copiado ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <button type="button" onClick={revogar} disabled={isPending} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600">
                <RotateCcw size={12} /> Revogar e voltar pra rascunho
              </button>
            </div>
          )}
        </section>
      )}

      {/* Assinatura do locatário (preview) */}
      {props.assinaturaLocatarioUrl && (
        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <UserCheck size={15} className="text-blue-600" /> Assinatura do locatário
          </h2>
          <div className="flex items-start gap-4 flex-wrap">
            {props.selfieLocatarioUrl && (
              <div className="text-center">
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  <Image src={props.selfieLocatarioUrl} alt="Selfie do locatário" fill className="object-cover" unoptimized />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">selfie</p>
              </div>
            )}
            <div className="flex-1 min-w-[180px]">
              <div className="relative w-full h-24 border border-gray-200 rounded-xl bg-white">
                <Image src={props.assinaturaLocatarioUrl} alt="Assinatura do locatário" fill className="object-contain p-2" unoptimized />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {props.nomeInquilino} · assinado em {props.assinadoLocatarioEm ? new Date(props.assinadoLocatarioEm).toLocaleString('pt-BR') : '—'}
              </p>
            </div>
          </div>
          {props.observacoesLocatario && (
            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-2 italic">
              &ldquo;{props.observacoesLocatario}&rdquo;
            </p>
          )}
        </section>
      )}

      {/* Assinatura da administradora */}
      {podeAssinarAdmin && (
        <section className="bg-white border-2 border-violet-200 rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold text-violet-900 flex items-center gap-1.5">
            <Pencil size={15} /> Confirmar recebimento (administradora)
          </h2>
          <p className="text-xs text-gray-500">
            O locatário já assinou. Assine abaixo pra confirmar o recebimento das chaves e fechar o termo.
          </p>

          <div>
            <p className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <ShieldCheck size={12} className="text-gray-400" /> Selfie (opcional)
            </p>
            <CapturaSelfie value={selfieAdmin} onChange={setSelfieAdmin} disabled={isPending} />
          </div>

          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Assinatura <span className="text-red-500">*</span></p>
            <canvas
              ref={canvasRef}
              onPointerDown={desenhar}
              onPointerMove={desenhar}
              className="w-full h-32 border border-gray-300 rounded-lg bg-white touch-none cursor-crosshair"
              style={{ touchAction: 'none' }}
            />
            <button type="button" onClick={limparCanvas} disabled={isPending || canvasVazio} className="text-xs text-gray-500 hover:text-violet-700 disabled:opacity-50 mt-1">
              Limpar
            </button>
          </div>

          <button
            type="button"
            onClick={assinarAdmin}
            disabled={isPending || canvasVazio}
            className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl"
          >
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Confirmar recebimento e fechar termo
          </button>
        </section>
      )}

      {/* Assinatura da administradora (preview quando fechado) */}
      {props.status === 'assinado' && props.assinaturaLocadorUrl && (
        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <UserCheck size={15} className="text-green-600" /> Assinatura da administradora
          </h2>
          <div className="flex items-start gap-4 flex-wrap">
            {props.selfieLocadorUrl && (
              <div className="text-center">
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  <Image src={props.selfieLocadorUrl} alt="Selfie da administradora" fill className="object-cover" unoptimized />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">selfie</p>
              </div>
            )}
            <div className="flex-1 min-w-[180px]">
              <div className="relative w-full h-24 border border-gray-200 rounded-xl bg-white">
                <Image src={props.assinaturaLocadorUrl} alt="Assinatura da administradora" fill className="object-contain p-2" unoptimized />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                assinado em {props.assinadoLocadorEm ? new Date(props.assinadoLocadorEm).toLocaleString('pt-BR') : '—'}
              </p>
            </div>
          </div>
        </section>
      )}

      {erro && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Rodapé: PDF + excluir */}
      <div className="flex items-center justify-between pt-2">
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-violet-700 hover:text-violet-800 border border-violet-200 hover:bg-violet-50 px-3 py-1.5 rounded-lg"
        >
          <FileText size={14} /> Ver PDF
        </a>
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

function BannerStatus({ status, recusadaMotivo }: { status: string; recusadaMotivo: string | null }) {
  const mapa: Record<string, { cor: string; texto: string }> = {
    rascunho: { cor: 'bg-gray-50 border-gray-200 text-gray-700', texto: 'Rascunho — preencha os dados e envie o link pro locatário.' },
    enviada: { cor: 'bg-amber-50 border-amber-200 text-amber-800', texto: 'Link enviado — aguardando o locatário tirar selfie e assinar.' },
    assinado_locatario: { cor: 'bg-blue-50 border-blue-200 text-blue-800', texto: 'Locatário assinou — falta a administradora confirmar o recebimento.' },
    assinado: { cor: 'bg-green-50 border-green-200 text-green-800', texto: 'Termo assinado pelas duas partes. Entrega registrada no contrato.' },
    recusada: { cor: 'bg-red-50 border-red-200 text-red-800', texto: recusadaMotivo ? `Recusado pelo locatário: "${recusadaMotivo}"` : 'Recusado pelo locatário.' },
  }
  const s = mapa[status] ?? mapa.rascunho
  return (
    <div className={`border rounded-xl px-3 py-2.5 text-sm ${s.cor}`}>
      {s.texto}
    </div>
  )
}
