import { AlertOctagon } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { FluxoAssinatura } from './_components/fluxo-assinatura'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

function PaginaErro({ titulo, mensagem }: { titulo: string; mensagem: string }) {
  return (
    <main className="min-h-screen bg-gray-50 py-20 px-4">
      <div className="max-w-md mx-auto bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertOctagon size={28} className="text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{titulo}</h1>
        <p className="text-sm text-gray-500">{mensagem}</p>
      </div>
    </main>
  )
}

export default async function AssinarPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: sig } = await admin
    .from('contrato_assinatura_signatarios')
    .select('nome, papel, status, assinatura:contrato_assinaturas!inner(user_id, tipo_contrato, contrato_id, titulo, status)')
    .eq('token', token)
    .maybeSingle()

  if (!sig) return <PaginaErro titulo="Link inválido" mensagem="Este link de assinatura não existe ou foi removido." />
  const proc = (Array.isArray(sig.assinatura) ? sig.assinatura[0] : sig.assinatura) as
    { user_id: string; tipo_contrato: 'locacao' | 'administracao'; contrato_id: string; titulo: string | null; status: string } | undefined
  if (!proc) return <PaginaErro titulo="Processo não encontrado" mensagem="Não foi possível localizar este contrato." />
  if (proc.status === 'cancelado') return <PaginaErro titulo="Solicitação cancelada" mensagem="O solicitante cancelou esta assinatura. Peça um novo link." />

  const { data: anunc } = await admin.from('perfis').select('razao_social, nome').eq('id', proc.user_id).maybeSingle()
  const nomeAnunc = anunc?.razao_social || anunc?.nome || 'AluguelCuiabá'

  const pdfUrl = proc.tipo_contrato === 'administracao'
    ? `/api/contratos-admin/${proc.contrato_id}/pdf?st=${token}`
    : `/api/contratos/${proc.contrato_id}/pdf?st=${token}`

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-6 text-white shadow-sm mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{nomeAnunc}</p>
          <h1 className="text-2xl font-bold mt-1">Assinatura de contrato</h1>
          <p className="text-sm text-violet-100 mt-2">Confira o documento, confirme o código por e-mail, tire a selfie e assine.</p>
        </div>

        <FluxoAssinatura
          token={token}
          pdfUrl={pdfUrl}
          nome={sig.nome}
          papel={sig.papel}
          titulo={proc.titulo ?? 'Contrato'}
          jaAssinado={sig.status === 'assinado'}
        />

        <p className="text-center text-[11px] text-gray-400 mt-5">
          Assinatura eletrônica com trilha de auditoria · {nomeAnunc} via AluguelCuiabá.
        </p>
      </div>
    </main>
  )
}
