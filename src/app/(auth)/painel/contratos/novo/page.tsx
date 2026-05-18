import Link from 'next/link'
import { ArrowLeft, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { PLANOS } from '@/lib/constants'
import { WizardContrato } from './_components/wizard-contrato'

export default async function NovoContratoPage() {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  // Limite de contratos por plano (mesma cota dos imóveis). Admin/profissional liberados.
  const plano = (acesso.plano ?? 'free') as keyof typeof PLANOS
  const limite = PLANOS[plano]?.imoveis ?? 1
  let cotaAtingida = false
  let totalContratos = 0
  if (acesso.role !== 'admin' && limite < 999) {
    const { count } = await supabase
      .from('contratos_locacao')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', acesso.userId)
      .is('deleted_at', null)
    totalContratos = count ?? 0
    cotaAtingida = totalContratos >= limite
  }

  if (cotaAtingida) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock size={28} className="text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Limite de contratos atingido</h1>
        <p className="text-gray-500 mb-1">
          O plano <strong>{PLANOS[plano]?.nome}</strong> permite até <strong>{limite} contratos ativos</strong>.
        </p>
        <p className="text-gray-400 text-sm mb-8">
          Você já tem {totalContratos} contrato{totalContratos === 1 ? '' : 's'} cadastrado{totalContratos === 1 ? '' : 's'}.
          Encerre ou exclua algum antes de criar novo, ou faça upgrade para Profissional (ilimitado).
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/planos" className="bg-violet-700 hover:bg-violet-800 text-white font-bold py-4 rounded-2xl transition-colors">
            Ver planos de assinatura
          </Link>
          <Link href="/painel/contratos" className="text-gray-500 hover:text-gray-700 text-sm py-2">
            Voltar para contratos
          </Link>
        </div>
      </div>
    )
  }

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
      <p className="text-sm text-gray-500 mb-4">
        Wizard em 4 etapas. Você pode voltar a qualquer momento.
        {limite < 999 && acesso.role !== 'admin' && (
          <span className="ml-1 text-gray-400">· {totalContratos}/{limite} no plano {PLANOS[plano]?.nome}</span>
        )}
      </p>
      <WizardContrato imoveis={imoveis ?? []} pessoas={pessoas ?? []} />
    </div>
  )
}
