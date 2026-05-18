'use client'

import { Printer } from 'lucide-react'

export function BotaoImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-violet-200 bg-white hover:bg-violet-50 text-sm font-medium text-violet-700"
      title="Imprimir / salvar como PDF"
    >
      <Printer size={14} /> Imprimir
    </button>
  )
}
