import Link from 'next/link'
import { Flame, Clock, ShieldCheck } from 'lucide-react'

export const metadata = { title: 'Seguro incêndio' }

/**
 * Placeholder honesto: a documentação da API de incêndio ainda não chegou
 * da Maximiza. O menu já existe pra reservar o lugar, mas sem prometer
 * função que não roda.
 */
export default function SeguroIncendioPage() {
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Flame size={20} className="text-orange-500" /> Seguro incêndio
        </h1>
        <p className="text-sm text-gray-500">
          Obrigatório em contrato de locação pela Lei do Inquilinato.
        </p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
          <Clock size={24} className="text-orange-500" />
        </div>
        <h2 className="font-bold text-gray-900 mb-1">Integração em preparação</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          A cotação de fiança já está no ar. O incêndio entra assim que a
          seguradora enviar a especificação técnica da API dele.
        </p>
        <Link
          href="/painel/seguros/fianca"
          className="inline-flex items-center gap-1.5 mt-5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
        >
          <ShieldCheck size={15} /> Ir para seguro fiança
        </Link>
      </div>
    </div>
  )
}
