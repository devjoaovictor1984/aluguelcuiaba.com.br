import Link from 'next/link'
import { ArrowLeft, Clock } from 'lucide-react'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

export default async function NovoContratoPage() {
  await exigirAcessoCRM()
  return (
    <div className="px-6 pt-6 max-w-2xl">
      <Link href="/painel/contratos" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
        <ArrowLeft size={12} /> Voltar
      </Link>
      <h1 className="text-xl font-bold text-gray-900">Novo contrato</h1>
      <div className="mt-6 bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
        <Clock size={32} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm font-medium text-gray-700 mb-1">Wizard em construção</p>
        <p className="text-xs text-gray-500">
          Próxima fase: imóvel → inquilino → garantia → valores → gerar parcelas.
        </p>
      </div>
    </div>
  )
}
