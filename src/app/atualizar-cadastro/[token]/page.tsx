import { AlertOctagon, CheckCircle2 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { FormAtualizacao, type CampoExistente, type TipoDoc } from './_components/form-atualizacao'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

const LABELS_CAMPO: Record<string, string> = {
  nome: 'Nome completo',
  cpf_cnpj: 'CPF ou CNPJ',
  rg: 'RG',
  data_nascimento: 'Data de nascimento',
  estado_civil: 'Estado civil',
  profissao: 'Profissão',
  nacionalidade: 'Nacionalidade',
  nome_fantasia: 'Nome fantasia',
  inscricao_estadual: 'Inscrição estadual',
  inscricao_municipal: 'Inscrição municipal',
  email: 'E-mail',
  telefone: 'Telefone',
  whatsapp: 'WhatsApp',
  endereco_cep: 'CEP',
  endereco_logradouro: 'Logradouro',
  endereco_numero: 'Número',
  endereco_complemento: 'Complemento',
  endereco_bairro: 'Bairro',
  endereco_cidade: 'Cidade',
  endereco_estado: 'Estado (UF)',
  pix_tipo: 'Tipo de chave PIX',
  pix_chave: 'Chave PIX',
  banco_nome: 'Banco',
  banco_codigo: 'Código do banco',
  banco_agencia: 'Agência',
  banco_conta: 'Conta',
  banco_tipo_conta: 'Tipo de conta',
  banco_titular: 'Titular da conta',
}

const LABELS_DOC: Record<string, string> = {
  rg: 'RG',
  cpf: 'CPF',
  cnh: 'CNH',
  passaporte: 'Passaporte',
  comprovante_renda: 'Comprovante de renda',
  comprovante_residencia: 'Comprovante de residência',
  contracheque: 'Contracheque',
  extrato_bancario: 'Extrato bancário',
  imposto_renda: 'Imposto de renda',
  certidao_casamento: 'Certidão de casamento',
  certidao_nascimento: 'Certidão de nascimento',
  foto: 'Foto',
  outro: 'Outro',
}

export default async function AtualizarCadastroPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: sol } = await admin
    .from('solicitacoes_cadastro')
    .select('id, user_id, pessoa_id, campos, tipos_documento, expira_em, preenchido_em, revogado_em')
    .eq('token', token)
    .maybeSingle()

  if (!sol) return <PaginaErro titulo="Link inválido" mensagem="Esse link de atualização não existe ou foi removido." />
  if (sol.revogado_em) return <PaginaErro titulo="Link cancelado" mensagem="O solicitante cancelou este link. Entre em contato pra receber um novo." />
  if (sol.preenchido_em) {
    return <PaginaConfirmacao titulo="Cadastro já preenchido" mensagem="Este link já foi usado. Se precisar corrigir algo, peça um novo ao solicitante." />
  }
  if (new Date(sol.expira_em).getTime() < Date.now()) {
    return <PaginaErro titulo="Link expirado" mensagem="Este link já passou da validade. Peça um novo ao solicitante." />
  }

  // Busca dados atuais da pessoa pra pré-preencher (só para os campos solicitados)
  const camposSolicitados = (sol.campos as string[] | null) ?? []
  const tiposDoc = ((sol.tipos_documento as string[] | null) ?? []).filter(t => LABELS_DOC[t])

  let valoresAtuais: Record<string, string> = {}
  if (camposSolicitados.length > 0) {
    const selectStr = ['nome', ...camposSolicitados].join(', ')
    const { data: pessoa } = await admin
      .from('pessoas')
      .select(selectStr)
      .eq('id', sol.pessoa_id)
      .maybeSingle()
    if (pessoa) {
      valoresAtuais = Object.fromEntries(
        Object.entries(pessoa as unknown as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'string' ? v : (v ?? '').toString()])
      )
    }
  }

  // Nome do solicitante (anunciante)
  const { data: anunciante } = await admin
    .from('perfis').select('nome').eq('id', sol.user_id).maybeSingle()
  const nomeAnunciante = anunciante?.nome ?? 'AluguelCuiabá'

  const campos: CampoExistente[] = camposSolicitados
    .filter(c => LABELS_CAMPO[c])
    .map(c => ({ chave: c, label: LABELS_CAMPO[c], valorAtual: valoresAtuais[c] ?? '' }))

  const documentos: TipoDoc[] = tiposDoc.map(t => ({ chave: t, label: LABELS_DOC[t] }))

  const expira = new Date(sol.expira_em)
  const horasRestantes = Math.max(0, Math.round((expira.getTime() - Date.now()) / 3600000))

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{nomeAnunciante}</p>
            <h1 className="text-2xl font-bold mt-1">Atualizar cadastro</h1>
            <p className="text-sm text-violet-100 mt-2">
              {nomeAnunciante} solicitou que você complete alguns dados.
              {' '}<strong>Este link expira em {horasRestantes}h.</strong>
            </p>
          </div>

          <div className="p-6">
            <FormAtualizacao
              token={token}
              nomePessoa={valoresAtuais.nome ?? null}
              campos={campos}
              documentos={documentos}
            />
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-4">
          Seus dados vão direto pro cadastro de <strong>{nomeAnunciante}</strong> no AluguelCuiabá. Nenhuma cópia é compartilhada com terceiros.
        </p>
      </div>
    </main>
  )
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

function PaginaConfirmacao({ titulo, mensagem }: { titulo: string; mensagem: string }) {
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
