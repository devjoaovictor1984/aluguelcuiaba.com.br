import Link from 'next/link'
import { ArrowLeft, Flame, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { verificarPerfilParaSeguros } from '@/lib/seguros/imobiliaria'
import { AvisoDemo } from '../../_components/aviso-demo'
import { FormIncendio } from './_components/form-incendio'

interface Props {
  searchParams: Promise<{ contrato?: string }>
}

export const metadata = { title: 'Nova cotação de incêndio' }

export default async function NovaIncendioPage({ searchParams }: Props) {
  const { contrato } = await searchParams
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const admin = createAdminClient()

  const perfil = await verificarPerfilParaSeguros(admin, acesso.userId)

  // Contratos ativos: o incêndio quase sempre nasce de um contrato — dali
  // vêm inquilino, proprietário, imóvel e aluguel de uma vez.
  const { data: contratos } = await supabase
    .from('contratos_locacao')
    .select(`
      id, codigo, valor_aluguel, data_inicio, data_termino,
      imovel_id,
      imovel:imoveis(titulo, endereco_completo, endereco_resumido, endereco_numero, endereco_cep, bairro:bairros(nome)),
      inquilino:pessoas!inquilino_id(id, nome, cpf_cnpj, email, telefone, whatsapp, data_nascimento),
      proprietario:pessoas!proprietario_id(id, nome, cpf_cnpj)
    `)
    .eq('user_id', acesso.userId)
    .in('status', ['ativo', 'inadimplente'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)

  const um = <T,>(v: unknown): T | null =>
    (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) as T | null

  const opcoes = (contratos ?? []).map(c => {
    const imovel = um<{
      titulo: string
      endereco_completo: string | null
      endereco_resumido: string | null
      endereco_numero: string | null
      endereco_cep: string | null
      bairro: unknown
    }>(c.imovel)
    const inq = um<{
      id: string; nome: string; cpf_cnpj: string | null; email: string | null
      telefone: string | null; whatsapp: string | null; data_nascimento: string | null
    }>(c.inquilino)
    const prop = um<{ id: string; nome: string; cpf_cnpj: string | null }>(c.proprietario)

    return {
      id: c.id,
      codigo: c.codigo,
      titulo: imovel?.titulo ?? c.codigo,
      aluguel: Number(c.valor_aluguel) || 0,
      dataInicio: c.data_inicio,
      dataTermino: c.data_termino,
      imovelId: c.imovel_id,
      endereco: {
        cep: imovel?.endereco_cep ?? '',
        endereco: imovel?.endereco_completo ?? imovel?.endereco_resumido ?? '',
        numero: imovel?.endereco_numero ?? '',
        bairro: um<{ nome: string }>(imovel?.bairro)?.nome ?? '',
        cidade: 'Cuiabá',
        uf: 'MT',
      },
      inquilino: inq ? {
        id: inq.id,
        nome: inq.nome,
        cpfCnpj: inq.cpf_cnpj ?? '',
        email: inq.email ?? '',
        telefone: inq.whatsapp ?? inq.telefone ?? '',
        dataNascimento: inq.data_nascimento ?? '',
      } : null,
      proprietario: prop ? {
        id: prop.id,
        nome: prop.nome,
        cpfCnpj: prop.cpf_cnpj ?? '',
      } : null,
    }
  })

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto pb-32">
      <div>
        <Link href="/painel/seguros/incendio" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600 mb-2">
          <ArrowLeft size={12} /> Seguro incêndio
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Flame size={20} className="text-orange-500" /> Nova cotação
        </h1>
        <p className="text-sm text-gray-500">
          O cálculo sai na hora — não há análise de crédito.
        </p>
      </div>

      <AvisoDemo />

      {!perfil.pronto ? (
        <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 px-4 py-4 flex items-start gap-2.5">
          <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Complete seu perfil antes de cotar</p>
            <p className="text-xs text-amber-800 mt-1">
              Falta: <strong>{perfil.faltando?.join(', ')}</strong>.
            </p>
            <Link href="/painel/perfil" className="inline-block mt-2 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-2 text-xs font-semibold text-white">
              Completar perfil
            </Link>
          </div>
        </div>
      ) : (
        <FormIncendio contratos={opcoes} contratoInicial={contrato ?? null} />
      )}
    </div>
  )
}
