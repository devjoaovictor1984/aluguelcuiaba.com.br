import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { FormEditarContrato } from './_components/form-editar-contrato'

export default async function EditarContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const acesso = await exigirAcessoCRM()
  const { id } = await params

  const supabase = await createClient()
  const { data: contrato } = await supabase
    .from('contratos_locacao')
    .select('id, codigo, status, data_termino, observacoes, clausulas_extras, indice_reajuste, data_proximo_reajuste, vistoria_ok, termo_chaves_ok, forma_pagamento, inquilino_mora_no_imovel')
    .eq('id', id)
    .eq('user_id', acesso.userId)
    .single()

  if (!contrato) notFound()

  return (
    <div className="px-6 pt-6 max-w-3xl">
      <Link href={`/painel/contratos/${id}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
        <ArrowLeft size={12} /> Voltar ao contrato
      </Link>
      <h1 className="text-xl font-bold text-gray-900 font-mono">{contrato.codigo}</h1>
      <p className="text-sm text-gray-500 mb-4">
        Editar status, datas e observações. Valores financeiros e parcelas não podem ser alterados aqui.
      </p>
      <FormEditarContrato id={id} dados={contrato} />
    </div>
  )
}
