'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck, Flame, Upload, Loader2, X, Trash2, Pencil, ExternalLink,
  AlertTriangle, CheckCircle2,
} from 'lucide-react'
import {
  uploadApolice, atualizarApolice, removerApolice, gerarUrlApolice,
  type TipoApolice,
} from '../actions-apolices'

/**
 * Apólices do contrato (v97). Duas vagas fixas — incêndio e fiança —
 * porque é o que existe: o corretor procura "a apólice do incêndio deste
 * contrato", não um documento solto numa lista.
 *
 * Hoje o PDF é baixado da plataforma da seguradora e subido aqui. Quando
 * a emissão pelo painel entrar, ela grava na mesma tabela com
 * `origem = 'plataforma'` e a vaga aparece preenchida sozinha — por isso
 * a apólice da plataforma é só leitura deste lado.
 */

export interface ApoliceRow {
  id: string
  tipo: string
  origem: string
  nome_original: string | null
  nome: string
  seguradora: string | null
  apolice_numero: string | null
  vigencia_inicio: string | null
  vigencia_fim: string | null
  observacoes: string | null
  tamanho_bytes: number | null
  created_at: string
}

interface Props {
  contratoId: string
  apolices: ApoliceRow[]
  /** Garantia do contrato: sem seguro fiança, a vaga da fiança sai discreta. */
  garantiaTipo: string
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"

const VAGAS: { tipo: TipoApolice; label: string; Icone: typeof Flame; cor: string }[] = [
  { tipo: 'apolice_incendio', label: 'Seguro incêndio', Icone: Flame, cor: 'text-orange-600' },
  { tipo: 'apolice_fianca', label: 'Seguro fiança', Icone: ShieldCheck, cor: 'text-violet-600' },
]

function fmtData(d: string | null): string {
  if (!d) return '—'
  const [y, m, dd] = d.slice(0, 10).split('-')
  return `${dd}/${m}/${y}`
}

function fmtTamanho(b: number | null): string {
  if (!b) return ''
  return b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`
}

/** Dias até o fim da vigência; negativo = já venceu. null = sem data. */
function diasAteVencer(fim: string | null): number | null {
  if (!fim) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const [y, m, d] = fim.slice(0, 10).split('-').map(Number)
  return Math.round((new Date(y, m - 1, d).getTime() - hoje.getTime()) / 86400000)
}

export function ApolicesSecao({ contratoId, apolices, garantiaTipo }: Props) {
  const router = useRouter()
  const [modal, setModal] = useState<{ tipo: TipoApolice; editando: ApoliceRow | null } | null>(null)
  const [erroLista, setErroLista] = useState('')
  const [abrindo, setAbrindo] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const porTipo = new Map(apolices.map(a => [a.tipo, a]))

  const abrir = (id: string) => {
    setErroLista('')
    setAbrindo(id)
    startTransition(async () => {
      const r = await gerarUrlApolice(id)
      setAbrindo(null)
      if (r.error || !r.url) { setErroLista(r.error ?? 'Falha ao abrir o PDF.'); return }
      window.open(r.url, '_blank', 'noopener,noreferrer')
    })
  }

  const remover = (a: ApoliceRow, label: string) => {
    if (!confirm(`Remover a apólice de ${label.toLowerCase()}? O PDF é apagado junto.`)) return
    setErroLista('')
    setRemovendo(a.id)
    startTransition(async () => {
      const r = await removerApolice(a.id)
      setRemovendo(null)
      if (r.error) { setErroLista(r.error); return }
      router.refresh()
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ShieldCheck size={14} className="text-violet-600" />
          Apólices
          <span className="text-xs font-normal text-gray-400">({apolices.length}/2)</span>
        </h2>
        <span className="text-[10px] text-gray-400">
          PDF baixado da seguradora — guardado em área privada
        </span>
      </div>

      {erroLista && <p className="text-xs text-rose-600 mb-2">{erroLista}</p>}

      <div className="grid sm:grid-cols-2 gap-3">
        {VAGAS.map(({ tipo, label, Icone, cor }) => {
          const a = porTipo.get(tipo)
          // Contrato sem seguro fiança não precisa da vaga em destaque, mas
          // continua podendo anexar — fiança contratada por fora existe.
          const previsto = tipo === 'apolice_fianca' ? garantiaTipo === 'seguro_fianca' : true
          const dias = diasAteVencer(a?.vigencia_fim ?? null)
          const vencida = dias !== null && dias < 0
          const vencendo = dias !== null && dias >= 0 && dias <= 30
          const daPlataforma = a?.origem === 'plataforma'

          return (
            <div
              key={tipo}
              className={`rounded-xl border p-3 ${
                vencida ? 'border-rose-200 bg-rose-50/40'
                  : a ? 'border-gray-100'
                  : previsto ? 'border-dashed border-gray-200' : 'border-dashed border-gray-100'
              }`}
            >
              <p className={`text-xs font-semibold flex items-center gap-1.5 mb-2 ${a ? 'text-gray-700' : 'text-gray-400'}`}>
                <Icone size={13} className={a ? cor : 'text-gray-300'} />
                {label}
                {daPlataforma && (
                  <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold">
                    emitida no painel
                  </span>
                )}
              </p>

              {!a ? (
                <>
                  <p className="text-[11px] text-gray-400 mb-2">
                    {previsto
                      ? 'Nenhuma apólice anexada.'
                      : 'Não é a garantia deste contrato — anexe só se houver.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setModal({ tipo, editando: null })}
                    className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-800 border border-violet-200 hover:bg-violet-50 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <Upload size={12} /> Anexar PDF
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-900 truncate" title={a.seguradora ?? ''}>
                    {a.seguradora?.trim() || 'Seguradora não informada'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {a.apolice_numero?.trim() ? `Apólice ${a.apolice_numero}` : 'Sem número informado'}
                  </p>
                  <p className={`text-[11px] mt-1 flex items-center gap-1 ${
                    vencida ? 'text-rose-600 font-semibold' : vencendo ? 'text-amber-600 font-semibold' : 'text-gray-500'
                  }`}>
                    {vencida || vencendo ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                    {a.vigencia_fim
                      ? vencida
                        ? `Vencida em ${fmtData(a.vigencia_fim)}`
                        : `Vigente até ${fmtData(a.vigencia_fim)}${vencendo ? ` · ${dias} dia${dias === 1 ? '' : 's'}` : ''}`
                      : 'Vigência não informada'}
                  </p>
                  {a.observacoes && (
                    <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{a.observacoes}</p>
                  )}

                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => abrir(a.id)}
                      disabled={isPending}
                      className="flex items-center gap-1 text-xs text-violet-700 hover:bg-violet-50 px-2 py-1.5 rounded-lg disabled:opacity-40"
                      title={`Abrir o PDF ${a.nome_original ?? ''} ${fmtTamanho(a.tamanho_bytes)}`.trim()}
                    >
                      {abrindo === a.id ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                      Abrir
                    </button>
                    {!daPlataforma && (
                      <>
                        <button
                          type="button"
                          onClick={() => setModal({ tipo, editando: a })}
                          disabled={isPending}
                          className="flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-100 px-2 py-1.5 rounded-lg disabled:opacity-40"
                        >
                          <Pencil size={12} /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => remover(a, label)}
                          disabled={isPending}
                          className="text-gray-300 hover:text-rose-600 p-1.5 disabled:opacity-40"
                          title="Remover apólice"
                        >
                          {removendo === a.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {modal && (
        <ModalApolice
          contratoId={contratoId}
          tipo={modal.tipo}
          label={VAGAS.find(v => v.tipo === modal.tipo)!.label}
          editando={modal.editando}
          onFechar={() => setModal(null)}
          onPronto={() => { setModal(null); router.refresh() }}
        />
      )}
    </section>
  )
}

// ── Modal: anexar um PDF novo ou corrigir os dados de um já anexado ──
function ModalApolice({
  contratoId, tipo, label, editando, onFechar, onPronto,
}: {
  contratoId: string
  tipo: TipoApolice
  label: string
  editando: ApoliceRow | null
  onFechar: () => void
  onPronto: () => void
}) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [seguradora, setSeguradora] = useState(editando?.seguradora ?? '')
  const [numero, setNumero] = useState(editando?.apolice_numero ?? '')
  const [inicio, setInicio] = useState(editando?.vigencia_inicio?.slice(0, 10) ?? '')
  const [fim, setFim] = useState(editando?.vigencia_fim?.slice(0, 10) ?? '')
  const [observacoes, setObservacoes] = useState(editando?.observacoes ?? '')
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const escolher = (f: File | null) => {
    setErro('')
    if (!f) { setArquivo(null); return }
    if (f.type !== 'application/pdf') { setErro('Envie o PDF da apólice.'); return }
    if (f.size > 20 * 1024 * 1024) { setErro('Arquivo maior que 20MB.'); return }
    setArquivo(f)
  }

  const salvar = () => {
    setErro('')
    if (fim && inicio && fim < inicio) { setErro('O fim da vigência é antes do início.'); return }

    startTransition(async () => {
      if (editando) {
        const r = await atualizarApolice(editando.id, {
          seguradora, apolice_numero: numero,
          vigencia_inicio: inicio, vigencia_fim: fim, observacoes,
        })
        if (r.error) { setErro(r.error); return }
      } else {
        if (!arquivo) { setErro('Escolha o PDF da apólice.'); return }
        const fd = new FormData()
        fd.set('contrato_id', contratoId)
        fd.set('tipo', tipo)
        fd.set('file', arquivo)
        fd.set('seguradora', seguradora)
        fd.set('apolice_numero', numero)
        fd.set('vigencia_inicio', inicio)
        fd.set('vigencia_fim', fim)
        fd.set('observacoes', observacoes)
        const r = await uploadApolice(fd)
        if (r.error) { setErro(r.error); return }
      }
      onPronto()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isPending && onFechar()}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck size={16} className="text-violet-600" />
            {editando ? `Editar apólice — ${label}` : `Anexar apólice — ${label}`}
          </h2>
          <button type="button" onClick={onFechar} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mb-3">
          {editando
            ? 'Corrige os dados cadastrais. Pra trocar o PDF, remova a apólice e anexe de novo.'
            : 'Baixe o PDF na plataforma da seguradora e anexe aqui. Fica em área privada, aberto só por link temporário.'}
        </p>

        {!editando && (
          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-600 mb-1">PDF da apólice *</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={e => escolher(e.target.files?.[0] ?? null)}
              disabled={isPending}
              className="w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
            />
            {arquivo && (
              <p className="text-[11px] text-gray-500 mt-1 truncate">
                {arquivo.name} · {fmtTamanho(arquivo.size)}
              </p>
            )}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Seguradora</label>
            <input value={seguradora} onChange={e => setSeguradora(e.target.value)} placeholder="Ex: Porto Seguro" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nº da apólice</label>
            <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: 0531.12.0009876" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Início da vigência</label>
            <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Fim da vigência</label>
            <input type="date" value={fim} onChange={e => setFim(e.target.value)} className={inputCls} />
          </div>
        </div>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label>
        <textarea
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          rows={2}
          placeholder="Ex: parcelado em 4x no cartão do proprietário"
          className={`${inputCls} resize-y`}
        />

        {erro && <p className="text-xs text-rose-600 mt-2">{erro}</p>}

        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={onFechar} disabled={isPending} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={isPending || (!editando && !arquivo)}
            className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {editando ? 'Salvar' : 'Anexar apólice'}
          </button>
        </div>
      </div>
    </div>
  )
}
