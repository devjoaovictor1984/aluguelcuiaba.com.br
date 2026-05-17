'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText, Upload, X, Trash2, Loader2, Download, Image as ImageIcon,
  AlertCircle, Calendar,
} from 'lucide-react'
import {
  uploadDocumentoPessoa, removerDocumentoPessoa, gerarUrlDocumento,
  type TipoDocumento,
} from '../actions-documentos'

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"

const TIPOS: { valor: TipoDocumento; label: string }[] = [
  { valor: 'rg', label: 'RG' },
  { valor: 'cpf', label: 'CPF' },
  { valor: 'cnh', label: 'CNH' },
  { valor: 'passaporte', label: 'Passaporte' },
  { valor: 'comprovante_renda', label: 'Comprovante de renda' },
  { valor: 'comprovante_residencia', label: 'Comprovante de residência' },
  { valor: 'contracheque', label: 'Contracheque' },
  { valor: 'extrato_bancario', label: 'Extrato bancário' },
  { valor: 'imposto_renda', label: 'Imposto de renda' },
  { valor: 'certidao_casamento', label: 'Certidão de casamento' },
  { valor: 'certidao_nascimento', label: 'Certidão de nascimento' },
  { valor: 'foto', label: 'Foto' },
  { valor: 'outro', label: 'Outro' },
]
const LABEL_TIPO = Object.fromEntries(TIPOS.map(t => [t.valor, t.label]))

export interface DocumentoRow {
  id: string
  tipo: TipoDocumento
  nome_original: string
  tamanho_bytes: number | null
  mime_type: string | null
  validade: string | null
  observacao: string | null
  created_at: string
}

interface Props {
  pessoaId: string
  documentos: DocumentoRow[]
}

function formatarTamanho(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatarData(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('pt-BR')
}

function ehImagem(mime: string | null): boolean {
  return !!mime && mime.startsWith('image/')
}

export function DocumentosSecao({ pessoaId, documentos }: Props) {
  const router = useRouter()
  const [modalAberto, setModalAberto] = useState(false)
  const [abrindo, setAbrindo] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const abrir = (docId: string) => {
    setAbrindo(docId)
    startTransition(async () => {
      const r = await gerarUrlDocumento(docId)
      setAbrindo(null)
      if (r.error || !r.url) { alert(r.error ?? 'Erro ao abrir.'); return }
      window.open(r.url, '_blank', 'noopener,noreferrer')
    })
  }

  const remover = (docId: string, nome: string) => {
    if (!confirm(`Remover o documento "${nome}"?`)) return
    setRemovendo(docId)
    startTransition(async () => {
      const r = await removerDocumentoPessoa(docId)
      setRemovendo(null)
      if (r.error) { alert(r.error); return }
      router.refresh()
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <FileText size={14} className="text-violet-600" />
          Documentos
          <span className="text-xs font-normal text-gray-400">({documentos.length})</span>
        </h2>
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-1.5 text-xs text-white bg-violet-700 hover:bg-violet-800 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Upload size={12} /> Enviar documento
        </button>
      </div>

      {documentos.length === 0 ? (
        <p className="text-xs text-gray-400">
          Nenhum documento cadastrado. Envie RG, CPF, comprovantes ou outros documentos pessoais.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {documentos.map(d => {
            const vencido = d.validade && new Date(d.validade + 'T00:00:00') < new Date()
            return (
              <div key={d.id} className="border border-gray-100 hover:border-violet-200 rounded-xl p-3 transition-colors group">
                <div className="flex items-start gap-2">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
                    {ehImagem(d.mime_type) ? <ImageIcon size={16} /> : <FileText size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium">
                        {LABEL_TIPO[d.tipo] ?? d.tipo}
                      </span>
                      {d.validade && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                          vencido ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          <Calendar size={9} /> {vencido ? 'vencido ' : 'val. '}{formatarData(d.validade)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 font-medium truncate mt-1" title={d.nome_original}>
                      {d.nome_original}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {formatarTamanho(d.tamanho_bytes)}
                      {d.tamanho_bytes && ' · '}
                      {formatarData(d.created_at)}
                    </p>
                    {d.observacao && (
                      <p className="text-[11px] text-gray-500 italic mt-1 line-clamp-2">&ldquo;{d.observacao}&rdquo;</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 mt-2 pt-2 border-t border-gray-50">
                  <button
                    type="button"
                    onClick={() => abrir(d.id)}
                    disabled={isPending && abrindo === d.id}
                    className="flex-1 flex items-center justify-center gap-1 text-xs text-violet-700 hover:bg-violet-50 py-1.5 rounded-lg transition-colors"
                  >
                    {abrindo === d.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Download size={12} />}
                    Abrir
                  </button>
                  <button
                    type="button"
                    onClick={() => remover(d.id, d.nome_original)}
                    disabled={isPending && removendo === d.id}
                    className="px-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remover"
                  >
                    {removendo === d.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Trash2 size={12} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalAberto && (
        <ModalUpload
          pessoaId={pessoaId}
          onFechar={() => setModalAberto(false)}
          onSucesso={() => { setModalAberto(false); router.refresh() }}
        />
      )}
    </section>
  )
}

function ModalUpload({
  pessoaId, onFechar, onSucesso,
}: {
  pessoaId: string
  onFechar: () => void
  onSucesso: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [tipo, setTipo] = useState<TipoDocumento>('rg')
  const [validade, setValidade] = useState('')
  const [observacao, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const enviar = () => {
    setErro('')
    if (!arquivo) { setErro('Selecione um arquivo.'); return }
    if (arquivo.size > 10 * 1024 * 1024) { setErro('Arquivo maior que 10MB.'); return }

    const fd = new FormData()
    fd.set('pessoa_id', pessoaId)
    fd.set('tipo', tipo)
    fd.set('file', arquivo)
    if (validade) fd.set('validade', validade)
    if (observacao) fd.set('observacao', observacao)

    startTransition(async () => {
      const r = await uploadDocumentoPessoa(fd)
      if (r.error) { setErro(r.error); return }
      onSucesso()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl shadow-xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-bold text-gray-900">Enviar documento</h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Tipo *</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoDocumento)} className={inputCls}>
              {TIPOS.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Arquivo *</label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 hover:border-violet-300 hover:bg-violet-50/50 rounded-xl px-3 py-4 text-center transition-colors"
            >
              <Upload size={20} className="mx-auto text-gray-400 mb-1.5" />
              {arquivo ? (
                <>
                  <p className="text-sm text-gray-900 font-medium truncate">{arquivo.name}</p>
                  <p className="text-[11px] text-gray-400">{formatarTamanho(arquivo.size)} · clique para trocar</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 font-medium">Clique para escolher</p>
                  <p className="text-[11px] text-gray-400">JPG, PNG, WEBP, HEIC ou PDF · até 10MB</p>
                </>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              onChange={e => setArquivo(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Validade (opcional)</label>
            <input type="date" value={validade} onChange={e => setValidade(e.target.value)} className={inputCls} />
            <p className="text-[11px] text-gray-400 mt-0.5">Para documentos com vencimento (CNH, comprovante de renda, etc).</p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Observação</label>
            <textarea value={observacao} onChange={e => setObs(e.target.value)} rows={2}
              className={`${inputCls} resize-y`} placeholder="Notas internas (opcional)" />
          </div>

          {erro && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-gray-100">
          <button onClick={onFechar} disabled={isPending}
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100">
            Cancelar
          </button>
          <button onClick={enviar} disabled={isPending || !arquivo}
            className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
