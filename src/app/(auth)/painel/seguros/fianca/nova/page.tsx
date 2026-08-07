import Link from 'next/link'
import { ArrowLeft, ShieldCheck, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoSeguros } from '@/lib/seguros/acesso'
import { verificarPerfilParaSeguros } from '@/lib/seguros/imobiliaria'
import { FormNovaAnalise } from './_components/form-nova-analise'
import { AvisoDemo } from '../../_components/aviso-demo'

interface Props {
  searchParams: Promise<{ contrato?: string }>
}

export const metadata = { title: 'Nova cotação de fiança' }

export default async function NovaAnalisePage({ searchParams }: Props) {
  const { contrato } = await searchParams
  const acesso = await exigirAcessoSeguros()
  const supabase = await createClient()
  const admin = createAdminClient()

  const perfil = await verificarPerfilParaSeguros(admin, acesso.userId)

  // Inquilinos pra pré-preencher. Quem já tem cadastro no CRM não deveria
  // ser redigitado.
  const { data: pessoas } = await supabase
    .from('pessoas')
    .select('id, nome, cpf_cnpj, email, telefone, whatsapp, data_nascimento')
    .eq('user_id', acesso.userId)
    .eq('tipo', 'inquilino')
    .is('deleted_at', null)
    .order('nome')
    .limit(300)

  // Se veio de um contrato, puxa os dados dele.
  let contratoBase: {
    id: string
    codigo: string
    valor_aluguel: number
    condominio_mensal: number | null
    iptu_mensal: number | null
    duracao_meses: number | null
    inquilino_id: string | null
    imovel_id: string | null
  } | null = null

  if (contrato) {
    const { data } = await supabase
      .from('contratos_locacao')
      .select('id, codigo, valor_aluguel, condominio_mensal, iptu_mensal, duracao_meses, inquilino_id, imovel_id')
      .eq('id', contrato)
      .eq('user_id', acesso.userId)
      .maybeSingle()
    contratoBase = data
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto pb-32">
      <div>
        <Link href="/painel/seguros/fianca" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} /> Seguro fiança
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck size={20} className="text-violet-600" /> Nova cotação
        </h1>
        <p className="text-sm text-gray-500">
          Cota em paralelo nas seguradoras parceiras. O parecer costuma sair em minutos.
        </p>
      </div>

      <AvisoDemo />

      {!perfil.pronto ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 flex items-start gap-2.5">
          <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Complete seu perfil antes de cotar</p>
            <p className="text-xs text-amber-800 mt-1">
              A seguradora precisa do seu cadastro completo pra vincular a cotação.
              Falta: <strong>{perfil.faltando?.join(', ')}</strong>.
            </p>
            <Link
              href="/painel/perfil"
              className="inline-block mt-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-2 rounded-lg"
            >
              Completar perfil
            </Link>
          </div>
        </div>
      ) : (
        <FormNovaAnalise
          inquilinos={(pessoas ?? []).map(p => ({
            id: p.id,
            nome: p.nome,
            cpfCnpj: p.cpf_cnpj,
            email: p.email,
            telefone: p.whatsapp ?? p.telefone,
            dataNascimento: p.data_nascimento,
          }))}
          contratoBase={contratoBase}
        />
      )}
    </div>
  )
}
