'use client'

import { useState, useTransition } from 'react'
import { Loader2, Check, Pencil } from 'lucide-react'

export interface CampoCapa {
  key: string
  label: string
  auto: string        // valor automático (placeholder)
  multiline?: boolean
}

/**
 * Editor genérico dos campos da capa do contrato. Cada campo sobrescreve
 * só o valor correspondente na capa; vazio = volta ao automático (mostrado
 * como placeholder). Salva no blur via a action recebida em `onSalvar`.
 */
export function CapaOverridesEditor({
  campos, iniciais, onSalvar, disabled = false,
}: {
  campos: CampoCapa[]
  iniciais: Record<string, string>
  onSalvar: (overrides: Record<string, string>) => Promise<{ ok?: boolean; error?: string }>
  disabled?: boolean
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => ({ ...iniciais }))
  const [salvo, setSalvo] = useState<Record<string, string>>(() => ({ ...iniciais }))
  const [erro, setErro] = useState('')
  const [pending, start] = useTransition()

  const editados = campos.filter(c => (vals[c.key] ?? '').trim()).length

  const set = (key: string, v: string) => setVals(prev => ({ ...prev, [key]: v }))

  const persistir = (key: string) => {
    if ((vals[key] ?? '') === (salvo[key] ?? '')) return
    const next = { ...vals }
    start(async () => {
      const r = await onSalvar(next)
      if (r.error) { setErro(r.error); return }
      setErro('')
      setSalvo({ ...next })
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Pencil size={12} className="text-violet-600" /> Campos da capa
        </h3>
        {pending
          ? <Loader2 size={12} className="animate-spin text-gray-400" />
          : editados > 0 && <span className="text-[10px] text-violet-600 font-semibold flex items-center gap-0.5"><Check size={11} /> {editados} editado{editados > 1 ? 's' : ''}</span>}
      </div>
      <p className="text-[10px] text-gray-400 -mt-1 leading-tight">
        Cada campo sobrescreve só esse item da capa. Vazio = usa o automático (mostrado em cinza).
      </p>
      <div className="space-y-1.5">
        {campos.map(c => (
          <div key={c.key}>
            <label className="text-[10px] font-semibold text-gray-500 block mb-0.5">{c.label}</label>
            {c.multiline ? (
              <textarea
                value={vals[c.key] ?? ''}
                onChange={e => set(c.key, e.target.value)}
                onBlur={() => persistir(c.key)}
                disabled={disabled || pending}
                rows={2}
                placeholder={c.auto ? `Automático: ${c.auto}` : 'Texto livre…'}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y disabled:bg-gray-50"
              />
            ) : (
              <input
                type="text"
                value={vals[c.key] ?? ''}
                onChange={e => set(c.key, e.target.value)}
                onBlur={() => persistir(c.key)}
                disabled={disabled || pending}
                placeholder={c.auto ? `Automático: ${c.auto}` : 'Texto livre…'}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50"
              />
            )}
          </div>
        ))}
      </div>
      {erro && <p className="text-[10px] text-red-600">{erro}</p>}
    </div>
  )
}
