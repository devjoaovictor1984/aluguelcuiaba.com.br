import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { WizardContrato } from './_components/wizard-contrato'

export default async function NovoContratoPage() {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const [{ data: imoveis }, { data: pessoas }] = await Promise.all([
    supabase
      .from('imoveis')
      .select('id, titulo, preco, endereco_resumido, proprietario_id, bairro:bairros(nome)')
      .eq('user_id', acesso.userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('pessoas')
      .select('id, tipo, nome, cpf_cnpj')
      .eq('user_id', acesso.userId)
      .is('deleted_at', null)
      .order('nome', { ascending: true }),
  ])

  return (
    <div className="px-6 pt-6">
      <Link href="/painel/contratos" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
        <ArrowLeft size={12} /> Voltar
      </Link>
      <h1 className="text-xl font-bold text-gray-900">Novo contrato</h1>
      <p className="text-sm text-gray-500 mb-4">Wizard em 4 etapas. Você pode voltar a qualquer momento.</p>
      <WizardContrato imoveis={imoveis ?? []} pessoas={pessoas ?? []} />
    </div>
  )
}
