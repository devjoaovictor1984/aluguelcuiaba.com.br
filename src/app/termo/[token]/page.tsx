import { AlertOctagon, CheckCircle2, KeyRound } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { TermoLocatario } from './_components/termo-locatario'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function TermoPublicoPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: termo } = await admin
    .from('termos_entrega_chaves')
    .select(`
      id, user_id, contrato_id, status,
      data_entrega, qtd_chaves_entregues, qtd_controles_entregues,
      estado_entrega, observacoes, expira_em,
      assinado_locatario_em
    `)
    .eq('token', token)
    .maybeSingle()

  if (!termo) return <Erro titulo="Link inválido" mensagem="Esse link de termo não existe ou foi removido." />
  if (termo.status === 'recusada') return <Erro titulo="Termo recusado" mensagem="Você já recusou esse termo. Entre em contato com a administradora." />
  if (termo.status === 'assinado' || termo.status === 'assinado_locatario') {
    const quando = termo.assinado_locatario_em ? new Date(termo.assinado_locatario_em).toLocaleString('pt-BR') : '—'
    return (
      <Sucesso
        titulo="Termo já assinado"
        mensagem={`Você assinou esse termo em ${quando}. Pode fechar a página.`}
      />
    )
  }
  if (termo.status !== 'enviada') return <Erro titulo="Indisponível" mensagem="Esse termo ainda está em preparação. Peça pra administradora enviar novamente." />
  if (termo.expira_em && new Date(termo.expira_em).getTime() < Date.now()) {
    return <Erro titulo="Link expirado" mensagem="Esse link passou da validade. Peça um novo." />
  }

  // Administradora (emitente)
  const { data: perfil } = await admin.from('perfis').select('nome, razao_social').eq('id', termo.user_id).maybeSingle()
  const nomeAdmin = perfil?.razao_social ?? perfil?.nome ?? 'AluguelCuiabá'

  // Contrato + imóvel + locatário
  const { data: contrato } = await admin
    .from('contratos_locacao')
    .select('codigo, inquilino:pessoas!inquilino_id(nome), imovel:imoveis(titulo, endereco_resumido)')
    .eq('id', termo.contrato_id)
    .maybeSingle()
  const inquilino = contrato && (Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino) as { nome: string } | null
  const imovel = contrato && (Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel) as { titulo: string; endereco_resumido: string | null } | null

  return (
    <main className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-100">
              <KeyRound size={14} /> {nomeAdmin}
            </div>
            <h1 className="text-xl font-bold mt-1">Termo de entrega de chaves</h1>
            <p className="text-sm text-violet-100 mt-1">
              Confira os dados da devolução, tire uma selfie e assine para confirmar a entrega das chaves.
            </p>
            {contrato?.codigo && (
              <p className="text-xs text-violet-200 mt-2">
                Contrato {contrato.codigo}{imovel?.titulo ? ` · ${imovel.titulo}` : ''}
              </p>
            )}
          </div>

          <div className="p-5">
            <TermoLocatario
              token={token}
              dataEntrega={termo.data_entrega}
              qtdChaves={termo.qtd_chaves_entregues ?? 0}
              qtdControles={termo.qtd_controles_entregues ?? 0}
              estadoEntrega={termo.estado_entrega}
              observacoes={termo.observacoes}
              inquilinoNome={inquilino?.nome ?? null}
              imovelEndereco={imovel?.endereco_resumido ?? null}
            />
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-4">
          Termo gerado via AluguelCuiabá. Sua assinatura digital e selfie são registradas com data, hora e IP.
        </p>
      </div>
    </main>
  )
}

function Erro({ titulo, mensagem }: { titulo: string; mensagem: string }) {
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

function Sucesso({ titulo, mensagem }: { titulo: string; mensagem: string }) {
  return (
    <main className="min-h-screen bg-gray-50 py-20 px-4">
      <div className="max-w-md mx-auto bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="text-green-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{titulo}</h1>
        <p className="text-sm text-gray-500">{mensagem}</p>
      </div>
    </main>
  )
}
