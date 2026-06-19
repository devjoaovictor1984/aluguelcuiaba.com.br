import { AlertOctagon } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { FormConsideracao } from './_components/form-consideracao'

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

export default async function RevisarContratoPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('contrato_revisao_links')
    .select('id, user_id, tipo_contrato, contrato_id, titulo, expira_em, revogado_em')
    .eq('token', token)
    .maybeSingle()

  if (!link) return <PaginaErro titulo="Link inválido" mensagem="Esse link de revisão não existe ou foi removido." />
  if (link.revogado_em) return <PaginaErro titulo="Link cancelado" mensagem="O solicitante cancelou este link. Peça um novo." />
  // eslint-disable-next-line react-hooks/purity -- server component dinâmico; data do request
  if (new Date(link.expira_em).getTime() < Date.now()) {
    return <PaginaErro titulo="Link expirado" mensagem="Este link já passou da validade. Peça um novo ao solicitante." />
  }

  const { data: anunciante } = await admin
    .from('perfis')
    .select('nome, razao_social')
    .eq('id', link.user_id)
    .maybeSingle()
  const nomeAnunciante = anunciante?.razao_social || anunciante?.nome || 'AluguelCuiabá'

  const pdfUrl = link.tipo_contrato === 'administracao'
    ? `/api/contratos-admin/${link.contrato_id}/pdf?rt=${token}`
    : `/api/contratos/${link.contrato_id}/pdf?rt=${token}`

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-6 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{nomeAnunciante}</p>
          <h1 className="text-2xl font-bold mt-1">Revisão do contrato</h1>
          <p className="text-sm text-violet-100 mt-2">
            Leia o contrato abaixo{link.titulo ? ` (${link.titulo})` : ''} e, se tiver observações, registre no campo
            de considerações. Nada é assinado aqui — é só para sua revisão.
          </p>
        </div>

        {/* PDF do contrato */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <iframe src={pdfUrl} title="Contrato" className="w-full" style={{ height: '75vh', border: 'none' }} />
          <div className="px-4 py-3 border-t border-gray-100 text-center">
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-violet-700 hover:underline">
              Abrir o PDF em nova aba
            </a>
          </div>
        </div>

        {/* Considerações */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Suas considerações</h2>
          <p className="text-xs text-gray-500 mb-4">
            Escreva o que quiser ajustar ou comentar. O solicitante recebe suas observações.
          </p>
          <FormConsideracao token={token} />
        </div>

        <p className="text-center text-[11px] text-gray-400">
          Enviado por <strong>{nomeAnunciante}</strong> via AluguelCuiabá.
        </p>
      </div>
    </main>
  )
}
