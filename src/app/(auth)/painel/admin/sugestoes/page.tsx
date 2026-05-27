import { redirect } from 'next/navigation'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { listarSugestoesAdmin } from '../../_actions/sugestoes'
import { SugestoesAdminCliente } from './_components/sugestoes-admin'

export const dynamic = 'force-dynamic'

export default async function SugestoesAdminPage() {
  const acesso = await exigirAcessoCRM()
  if (acesso.role !== 'admin') redirect('/painel')

  const r = await listarSugestoesAdmin()
  if (r.error) return <div className="p-6 text-rose-600">{r.error}</div>

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Sugestões dos usuários</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Feedback enviado pelo botão flutuante. Triar, responder e marcar como implementada/descartada.
        </p>
      </header>

      <SugestoesAdminCliente sugestoes={r.sugestoes ?? []} />
    </div>
  )
}
