'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import type { TipoDocumento } from './actions-documentos'

const CAMPOS_VALIDOS = [
  'nome', 'cpf_cnpj', 'rg', 'data_nascimento', 'estado_civil', 'profissao',
  'nacionalidade', 'nome_fantasia', 'inscricao_estadual', 'inscricao_municipal',
  'email', 'telefone', 'whatsapp',
  'endereco_cep', 'endereco_logradouro', 'endereco_numero', 'endereco_complemento',
  'endereco_bairro', 'endereco_cidade', 'endereco_estado',
  'pix_tipo', 'pix_chave',
  'banco_nome', 'banco_codigo', 'banco_agencia', 'banco_conta',
  'banco_tipo_conta', 'banco_titular',
] as const

const TIPOS_DOC_VALIDOS: TipoDocumento[] = [
  'rg', 'cpf', 'cnh', 'passaporte',
  'comprovante_renda', 'comprovante_residencia',
  'contracheque', 'extrato_bancario', 'imposto_renda',
  'certidao_casamento', 'certidao_nascimento',
  'foto', 'outro',
]

export type CampoSolicitavel = typeof CAMPOS_VALIDOS[number]

function gerarToken(): string {
  // 24 bytes = 32 chars base64url, ~10^57 possibilidades. Inviável de adivinhar.
  return randomBytes(24).toString('base64url')
}

export interface GerarLinkInput {
  pessoa_id: string
  campos: string[]
  tipos_documento: string[]
  horas_validade?: number
}

export async function gerarLinkAtualizacao(input: GerarLinkInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (!input.pessoa_id) return { error: 'Pessoa inválida.' }

  const campos = (input.campos ?? []).filter(c => (CAMPOS_VALIDOS as readonly string[]).includes(c))
  const docs = (input.tipos_documento ?? []).filter(d => (TIPOS_DOC_VALIDOS as readonly string[]).includes(d))
  if (campos.length === 0 && docs.length === 0) {
    return { error: 'Selecione pelo menos 1 campo ou documento.' }
  }

  const horas = Math.max(1, Math.min(168, input.horas_validade ?? 24))
  const expira = new Date(Date.now() + horas * 3600 * 1000).toISOString()

  // Confirma posse da pessoa
  const { data: pessoa } = await supabase
    .from('pessoas')
    .select('id')
    .eq('id', input.pessoa_id)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!pessoa) return { error: 'Pessoa não encontrada.' }

  const token = gerarToken()
  const { error } = await supabase.from('solicitacoes_cadastro').insert({
    user_id: acesso.userId,
    pessoa_id: input.pessoa_id,
    token,
    campos,
    tipos_documento: docs,
    expira_em: expira,
  })
  if (error) return { error: error.message }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const url = `${baseUrl}/atualizar-cadastro/${token}`

  revalidatePath(`/painel/clientes/${input.pessoa_id}`)
  return { ok: true, token, url, expira_em: expira }
}

export async function revogarLinkAtualizacao(solicitacaoId: string) {
  const acesso = await exigirAcessoCRM()
  const admin = createAdminClient()

  const { data: sol } = await admin
    .from('solicitacoes_cadastro')
    .select('id, pessoa_id, user_id')
    .eq('id', solicitacaoId)
    .maybeSingle()
  if (!sol || sol.user_id !== acesso.userId) return { error: 'Solicitação não encontrada.' }

  const { error } = await admin
    .from('solicitacoes_cadastro')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', solicitacaoId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/clientes/${sol.pessoa_id}`)
  return { ok: true }
}
