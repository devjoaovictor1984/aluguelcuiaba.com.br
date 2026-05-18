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
  data_nascimento?: string | null
  estado_civil?: string | null
  profissao?: string | null
  nacionalidade?: string | null
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
  await exigirAcessoCRM()
  const supabase = await createClient()
  const { error } = await supabase.from('pessoas').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/painel/clientes')
  redirect('/painel/clientes')
}
