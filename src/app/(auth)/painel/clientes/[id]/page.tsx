import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { PessoaForm } from '../_components/pessoa-form'
import { DocumentosSecao, type DocumentoRow } from '../_components/documentos-secao'

export default async function EditarPessoaPage({ params }: { params: Promise<{ id: string }> }) {
  const acesso = await exigirAcessoCRM()
  const { id } = await params

  const supabase = await createClient()

  const [{ data: pessoa }, { data: docs }] = await Promise.all([
    supabase
      .from('pessoas')
      .select('*')
      .eq('id', id)
      .eq('user_id', acesso.userId)
      .single(),
    supabase
      .from('pessoas_documentos')
      .select('id, tipo, nome_original, tamanho_bytes, mime_type, validade, observacao, created_at')
      .eq('pessoa_id', id)
      .eq('user_id', acesso.userId)
      .order('created_at', { ascending: false }),
  ])

  if (!pessoa) notFound()

  const documentos: DocumentoRow[] = (docs ?? []) as DocumentoRow[]

  return (
    <div className="px-6 pt-6 pb-10">
      <Link href="/painel/clientes" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
        <ArrowLeft size={12} /> Voltar
      </Link>
      <h1 className="text-xl font-bold text-gray-900">Editar pessoa</h1>
      <p className="text-sm text-gray-500">{pessoa.nome}</p>
      <PessoaForm modo="editar" id={pessoa.id} inicial={pessoa} />
      <DocumentosSecao pessoaId={pessoa.id} documentos={documentos} />
    </div>
  )
}
