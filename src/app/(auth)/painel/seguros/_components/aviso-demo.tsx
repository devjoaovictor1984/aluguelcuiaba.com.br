import { FlaskConical } from 'lucide-react'
import { simuladorAtivo } from '@/lib/seguros/maximiza/simulador'

/**
 * Aviso de que as respostas são simuladas.
 *
 * Fica visível de propósito, inclusive no vídeo: quem assiste precisa
 * saber que nenhuma apólice ali é real. Some sozinho quando MAXIMIZA_DEMO
 * sair do ambiente.
 */
export function AvisoDemo() {
  let ativo = false
  try {
    ativo = simuladorAtivo()
  } catch {
    // A trava de ambiente lança em produção; aqui basta não exibir nada.
    return null
  }
  if (!ativo) return null

  return (
    <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3.5 py-2.5 flex items-start gap-2">
      <FlaskConical size={14} className="text-amber-600 shrink-0 mt-0.5" />
      <p className="text-[11px] text-amber-900 leading-snug">
        <strong>Modo demonstração.</strong> As respostas das seguradoras são
        simuladas — nenhuma apólice é emitida de verdade. Sai do ar quando a
        integração for ligada.
      </p>
    </div>
  )
}
