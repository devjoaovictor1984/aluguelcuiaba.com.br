import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { obterOuCriarGeracao } from './actions'
import { EditorContrato } from './_components/editor-contrato'
import type { TipoClausula } from '@/lib/contratos/placeholders'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GerarContratoPage({ params }: Props) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { id: contratoId } = await params

  // Confirma posse
  const { data: contrato } = await supabase
    .from('contratos_locacao')
    .select(`
      id, codigo, garantia_tipo, valor_aluguel, data_inicio, data_termino,
      inquilino:pessoas!inquilino_id(nome),
      proprietario:pessoas!proprietario_id(nome)
    `)
    .eq('id', contratoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()

  if (!contrato) redirect('/painel/contratos')

  // Obtém ou cria geração
  const r = await obterOuCriarGeracao(contratoId)
  if (r.error || !r.geracao) {
    return (
      <main className="p-6">
        <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertCircle className="mx-auto text-red-600 mb-2" />
          <h2 className="font-bold text-red-900 mb-1">Não foi possível abrir o gerador</h2>
          <p className="text-sm text-red-800">{r.error}</p>
          <Link href={`/painel/contratos/${contratoId}`} className="inline-block mt-4 text-sm text-violet-700 hover:underline">
            Voltar ao contrato
          </Link>
        </div>
      </main>
    )
  }

  // Carrega TODAS as cláusulas do user (pra mostrar opções de adicionar/incluir)
  const { data: todasClausulas } = await supabase
    .from('contrato_clausulas')
    .select('id, tipo, categoria, titulo, numero, corpo')
    .eq('user_id', acesso.userId)
    .eq('ativa', true)
    .order('tipo', { ascending: true })
    .order('numero', { ascending: true })

  // Carrega pessoas elegíveis pra testemunha (qualquer pessoa cadastrada)
  const { data: pessoasTestemunha } = await supabase
    .from('pessoas')
    .select('id, nome, cpf_cnpj, tipo')
    .eq('user_id', acesso.userId)
    .order('nome', { ascending: true })

  const inq = Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino
  const prop = Array.isArray(contrato.proprietario) ? contrato.proprietario[0] : contrato.proprietario

  return (
    <main className="px-4 py-4 pb-20 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link
          href={`/painel/contratos/${contratoId}`}
          className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
        >
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Gerar contrato</h1>
          <p className="text-xs text-gray-500">
            {contrato.codigo} · {prop?.nome ?? '—'} → {inq?.nome ?? '—'}
          </p>
        </div>
      </div>

      <EditorContrato
        contratoId={contratoId}
        codigo={contrato.codigo}
        garantiaTipo={contrato.garantia_tipo}
        geracao={{
          id: r.geracao.id,
          tipo_seguro_incendio: r.geracao.tipo_seguro_incendio,
          saida_sem_multa_12m: r.geracao.saida_sem_multa_12m,
          clausula_ids: r.geracao.clausula_ids as string[],
          testemunha_ids: (r.geracao.testemunha_ids as string[] | null) ?? [],
          clausulas_seguradora_texto: r.geracao.clausulas_seguradora_texto ?? '',
        }}
        todasClausulas={(todasClausulas ?? []).map(c => ({
          ...c,
          tipo: c.tipo as TipoClausula,
        }))}
        pessoas={(pessoasTestemunha ?? []) as Array<{ id: string; nome: string; cpf_cnpj: string | null; tipo: string }>}
      />
    </main>
  )
}
