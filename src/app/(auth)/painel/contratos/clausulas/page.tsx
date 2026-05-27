import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { ClausulasCliente, type ClausulaRow } from './_components/clausulas-cliente'

export const dynamic = 'force-dynamic'

export default async function ClausulasPage() {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: clausulas } = await supabase
    .from('contrato_clausulas')
    .select('id, tipo, categoria, titulo, numero, corpo, ativa, updated_at')
    .eq('user_id', acesso.userId)
    .order('tipo', { ascending: true })
    .order('numero', { ascending: true })

  return (
    <main className="px-4 py-6 pb-20">
      <Breadcrumbs items={[
        { label: 'Contratos', href: '/painel/contratos' },
        { label: 'Banco de cláusulas' },
      ]} />
      <ClausulasCliente clausulasIniciais={(clausulas ?? []) as ClausulaRow[]} />
    </main>
  )
}
