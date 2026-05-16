import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { PessoaForm } from '../_components/pessoa-form'

export default async function NovaPessoaPage() {
  await exigirAcessoCRM()
  return (
    <div className="px-6 pt-6">
      <Link href="/painel/clientes" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
        <ArrowLeft size={12} /> Voltar
      </Link>
      <h1 className="text-xl font-bold text-gray-900">Nova pessoa</h1>
      <p className="text-sm text-gray-500">Cadastre proprietário, inquilino, fiador ou testemunha.</p>
      <PessoaForm modo="novo" />
    </div>
  )
}
