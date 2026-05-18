'use client'

import { useState, useTransition } from 'react'
import { Upload, Loader2, Check, AlertCircle, FileText } from 'lucide-react'
import { submitAtualizacaoCadastro } from '../actions'

export interface CampoExistente {
  chave: string
  label: string
  valorAtual: string
}

export interface TipoDoc {
  chave: string
  label: string
}

interface Props {
  token: string
  nomePessoa: string | null
  campos: CampoExistente[]
  documentos: TipoDoc[]
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900'

export function FormAtualizacao({ token, nomePessoa, campos, documentos }: Props) {
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(campos.map(c => [c.chave, c.valorAtual ?? '']))
  )
  const [arquivos, setArquivos] = useState<Record<string, File | null>>({})
  const [isPending, startTransition] = useTransition()
  const [estado, setEstado] = useState<'idle' | 'sucesso' | 'erro'>('idle')
  const [msgErro, setMsgErro] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setEstado('idle')
    setMsgErro('')
    const fd = new FormData()
    for (const c of campos) fd.set(c.chave, valores[c.chave] ?? '')
    for (const d of documentos) {
      const f = arquivos[d.chave]
      if (f) fd.set(`doc_${d.chave}`, f)
    }
    startTransition(async () => {
      const r = await submitAtualizacaoCadastro(token, fd)
      if (r.error) { setEstado('erro'); setMsgErro(r.error); return }
      setEstado('sucesso')
    })
  }

  if (estado === 'sucesso') {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Check size={28} className="text-green-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Obrigado!</h2>
        <p className="text-sm text-gray-500">Seu cadastro foi atualizado. Pode fechar esta página.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {nomePessoa && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5 text-xs text-violet-900">
          Cadastro de <strong>{nomePessoa}</strong>
        </div>
      )}

      {campos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Dados solicitados</h2>
          {campos.map(c => (
            <Campo
              key={c.chave}
              label={c.label}
              chave={c.chave}
              valor={valores[c.chave] ?? ''}
              onChange={v => setValores(s => ({ ...s, [c.chave]: v }))}
            />
          ))}
        </section>
      )}

      {documentos.length > 0 && (
        <section className="space-y-3 pt-2 border-t border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Documentos solicitados</h2>
          <p className="text-[11px] text-gray-500">JPG, PNG, WEBP, HEIC ou PDF até 10MB cada.</p>
          {documentos.map(d => (
            <UploadCampo
              key={d.chave}
              label={d.label}
              arquivo={arquivos[d.chave] ?? null}
              onChange={f => setArquivos(s => ({ ...s, [d.chave]: f }))}
            />
          ))}
        </section>
      )}

      {estado === 'erro' && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2.5">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{msgErro}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        {isPending ? 'Enviando...' : 'Enviar cadastro'}
      </button>
    </form>
  )
}

function Campo({
  label, chave, valor, onChange,
}: {
  label: string; chave: string; valor: string; onChange: (v: string) => void
}) {
  const tipo = chave === 'email' ? 'email'
    : chave === 'data_nascimento' ? 'date'
    : 'text'

  if (chave === 'estado_civil') {
    return (
      <label className="block">
        <span className="text-xs font-medium text-gray-600 block mb-1">{label}</span>
        <select value={valor} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">—</option>
          <option value="solteiro">Solteiro(a)</option>
          <option value="casado">Casado(a)</option>
          <option value="divorciado">Divorciado(a)</option>
          <option value="viuvo">Viúvo(a)</option>
          <option value="uniao_estavel">União estável</option>
        </select>
      </label>
    )
  }
  if (chave === 'banco_tipo_conta') {
    return (
      <label className="block">
        <span className="text-xs font-medium text-gray-600 block mb-1">{label}</span>
        <select value={valor} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">—</option>
          <option value="corrente">Corrente</option>
          <option value="poupanca">Poupança</option>
        </select>
      </label>
    )
  }
  if (chave === 'pix_tipo') {
    return (
      <label className="block">
        <span className="text-xs font-medium text-gray-600 block mb-1">{label}</span>
        <select value={valor} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">—</option>
          <option value="cpf">CPF</option>
          <option value="cnpj">CNPJ</option>
          <option value="email">E-mail</option>
          <option value="telefone">Telefone</option>
          <option value="aleatoria">Chave aleatória</option>
        </select>
      </label>
    )
  }

  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600 block mb-1">{label}</span>
      <input
        type={tipo}
        value={valor}
        onChange={e => onChange(e.target.value)}
        className={inputCls}
        placeholder={label}
      />
    </label>
  )
}

function UploadCampo({
  label, arquivo, onChange,
}: { label: string; arquivo: File | null; onChange: (f: File | null) => void }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
      {arquivo ? (
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 text-sm">
          <FileText size={14} className="text-violet-700 shrink-0" />
          <span className="flex-1 truncate text-violet-900">{arquivo.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-red-600 hover:text-red-700"
          >
            Remover
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-200 hover:border-violet-300 hover:bg-violet-50/30 rounded-xl px-3 py-3 cursor-pointer">
          <Upload size={14} className="text-gray-400" />
          <span className="text-xs text-gray-600">Selecionar arquivo</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="hidden"
            onChange={e => onChange(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  )
}
