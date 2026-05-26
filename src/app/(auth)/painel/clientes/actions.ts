'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

export type TipoPessoa = 'proprietario' | 'inquilino' | 'fiador' | 'testemunha' | 'outro'

export type TipoPix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'

export interface PessoaInput {
  tipo: TipoPessoa
  nome: string
  cpf_cnpj?: string | null
  rg?: string | null
  rg_orgao_emissor?: string | null
  rg_uf?: string | null
  data_nascimento?: string | null
  naturalidade?: string | null
  estado_civil?: string | null
  regime_bens?: string | null
  profissao?: string | null
  renda_mensal?: number | null
  nacionalidade?: string | null
  nome_pai?: string | null
  nome_mae?: string | null
  // Cônjuge (quando estado_civil = casado/união estável)
  conjuge_nome?: string | null
  conjuge_cpf?: string | null
  conjuge_rg?: string | null
  conjuge_rg_orgao?: string | null
  conjuge_data_nascimento?: string | null
  conjuge_profissao?: string | null
  conjuge_nacionalidade?: string | null
  conjuge_naturalidade?: string | null
  conjuge_nome_pai?: string | null
  conjuge_nome_mae?: string | null
  conjuge_endereco_logradouro?: string | null
  conjuge_endereco_numero?: string | null
  conjuge_endereco_bairro?: string | null
  conjuge_endereco_cidade?: string | null
  conjuge_endereco_estado?: string | null
  conjuge_endereco_cep?: string | null
  // Pessoa jurídica (preenchido quando cpf_cnpj tem 14 dígitos)
  nome_fantasia?: string | null
  inscricao_estadual?: string | null
  inscricao_municipal?: string | null
  email?: string | null
  telefone?: string | null
  whatsapp?: string | null
  endereco_cep?: string | null
  endereco_logradouro?: string | null
  endereco_numero?: string | null
  endereco_complemento?: string | null
  endereco_bairro?: string | null
  endereco_cidade?: string | null
  endereco_estado?: string | null
  // Recebimento
  pix_tipo?: TipoPix | null
  pix_chave?: string | null
  banco_nome?: string | null
  banco_codigo?: string | null
  banco_agencia?: string | null
  banco_conta?: string | null
  banco_tipo_conta?: 'corrente' | 'poupanca' | null
  banco_titular?: string | null
  observacoes?: string | null
}

function valida(input: PessoaInput): string | null {
  if (!input.nome?.trim() || input.nome.trim().length < 2) return 'Informe o nome.'
  if (!['proprietario','inquilino','fiador','testemunha','outro'].includes(input.tipo)) return 'Tipo inválido.'
  return null
}

function limpar(input: PessoaInput): PessoaInput {
  const clean = { ...input } as Record<string, unknown>
  for (const k of Object.keys(clean)) {
    const v = clean[k]
    if (typeof v === 'string') {
      const t = v.trim()
      clean[k] = t === '' ? null : t
    }
  }
  clean.nome = (input.nome ?? '').trim()
  clean.tipo = input.tipo
  return clean as unknown as PessoaInput
}

export async function criarPessoa(input: PessoaInput) {
  const erro = valida(input)
  if (erro) return { error: erro }

  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('pessoas')
    .insert({ ...limpar(input), user_id: acesso.userId })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/painel/clientes')
  return { ok: true, id: data.id as string }
}

export async function atualizarPessoa(id: string, input: PessoaInput) {
  const erro = valida(input)
  if (erro) return { error: erro }

  await exigirAcessoCRM()
  const supabase = await createClient()

  const { error } = await supabase
    .from('pessoas')
    .update({ ...limpar(input), updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/painel/clientes')
  revalidatePath(`/painel/clientes/${id}`)
  return { ok: true }
}

export async function excluirPessoa(id: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  // Soft delete: marca deleted_at; pode ser restaurado em /painel/lixeira
  const { error } = await supabase
    .from('pessoas')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', acesso.userId)
    .is('deleted_at', null)
  if (error) return { error: error.message }
  revalidatePath('/painel/clientes')
  revalidatePath('/painel/lixeira')
  redirect('/painel/clientes')
}

export async function restaurarPessoa(id: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { error } = await supabase
    .from('pessoas')
    .update({ deleted_at: null })
    .eq('id', id)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  revalidatePath('/painel/clientes')
  revalidatePath('/painel/lixeira')
  return { ok: true }
}

export async function excluirDefinitivoPessoa(id: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  // Hard delete — só permite se já estava soft-deleted
  const { error } = await supabase
    .from('pessoas')
    .delete()
    .eq('id', id)
    .eq('user_id', acesso.userId)
    .not('deleted_at', 'is', null)
  if (error) return { error: error.message }
  revalidatePath('/painel/lixeira')
  return { ok: true }
}
