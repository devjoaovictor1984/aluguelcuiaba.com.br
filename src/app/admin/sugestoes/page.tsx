import { listarSugestoesAdmin } from '@/app/(auth)/painel/_actions/sugestoes'
import { SugestoesAdminCliente } from './_components/sugestoes-admin'

export const dynamic = 'force-dynamic'

export default async function SugestoesAdminPage() {
  const r = await listarSugestoesAdmin()
  if (r.error) return <div className="p-6 text-rose-600">{r.error}</div>

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Sugestões dos usuários</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Feedback enviado pelo botão flutuante do painel. Triar, responder e marcar como implementada/descartada.
        </p>
      </header>

      <SugestoesAdminCliente sugestoes={r.sugestoes ?? []} />
    </div>
  )
}
