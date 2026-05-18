import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { PessoaForm } from '../_components/pessoa-form'
import { DocumentosSecao, type DocumentoRow } from '../_components/documentos-secao'
import { BlocoSolicitacao, type SolicitacaoAtiva } from '../_components/bloco-solicitacao'

export default async function EditarPessoaPage({ params }: { params: Promise<{ id: string }> }) {
  const acesso = await exigirAcessoCRM()
  const { id } = await params

  const supabase = await createClient()

  const [{ data: pessoa }, { data: docs }, solicitacoesRes] = await Promise.all([
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
    supabase
      .from('solicitacoes_cadastro')
      .select('id, token, campos, tipos_documento, expira_em, preenchido_em, revogado_em, created_at')
      .eq('pessoa_id', id)
      .eq('user_id', acesso.userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!pessoa) notFound()

  const documentos: DocumentoRow[] = (docs ?? []) as DocumentoRow[]
  // Se a migration v11 ainda não rodou, solicitacoesRes.error vai existir.
  // Trata como lista vazia pra não quebrar a página.
  const solicitacoes: SolicitacaoAtiva[] = (solicitacoesRes.data ?? []) as SolicitacaoAtiva[]
  const v11Faltando = !!solicitacoesRes.error
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''

  return (
    <div className="px-6 pt-6 pb-10">
      <Link href="/painel/clientes" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
        <ArrowLeft size={12} /> Voltar
      </Link>
      <h1 className="text-xl font-bold text-gray-900">Editar pessoa</h1>
      <p className="text-sm text-gray-500">{pessoa.nome}</p>
      <PessoaForm modo="editar" id={pessoa.id} inicial={pessoa} />
      <DocumentosSecao pessoaId={pessoa.id} documentos={documentos} />
      {v11Faltando ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-6 text-xs text-amber-900">
          ⚠️ Para usar o link de atualização de cadastro, rode <code className="bg-white px-1 rounded">supabase/migrations/crm_v11_solicitacoes_cadastro.sql</code> no Supabase SQL Editor.
        </div>
      ) : (
        <BlocoSolicitacao
          pessoaId={pessoa.id}
          nomePessoa={pessoa.nome}
          telefoneWhatsapp={pessoa.whatsapp ?? pessoa.telefone ?? null}
          emailPessoa={pessoa.email ?? null}
          baseUrl={baseUrl}
          solicitacoes={solicitacoes}
        />
      )}
    </div>
  )
}
