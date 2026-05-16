import { Wallet } from 'lucide-react'

export default async function FinanceiroPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-2">
        <Wallet size={20} className="text-violet-600" /> Financeiro
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Visão consolidada de parcelas, repasses e comissões. Em construção.
      </p>
      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
        Disponível após você cadastrar os primeiros contratos.
      </div>
    </div>
  )
}
