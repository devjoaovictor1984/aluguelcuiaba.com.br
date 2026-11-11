import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { ClausulasCliente } from '../../contratos/clausulas/_components/clausulas-cliente'
import { carregarBiblioteca } from '../../contratos/clausulas/carregar-biblioteca'

export const dynamic = 'force-dynamic'

export default async function ClausulasAdministracaoPage() {
  const acesso = await exigirAcessoCRM()
  // Só cláusulas de ADMINISTRAÇÃO — banco separado do contrato de locação.
  const clausulas = await carregarBiblioteca(acesso.userId, 'administracao')

  return (
    <main className="px-4 py-6 pb-20">
      <Breadcrumbs items={[
        { label: 'Contratos de administração', href: '/painel/administracoes' },
        { label: 'Cláusulas de administração' },
      ]} />
      <ClausulasCliente clausulasIniciais={clausulas} escopo="administracao" />
    </main>
  )
}
