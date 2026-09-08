import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Stethoscope } from 'lucide-react'
import { sessaoAtual } from '@/lib/homologacao/sessao'
import { ambienteMaximiza } from '@/lib/seguros/maximiza/client'
import { PainelDiagnostico } from './_components/painel-diagnostico'

export const metadata = {
  title: 'Diagnóstico da cotação — AluguelCuiabá × Maximiza',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

/**
 * Cotação de incêndio com o resultado de cada chamada à vista.
 *
 * Escrita para ser aberta por QUALQUER pessoa da corretora, técnica ou
 * não. O formulário já vem preenchido: quem abre só aperta o botão e vê a
 * sequência acontecer. Quem entende de API abre o "detalhe técnico" de
 * cada passo e tem endpoint, status e tempo.
 *
 * Não emite nada. O diagnóstico chama consulta e cálculo — contratar e
 * cancelar não existem neste caminho.
 */
export default async function DiagnosticoPage() {
  const sessao = await sessaoAtual()
  if (!sessao) redirect('/homologacao/encerrada?motivo=expirada')

  let ambiente: 1 | 2 | null = null
  try { ambiente = ambienteMaximiza() } catch { ambiente = null }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-5">
        <div>
          <Link
            href="/homologacao"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={13} />
            Voltar ao roteiro
          </Link>

          <h1 className="mt-2 flex items-center gap-2 text-xl font-bold text-gray-900">
            <Stethoscope size={20} className="text-orange-600" />
            Diagnóstico da cotação de incêndio
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Roda uma cotação de verdade contra a API e mostra o que aconteceu em
            cada passo. <strong>Nada aqui emite apólice nem gera cobrança</strong> —
            são consultas e o cálculo, que é consulta de preço.
          </p>
        </div>

        {ambiente && (
          <div
            className={`rounded-xl px-3.5 py-2.5 text-[11px] leading-snug ring-1 ${
              ambiente === 1
                ? 'bg-red-50 text-red-900 ring-red-300'
                : 'bg-slate-50 text-slate-700 ring-slate-200'
            }`}
          >
            <strong>{ambiente === 1 ? 'Produção.' : 'Homologação.'}</strong>{' '}
            {ambiente === 1
              ? 'As chamadas vão para o ambiente de produção da corretora. Continua sendo só consulta e cálculo.'
              : 'As chamadas vão para o ambiente de homologação.'}
          </div>
        )}

        <PainelDiagnostico sessao={{ nome: sessao.nome, organizacao: sessao.organizacao }} />
      </div>
    </main>
  )
}
