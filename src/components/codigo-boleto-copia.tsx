'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

// Mostra o código de controle do boleto (ex: 2026CT001-03) em monospace,
// com botão de copiar — pro corretor colar no "seu número" do banco.
export function CodigoBoletoCopia({ codigo, className = '' }: { codigo: string; className?: string }) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // clipboard indisponível (http sem permissão) — ignora, código fica visível
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title={copiado ? 'Copiado!' : 'Copiar código do boleto'}
      className={`group inline-flex items-center gap-1 font-mono text-xs text-gray-600 hover:text-violet-700 transition-colors ${className}`}
    >
      {codigo}
      {copiado
        ? <Check size={11} className="text-green-600 shrink-0" />
        : <Copy size={11} className="text-gray-300 group-hover:text-violet-500 shrink-0" />}
    </button>
  )
}
