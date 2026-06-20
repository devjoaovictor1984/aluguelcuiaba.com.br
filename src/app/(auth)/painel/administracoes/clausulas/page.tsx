import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { ClausulasCliente, type ClausulaRow } from '../../contratos/clausulas/_components/clausulas-cliente'

export const dynamic = 'force-dynamic'

export default async function ClausulasAdministracaoPage() {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  // Só cláusulas de ADMINISTRAÇÃO — banco separado do contrato de locação.
  const { data: clausulas } = await supabase
    .from('contrato_clausulas')
    .select('id, tipo, categoria, titulo, numero, corpo, ativa, updated_at')
    .eq('user_id', acesso.userId)
    .eq('tipo', 'administracao')
    .order('numero', { ascending: true })

  return (
    <main className="px-4 py-6 pb-20">
      <Breadcrumbs items={[
        { label: 'Contratos de administração', href: '/painel/administracoes' },
        { label: 'Cláusulas de administração' },
      ]} />
      <ClausulasCliente clausulasIniciais={(clausulas ?? []) as ClausulaRow[]} escopo="administracao" />
    </main>
  )
}
