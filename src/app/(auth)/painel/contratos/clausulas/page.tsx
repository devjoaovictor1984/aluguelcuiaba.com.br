import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { ClausulasCliente } from './_components/clausulas-cliente'
import { carregarBiblioteca } from './carregar-biblioteca'

export const dynamic = 'force-dynamic'

export default async function ClausulasPage() {
  const acesso = await exigirAcessoCRM()
  // Só cláusulas de LOCAÇÃO (administração tem página própria em /painel/administracoes/clausulas)
  const clausulas = await carregarBiblioteca(acesso.userId, 'locacao')

  return (
    <main className="px-4 py-6 pb-20">
      <Breadcrumbs items={[
        { label: 'Contratos', href: '/painel/contratos' },
        { label: 'Cláusulas de locação' },
      ]} />
      <ClausulasCliente clausulasIniciais={clausulas} escopo="locacao" />
    </main>
  )
}
