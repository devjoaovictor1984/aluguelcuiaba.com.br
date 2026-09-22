'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

/**
 * Campo de um dado só, com rótulo e botão de copiar.
 *
 * Nasceu do preenchimento da nota fiscal no Notas Cuiabá: o site pede CPF
 * do tomador, depois CEP, endereço e número do imóvel, cada um num campo
 * separado, e todos eles estavam no CRM misturados dentro de frases. O
 * `select-all` ajudava, mas ainda exigia selecionar com o mouse e torcer
 * pra não pegar o rótulo junto.
 *
 * `valorCopia` existe porque o que se lê e o que se cola nem sempre são a
 * mesma coisa: o CPF aparece pontuado e vai pro formulário só com dígitos.
 */
export function CampoCopia({
  rotulo, valor, valorCopia, className = '', mono = true,
}: {
  rotulo?: string
  valor: string
  /** O que vai pro clipboard, quando diferente do que está escrito. */
  valorCopia?: string
  className?: string
  mono?: boolean
}) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valorCopia ?? valor)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // Sem clipboard (http sem permissão, navegador antigo): o valor
      // continua na tela e o select-all resolve na mão.
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title={copiado ? 'Copiado!' : `Copiar${rotulo ? ` ${rotulo.toLowerCase()}` : ''}`}
      className={`group inline-flex items-center gap-1 max-w-full text-left rounded px-1 -mx-1 hover:bg-violet-50 transition-colors print:hover:bg-transparent ${className}`}
    >
      {rotulo && (
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold shrink-0">
          {rotulo}
        </span>
      )}
      <span className={`${mono ? 'font-mono' : ''} truncate select-all`}>{valor}</span>
      {copiado
        ? <Check size={11} className="text-green-600 shrink-0" />
        : <Copy size={11} className="text-gray-300 group-hover:text-violet-500 shrink-0 print:hidden" />}
    </button>
  )
}
