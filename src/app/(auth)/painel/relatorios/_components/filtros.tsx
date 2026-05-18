'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { User, Building2, FileText, Printer } from 'lucide-react'

interface PessoaOpcao {
  id: string
  nome: string
  tipo: string
}

interface Props {
  pessoas: PessoaOpcao[]
  tipo: 'inquilino' | 'proprietario'
  pessoaId: string
  ano: number
}

export function FiltrosRelatorio({ pessoas, tipo, pessoaId, ano }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const setParams = (novos: Record<string, string | null>) => {
    const params = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(novos)) {
      if (v === null || v === '') params.delete(k)
      else params.set(k, v)
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const ano_atual = new Date().getFullYear()
  const anos = Array.from({ length: 6 }, (_, i) => ano_atual - 4 + i) // 4 atrás até 1 à frente
  const filtradas = pessoas.filter(p => tipo === 'inquilino' ? p.tipo === 'inquilino' : p.tipo === 'proprietario')

  const imprimir = () => window.print()

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 print:hidden ${isPending ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-end gap-3">
        {/* Tipo */}
        <div>
          <label className="text-[11px] font-semibold text-gray-500 block mb-1 uppercase">Tipo</label>
          <div className="inline-flex rounded-xl border border-gray-200 p-0.5">
            <button
              onClick={() => setParams({ tipo: 'inquilino', pessoa: '' })}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ${
                tipo === 'inquilino' ? 'bg-violet-700 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <User size={12} /> Inquilino
            </button>
            <button
              onClick={() => setParams({ tipo: 'proprietario', pessoa: '' })}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ${
                tipo === 'proprietario' ? 'bg-violet-700 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Building2 size={12} /> Proprietário
            </button>
          </div>
        </div>

        {/* Pessoa */}
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] font-semibold text-gray-500 block mb-1 uppercase">
            {tipo === 'inquilino' ? 'Inquilino' : 'Proprietário'}
          </label>
          <select
            value={pessoaId}
            onChange={e => setParams({ pessoa: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:outline-none"
          >
            <option value="">— escolher —</option>
            {filtradas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>

        {/* Ano */}
        <div>
          <label className="text-[11px] font-semibold text-gray-500 block mb-1 uppercase">Ano</label>
          <select
            value={ano}
            onChange={e => setParams({ ano: e.target.value })}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:outline-none"
          >
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="ml-auto flex items-end gap-2">
          {pessoaId && (
            <button
              onClick={imprimir}
              className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              title="Imprimir ou salvar como PDF (Ctrl+P)"
            >
              <Printer size={14} /> Imprimir
            </button>
          )}
        </div>
      </div>

      {!pessoaId && (
        <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
          <FileText size={12} /> Escolha um {tipo === 'inquilino' ? 'inquilino' : 'proprietário'} pra ver o extrato anual.
        </p>
      )}
    </div>
  )
}
