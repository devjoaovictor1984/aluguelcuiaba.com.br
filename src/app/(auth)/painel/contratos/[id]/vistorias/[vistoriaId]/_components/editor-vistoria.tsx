'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Loader2, Send, X, Trash2, Plus, Camera, Copy, MessageCircle, Check,
  Save, Clock, CheckCircle2, AlertCircle, Pencil, RotateCcw, FileText, Eye,
} from 'lucide-react'
import { LABEL_ESTADO, COR_ESTADO, type EstadoItem } from '@/lib/vistorias/modelos'
import {
  atualizarVistoriaItem, adicionarItemVistoria, removerItemVistoria,
  atualizarVistoriaMeta, uploadFotoVistoria, removerFotoVistoria,
  enviarVistoria, revogarEnvioVistoria, excluirVistoria,
} from '../../actions'

export interface ItemRow {
  id: string
  comodo: string
  item: string
  estado: EstadoItem
  observacao: string | null
  observacao_inquilino: string | null
  ordem: number
}

export interface FotoRow {
  id: string
  vistoria_item_id: string | null
  comodo: string | null
  url: string
  origem: 'corretor' | 'inquilino'
  legenda: string | null
}

interface Props {
  vistoriaId: string
  contratoId: string
  status: string
  tipo: 'entrada' | 'saida'
  dataVistoria: string | null
  observacoesGerais: string | null
  qtdChaves: number
  qtdControles: number
  token: string | null
  expiraEm: string | null
  enviadaEm: string | null
  assinadaEm: string | null
  inquilinoObservacoes: string | null
  assinaturaUrl: string | null
  whatsappInquilino: string | null
  nomeInquilino: string | null
  itens: ItemRow[]
  fotos: FotoRow[]
  baseUrl: string
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900'

export function EditorVistoria(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const editavel = props.status === 'rascunho'

  // Agrupa itens por cômodo
  const grupos = props.itens.reduce<Record<string, ItemRow[]>>((acc, it) => {
    if (!acc[it.comodo]) acc[it.comodo] = []
    acc[it.comodo].push(it)
    return acc
  }, {})
  // Fotos: separa em 3 escopos
  const fotosPorItem: Record<string, FotoRow[]> = {}
  const fotosPorComodo: Record<string, FotoRow[]> = {}
  const fotosGerais: FotoRow[] = []
  for (const f of props.fotos) {
    if (f.vistoria_item_id) {
      if (!fotosPorItem[f.vistoria_item_id]) fotosPorItem[f.vistoria_item_id] = []
      fotosPorItem[f.vistoria_item_id].push(f)
    } else if (f.comodo) {
      if (!fotosPorComodo[f.comodo]) fotosPorComodo[f.comodo] = []
      fotosPorComodo[f.comodo].push(f)
    } else {
      fotosGerais.push(f)
    }
  }

  const apagar = () => {
    let msg = 'Apagar essa vistoria? Todos os itens e fotos vão junto.'
    if (props.status === 'enviada') msg = '⚠️ A vistoria está com link ativo. O inquilino perderá o acesso. Confirmar apagar?'
    if (props.status === 'assinada') msg = '⚠️ ATENÇÃO: vistoria JÁ ASSINADA pelo inquilino. Apagar exclui o registro de assinatura. Não tem volta. Confirmar?'
    if (!confirm(msg)) return
    if (props.status === 'assinada') {
      const typed = prompt('Digite "APAGAR" pra confirmar a exclusão da vistoria assinada:')
      if (typed?.trim().toUpperCase() !== 'APAGAR') { alert('Cancelado.'); return }
    }
    startTransition(async () => {
      await excluirVistoria(props.vistoriaId)
    })
  }

  return (
    <div className="space-y-4">
      {/* Status + magic-link */}
      <BlocoStatus {...props} isPending={isPending} startTransition={startTransition} router={router} editavel={editavel} />

      {/* Meta */}
      <BlocoMeta {...props} editavel={editavel} />

      {/* Fotos gerais da vistoria */}
      <FotosGerais
        vistoriaId={props.vistoriaId}
        fotos={fotosGerais}
        editavel={editavel}
      />

      {/* Itens por cômodo */}
      {Object.entries(grupos).map(([comodo, itens]) => (
        <ComodoCard
          key={comodo}
          comodo={comodo}
          itens={itens}
          fotos={fotosPorItem}
          fotosComodo={fotosPorComodo[comodo] ?? []}
          vistoriaId={props.vistoriaId}
          editavel={editavel}
        />
      ))}

      {/* Adicionar cômodo/item */}
      {editavel && <AddItem vistoriaId={props.vistoriaId} comodosExistentes={Object.keys(grupos)} />}

      {/* Excluir vistoria — sempre visível, com confirmação reforçada */}
      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={apagar}
          disabled={isPending}
          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Trash2 size={11} /> Apagar vistoria
        </button>
      </div>
    </div>
  )
}

/* ────────── Status + Envio ─────────── */
const LS_DIAS_VALIDADE = 'vistoria_dias_validade_padrao'

function BlocoStatus({
  vistoriaId, status, token, expiraEm, enviadaEm, assinadaEm, inquilinoObservacoes,
  assinaturaUrl, whatsappInquilino, nomeInquilino, baseUrl, editavel,
}: Props & { isPending: boolean; startTransition: ReturnType<typeof useTransition>[1]; router: ReturnType<typeof useRouter>; editavel: boolean }) {
  const router = useRouter()

  // SSR sempre começa com 7 (window não existe) — useEffect ajusta após
  // hidratação. Sem o useEffect, o valor do localStorage nunca era lido
  // porque o useState init roda no servidor antes da hidratação.
  const [diasValidade, setDiasValidadeState] = useState(7)
  useEffect(() => {
    if (enviadaEm && expiraEm) {
      const diff = Math.round((new Date(expiraEm).getTime() - new Date(enviadaEm).getTime()) / 86400000)
      if ([3, 7, 14, 30].includes(diff)) {
        setDiasValidadeState(diff)
        return
      }
    }
    const salvo = parseInt(localStorage.getItem(LS_DIAS_VALIDADE) ?? '7')
    if ([3, 7, 14, 30].includes(salvo)) setDiasValidadeState(salvo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enviadaEm, expiraEm])

  const setDiasValidade = (n: number) => {
    setDiasValidadeState(n)
    if (typeof window !== 'undefined') localStorage.setItem(LS_DIAS_VALIDADE, String(n))
  }

  const [link, setLink] = useState<{ url: string; expira: string } | null>(
    token ? { url: `${baseUrl}/vistoria/${token}`, expira: expiraEm ?? '' } : null
  )
  const [copiado, setCopiado] = useState(false)
  const [isPending, startTransition] = useTransition()

  const BotaoPreviewPDF = (
    <div className="flex flex-wrap gap-1.5">
      <a
        href={`/vistoria/preview/${vistoriaId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-lg"
        title="Abre como o inquilino verá — nada salva"
      >
        <Eye size={12} /> Ver como inquilino
      </a>
      <a
        href={`/api/vistorias/${vistoriaId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs font-semibold bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg"
      >
        <FileText size={12} /> PDF
      </a>
    </div>
  )

  const enviar = () => {
    startTransition(async () => {
      const r = await enviarVistoria(vistoriaId, diasValidade)
      if (r.error) { alert(r.error); return }
      setLink({ url: r.url ?? '', expira: r.expira_em ?? '' })
      router.refresh()
    })
  }

  const revogar = () => {
    if (!confirm('Cancelar o envio? O inquilino não conseguirá mais acessar o link atual.')) return
    startTransition(async () => {
      const r = await revogarEnvioVistoria(vistoriaId)
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
    const msg = `Olá ${nomeInquilino?.split(' ')[0] ?? ''}, segue o link da vistoria pra você revisar e assinar (válido até ${new Date(link.expira).toLocaleDateString('pt-BR')}):\n\n${link.url}`
    const fone = (whatsappInquilino ?? '').replace(/\D/g, '')
    const url = fone
      ? `https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (status === 'assinada') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="text-sm font-bold text-green-900 flex items-center gap-2">
            <CheckCircle2 size={15} /> Vistoria assinada em {assinadaEm ? new Date(assinadaEm).toLocaleString('pt-BR') : '—'}
          </p>
          <a
            href={`/api/vistorias/${vistoriaId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 rounded-lg"
          >
            <FileText size={12} /> Baixar PDF
          </a>
        </div>
        {inquilinoObservacoes && (
          <div className="mt-3 bg-white border border-green-100 rounded-xl p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-green-700 mb-1">Observações do inquilino</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{inquilinoObservacoes}</p>
          </div>
        )}
        {assinaturaUrl && (
          <div className="mt-3 bg-white border border-green-100 rounded-xl p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-green-700 mb-2">Assinatura</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assinaturaUrl} alt="Assinatura do inquilino" className="max-h-24 mx-auto" />
          </div>
        )}
      </div>
    )
  }

  if (status === 'enviada' && link) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <Clock size={15} /> Aguardando inquilino assinar
            {link.expira && <span className="text-xs font-normal">· expira em {new Date(link.expira).toLocaleDateString('pt-BR')}</span>}
          </p>
          {BotaoPreviewPDF}
        </div>
        <div className="bg-white border border-amber-100 rounded-lg p-2 font-mono text-xs break-all text-gray-700">
          {link.url}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copiar} className="flex items-center gap-1 text-xs bg-white hover:bg-gray-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg">
            {copiado ? <Check size={11} /> : <Copy size={11} />} {copiado ? 'Copiado!' : 'Copiar link'}
          </button>
          <button type="button" onClick={compartilharWhatsApp} className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg">
            <MessageCircle size={11} /> WhatsApp
          </button>
          <button type="button" onClick={revogar} disabled={isPending} className="flex items-center gap-1 text-xs text-amber-700 hover:text-red-700 px-3 py-1.5 rounded-lg ml-auto">
            <RotateCcw size={11} /> Cancelar envio
          </button>
        </div>
      </div>
    )
  }

  // status === 'rascunho'
  return (
    <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold text-violet-900 flex items-center gap-2">
          <Pencil size={14} /> Rascunho — preencha os itens e envie pro inquilino quando estiver pronto
        </p>
        {BotaoPreviewPDF}
      </div>
      {editavel && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-violet-900">
            Validade do link:{' '}
            <select
              value={diasValidade}
              onChange={e => setDiasValidade(parseInt(e.target.value))}
              className="ml-1 text-xs border border-violet-200 rounded px-1.5 py-1 bg-white"
            >
              <option value={3}>3 dias</option>
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </label>
          <button
            type="button"
            onClick={enviar}
            disabled={isPending}
            className="flex items-center gap-1.5 text-sm font-semibold bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white px-4 py-2 rounded-xl ml-auto"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Enviar pra inquilino
          </button>
        </div>
      )}
    </div>
  )
}

/* ────────── Meta da vistoria (data, observações, chaves) ─────────── */
function BlocoMeta({
  vistoriaId, dataVistoria, observacoesGerais, qtdChaves, qtdControles, editavel,
}: Props & { editavel: boolean }) {
  const router = useRouter()
  const [data, setData] = useState(dataVistoria ?? '')
  const [obs, setObs] = useState(observacoesGerais ?? '')
  const [chaves, setChaves] = useState(String(qtdChaves))
  const [controles, setControles] = useState(String(qtdControles))
  const [salvo, setSalvo] = useState(false)
  const [isPending, startTransition] = useTransition()

  const salvar = () => {
    startTransition(async () => {
      const r = await atualizarVistoriaMeta(vistoriaId, {
        data_vistoria: data || null,
        observacoes_gerais: obs || null,
        qtd_chaves: parseInt(chaves) || 0,
        qtd_controles: parseInt(controles) || 0,
      })
      if (r.error) { alert(r.error); return }
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2000)
      router.refresh()
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Informações gerais</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600 block mb-1">Data da vistoria</span>
          <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} disabled={!editavel} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600 block mb-1">Qtd. de chaves</span>
          <input type="number" min="0" value={chaves} onChange={e => setChaves(e.target.value)} className={inputCls} disabled={!editavel} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600 block mb-1">Qtd. de controles</span>
          <input type="number" min="0" value={controles} onChange={e => setControles(e.target.value)} className={inputCls} disabled={!editavel} />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-gray-600 block mb-1">Observações gerais</span>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className={`${inputCls} resize-y`} disabled={!editavel}
          placeholder="Notas livres (estado geral, hidrômetro, leitura inicial, etc)" />
      </label>
      {editavel && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={salvar}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs font-semibold bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
          >
            {isPending ? <Loader2 size={11} className="animate-spin" /> : salvo ? <Check size={11} /> : <Save size={11} />}
            {salvo ? 'Salvo' : 'Salvar'}
          </button>
        </div>
      )}
    </section>
  )
}

/* ────────── Fotos gerais da vistoria (sem item nem cômodo) ─────────── */
function FotosGerais({ vistoriaId, fotos, editavel }: {
  vistoriaId: string; fotos: FotoRow[]; editavel: boolean
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(null)

  if (!editavel && fotos.length === 0) return null

  const subirVarias = (files: FileList) => {
    const lista = Array.from(files)
    if (lista.length === 0) return
    setProgresso({ feitas: 0, total: lista.length })
    startTransition(async () => {
      let i = 0
      for (const file of lista) {
        const fd = new FormData()
        fd.set('vistoria_id', vistoriaId)
        fd.set('file', file)
        const r = await uploadFotoVistoria(fd)
        if (r.error) { alert(`Foto ${i + 1}: ${r.error}`); break }
        i += 1
        setProgresso({ feitas: i, total: lista.length })
      }
      setProgresso(null)
      router.refresh()
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-900">Fotos gerais da vistoria</h3>
        {editavel && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files.length > 0) subirVarias(e.target.files)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isPending}
              className="flex items-center gap-1 text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 px-2.5 py-1.5 rounded-lg"
            >
              {isPending ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
              {progresso ? `Enviando ${progresso.feitas}/${progresso.total}` : 'Adicionar fotos'}
            </button>
          </>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mb-2">
        Fachada do imóvel, hidrômetro com leitura, vista geral. Sem amarração a item.
      </p>
      {fotos.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Nenhuma foto geral ainda.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {fotos.map(f => (
            <FotoMini key={f.id} foto={f} editavel={editavel} />
          ))}
        </div>
      )}
    </section>
  )
}

/* ────────── Card de cômodo ─────────── */
function ComodoCard({ comodo, itens, fotos, fotosComodo, vistoriaId, editavel }: {
  comodo: string
  itens: ItemRow[]
  fotos: Record<string, FotoRow[]>
  fotosComodo: FotoRow[]
  vistoriaId: string
  editavel: boolean
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [isPendingComodo, startTransitionComodo] = useTransition()
  const [progressoComodo, setProgressoComodo] = useState<{ feitas: number; total: number } | null>(null)

  const subirComodoVarias = (files: FileList) => {
    const lista = Array.from(files)
    if (lista.length === 0) return
    setProgressoComodo({ feitas: 0, total: lista.length })
    startTransitionComodo(async () => {
      let i = 0
      for (const file of lista) {
        const fd = new FormData()
        fd.set('vistoria_id', vistoriaId)
        fd.set('comodo', comodo)
        fd.set('file', file)
        const r = await uploadFotoVistoria(fd)
        if (r.error) { alert(`Foto ${i + 1}: ${r.error}`); break }
        i += 1
        setProgressoComodo({ feitas: i, total: lista.length })
      }
      setProgressoComodo(null)
      router.refresh()
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <header className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-900">{comodo}</h3>
        {editavel && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files.length > 0) subirComodoVarias(e.target.files)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isPendingComodo}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-violet-700 hover:bg-violet-50 px-2 py-1 rounded-md"
              title="Adicionar fotos deste cômodo (pode selecionar várias)"
            >
              {isPendingComodo ? <Loader2 size={10} className="animate-spin" /> : <Camera size={10} />}
              {progressoComodo ? `${progressoComodo.feitas}/${progressoComodo.total}` : 'Fotos do cômodo'}
            </button>
          </>
        )}
      </header>
      {fotosComodo.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-50 flex flex-wrap gap-2 bg-gray-50/30">
          {fotosComodo.map(f => (
            <FotoMini key={f.id} foto={f} editavel={editavel} />
          ))}
        </div>
      )}
      <div className="divide-y divide-gray-50">
        {itens.map(it => (
          <ItemRow
            key={it.id}
            item={it}
            fotos={fotos[it.id] ?? []}
            vistoriaId={vistoriaId}
            editavel={editavel}
          />
        ))}
      </div>
    </section>
  )
}

function ItemRow({ item, fotos, vistoriaId, editavel }: {
  item: ItemRow; fotos: FotoRow[]; vistoriaId: string; editavel: boolean
}) {
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoItem>(item.estado)
  const [obs, setObs] = useState(item.observacao ?? '')
  const [verObs, setVerObs] = useState(!!item.observacao || !!item.observacao_inquilino)
  const fileRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  const trocarEstado = (novo: EstadoItem) => {
    setEstado(novo)
    startTransition(async () => {
      await atualizarVistoriaItem(item.id, { estado: novo })
    })
  }

  const salvarObs = () => {
    startTransition(async () => {
      await atualizarVistoriaItem(item.id, { observacao: obs })
      router.refresh()
    })
  }

  const remover = () => {
    if (!confirm(`Remover "${item.item}" da vistoria?`)) return
    startTransition(async () => {
      await removerItemVistoria(item.id)
      router.refresh()
    })
  }

  const uploadVarias = (files: FileList) => {
    const lista = Array.from(files)
    if (lista.length === 0) return
    startTransition(async () => {
      let i = 0
      for (const file of lista) {
        const fd = new FormData()
        fd.set('vistoria_id', vistoriaId)
        fd.set('vistoria_item_id', item.id)
        fd.set('file', file)
        const r = await uploadFotoVistoria(fd)
        if (r.error) { alert(`Foto ${i + 1}: ${r.error}`); break }
        i += 1
      }
      router.refresh()
    })
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <p className="text-sm font-medium text-gray-900">{item.item}</p>
          {(item.observacao || item.observacao_inquilino) && !verObs && (
            <button onClick={() => setVerObs(true)} className="text-[11px] text-violet-700 hover:underline mt-0.5">
              ver observações
            </button>
          )}
        </div>

        {/* Estado pills */}
        <div className="flex flex-wrap gap-1">
          {(['perfeito', 'bom', 'regular', 'danificado', 'nao_aplicavel'] as EstadoItem[]).map(e => (
            <button
              key={e}
              type="button"
              onClick={() => editavel && trocarEstado(e)}
              disabled={!editavel || isPending}
              className={`text-[10px] font-medium px-2 py-1 rounded-md border transition-colors ${
                estado === e
                  ? COR_ESTADO[e]
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              } ${!editavel ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {LABEL_ESTADO[e]}
            </button>
          ))}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1">
          {editavel && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                multiple
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) uploadVarias(e.target.files)
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
                onClick={() => setVerObs(v => !v)}
                className="p-1.5 text-gray-400 hover:text-violet-700 hover:bg-violet-50 rounded transition-colors"
                title="Observação"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={remover}
                disabled={isPending}
                className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                title="Remover item"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Observação editável */}
      {verObs && (
        <div className="mt-2 space-y-2">
          {item.observacao_inquilino && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 mb-0.5">Observação do inquilino</p>
              <p className="text-xs text-blue-900">{item.observacao_inquilino}</p>
            </div>
          )}
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Sua observação</p>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              onBlur={editavel ? salvarObs : undefined}
              rows={2}
              disabled={!editavel}
              placeholder="Detalhe danos, ressalvas, condições específicas…"
              className={`${inputCls} text-xs resize-y bg-white`}
            />
          </div>
        </div>
      )}

      {/* Fotos */}
      {fotos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {fotos.map(f => (
            <FotoMini key={f.id} foto={f} editavel={editavel} />
          ))}
        </div>
      )}
    </div>
  )
}

function FotoMini({ foto, editavel }: { foto: FotoRow; editavel: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const remover = () => {
    if (!confirm('Apagar essa foto?')) return
    startTransition(async () => {
      const r = await removerFotoVistoria(foto.id)
      if (r.error) { alert(r.error); return }
      router.refresh()
    })
  }
  const corBorda = foto.origem === 'inquilino' ? 'border-blue-300' : 'border-gray-200'
  return (
    <div className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 ${corBorda} bg-gray-50 group`}>
      <a href={foto.url} target="_blank" rel="noopener noreferrer">
        <Image src={foto.url} alt={foto.legenda ?? 'foto'} fill className="object-cover" unoptimized />
      </a>
      {editavel && foto.origem === 'corretor' && (
        <button
          type="button"
          onClick={remover}
          disabled={isPending}
          className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X size={10} />
        </button>
      )}
      {foto.origem === 'inquilino' && (
        <span className="absolute bottom-0 left-0 right-0 text-[8px] font-semibold bg-blue-600 text-white text-center py-0.5">
          inquilino
        </span>
      )}
    </div>
  )
}

/* ────────── Adicionar item ─────────── */
function AddItem({ vistoriaId, comodosExistentes }: { vistoriaId: string; comodosExistentes: string[] }) {
  const router = useRouter()
  const [comodo, setComodo] = useState(comodosExistentes[0] ?? '')
  const [novoComodo, setNovoComodo] = useState('')
  const [item, setItem] = useState('')
  const [isPending, startTransition] = useTransition()

  const usarNovoComodo = comodo === '__novo__'
  const comodoFinal = usarNovoComodo ? novoComodo : comodo

  const add = () => {
    if (!comodoFinal.trim() || !item.trim()) return
    startTransition(async () => {
      const r = await adicionarItemVistoria(vistoriaId, comodoFinal, item)
      if (r.error) { alert(r.error); return }
      setItem('')
      if (usarNovoComodo) setNovoComodo('')
      router.refresh()
    })
  }

  return (
    <section className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
        Adicionar item
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          value={comodo}
          onChange={e => setComodo(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white"
        >
          {comodosExistentes.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="__novo__">+ Novo cômodo</option>
        </select>
        {usarNovoComodo && (
          <input
            value={novoComodo}
            onChange={e => setNovoComodo(e.target.value)}
            placeholder="Nome do cômodo"
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-[120px]"
          />
        )}
        <input
          value={item}
          onChange={e => setItem(e.target.value)}
          placeholder="Item (ex: Janela, Tomada)"
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-[140px]"
        />
        <button
          type="button"
          onClick={add}
          disabled={isPending || !comodoFinal.trim() || !item.trim()}
          className="flex items-center gap-1 text-xs font-semibold bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
        >
          {isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          Adicionar
        </button>
      </div>
    </section>
  )
}
