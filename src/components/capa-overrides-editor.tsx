'use client'

import { useState, useTransition } from 'react'
import { Loader2, Check, Pencil } from 'lucide-react'

export interface CampoCapa {
  key: string
  label: string
  auto: string        // valor automático (placeholder)
  multiline?: boolean
  /** Lista fechada (select); vazio = automático. */
  opcoes?: Array<{ valor: string; rotulo: string }>
}

/**
 * Editor genérico dos campos da capa do contrato. Cada campo sobrescreve
 * só o valor correspondente na capa; vazio = volta ao automático (mostrado
 * como placeholder). Salva no blur via a action recebida em `onSalvar`.
 */
export function CapaOverridesEditor({
  campos, iniciais, onSalvar, disabled = false,
  titulo = 'Campos da capa',
  ajuda = 'Cada campo sobrescreve só esse item da capa. Vazio = usa o automático (mostrado em cinza).',
}: {
  titulo?: string
  ajuda?: string
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

  const persistir = (key: string, valor?: string) => {
    const atual = valor ?? vals[key] ?? ''
    if (atual === (salvo[key] ?? '')) return
    // Manda só as chaves deste editor: a action mescla com as demais.
    const next = Object.fromEntries(campos.map(c => [c.key, c.key === key ? atual : (vals[c.key] ?? '')]))
    start(async () => {
      const r = await onSalvar(next)
      if (r.error) { setErro(r.error); return }
      setErro('')
      setSalvo(prev => ({ ...prev, ...next }))
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Pencil size={12} className="text-violet-600" /> {titulo}
        </h3>
        {pending
          ? <Loader2 size={12} className="animate-spin text-gray-400" />
          : editados > 0 && <span className="text-[10px] text-violet-600 font-semibold flex items-center gap-0.5"><Check size={11} /> {editados} editado{editados > 1 ? 's' : ''}</span>}
      </div>
      <p className="text-[10px] text-gray-400 -mt-1 leading-tight">
        {ajuda}
      </p>
      <div className="space-y-1.5">
        {campos.map(c => (
          <div key={c.key}>
            <label className="text-[10px] font-semibold text-gray-500 block mb-0.5">{c.label}</label>
            {c.opcoes ? (
              <select
                value={vals[c.key] ?? ''}
                onChange={e => { set(c.key, e.target.value); persistir(c.key, e.target.value) }}
                disabled={disabled || pending}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50 bg-white"
              >
                <option value="">Automático{c.auto ? `: ${c.auto}` : ''}</option>
                {c.opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
              </select>
            ) : c.multiline ? (
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
