import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { FormEditarAdm } from './form-editar'

export default async function EditarContratoAdmPage({ params }: { params: Promise<{ id: string }> }) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { id } = await params

  const [{ data: contrato }, { data: pessoas }, { data: imoveis }] = await Promise.all([
    supabase
      .from('contratos_administracao')
      .select('*')
      .eq('id', id)
      .eq('user_id', acesso.userId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('pessoas')
      .select('id, nome, cpf_cnpj, tipo')
      .eq('user_id', acesso.userId)
      .in('tipo', ['proprietario', 'outro'])
      .order('nome', { ascending: true }),
    supabase
      .from('imoveis')
      .select('id, titulo, endereco_resumido')
      .eq('user_id', acesso.userId)
      .order('updated_at', { ascending: false })
      .limit(200),
  ])

  if (!contrato) notFound()

  return (
    <main className="px-4 py-6 max-w-3xl mx-auto pb-32">
      <Breadcrumbs items={[
        { label: 'Contratos de administração', href: '/painel/administracoes' },
        { label: contrato.codigo, href: `/painel/administracoes/${id}` },
        { label: 'Editar' },
      ]} />
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/painel/administracoes/${id}`}
          className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
        >
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Editar contrato de administração</h1>
          <p className="text-xs text-gray-500">{contrato.codigo}</p>
        </div>
      </div>

      <FormEditarAdm
        id={id}
        inicial={{
          proprietario_id: contrato.proprietario_id,
          imovel_id: contrato.imovel_id ?? null,
          data_inicio: contrato.data_inicio,
          data_termino: contrato.data_termino,
          prazo_meses: contrato.prazo_meses,
          renovacao_automatica: contrato.renovacao_automatica,
          taxa_tipo: contrato.taxa_tipo,
          taxa_valor: Number(contrato.taxa_valor),
          primeira_parcela_cheia: contrato.primeira_parcela_cheia,
          dia_repasse: contrato.dia_repasse,
          recebimento_comissao: contrato.recebimento_comissao ?? 'mensal',
          exclusividade: contrato.exclusividade,
          multa_rescisao_meses: contrato.multa_rescisao_meses,
          aviso_previo_dias: contrato.aviso_previo_dias,
          observacoes: contrato.observacoes ?? '',
        }}
        pessoas={(pessoas ?? []) as Array<{ id: string; nome: string; cpf_cnpj: string | null; tipo: string }>}
        imoveis={(imoveis ?? []) as Array<{ id: string; titulo: string; endereco_resumido: string | null }>}
      />
    </main>
  )
}
