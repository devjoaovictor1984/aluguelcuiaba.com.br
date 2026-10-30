'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { TIPOS_DOC_VALIDOS } from '@/lib/crm/tipos-documento'
import { CHAVES_CAMPO_IMOVEL, dadosImovelParaColunas } from '@/lib/crm/campos-imovel'
import { TAG_IMOVEIS } from '@/lib/supabase/public'
import { revalidarImovel } from '../actions'

const CAMPOS_VALIDOS = [
  'nome', 'cpf_cnpj', 'rg', 'rg_orgao_emissor', 'rg_uf',
  'data_nascimento', 'naturalidade',
  'estado_civil', 'regime_bens', 'profissao', 'renda_mensal',
  'nacionalidade', 'nome_pai', 'nome_mae',
  'nome_fantasia', 'inscricao_estadual', 'inscricao_municipal',
  'email', 'telefone', 'whatsapp',
  'endereco_cep', 'endereco_logradouro', 'endereco_numero', 'endereco_complemento',
  'endereco_bairro', 'endereco_cidade', 'endereco_estado',
  'pix_tipo', 'pix_chave',
  'banco_nome', 'banco_codigo', 'banco_agencia', 'banco_conta',
  'banco_tipo_conta', 'banco_titular',
  // Cônjuge
  'conjuge_nome', 'conjuge_cpf', 'conjuge_rg', 'conjuge_rg_orgao',
  'conjuge_data_nascimento', 'conjuge_profissao', 'conjuge_nacionalidade',
] as const

export type CampoSolicitavel = typeof CAMPOS_VALIDOS[number]

function gerarToken(): string {
  // 24 bytes = 32 chars base64url, ~10^57 possibilidades. Inviável de adivinhar.
  return randomBytes(24).toString('base64url')
}

export interface GerarLinkInput {
  pessoa_id: string
  campos: string[]
  tipos_documento: string[]
  /** Campos do bloco de imóvel (chaves imovel_*). */
  campos_imovel?: string[]
  /** Imóvel que recebe as respostas. Vazio = ainda não cadastrado (captação). */
  imovel_id?: string | null
  horas_validade?: number
}

export async function gerarLinkAtualizacao(input: GerarLinkInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (!input.pessoa_id) return { error: 'Pessoa inválida.' }

  const campos = (input.campos ?? []).filter(c => (CAMPOS_VALIDOS as readonly string[]).includes(c))
  const docs = (input.tipos_documento ?? []).filter(d => (TIPOS_DOC_VALIDOS as readonly string[]).includes(d))
  const camposImovel = (input.campos_imovel ?? []).filter(c => CHAVES_CAMPO_IMOVEL.includes(c))
  if (campos.length === 0 && docs.length === 0 && camposImovel.length === 0) {
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

  if (input.imovel_id) {
    const { data: imovel } = await supabase
      .from('imoveis')
      .select('id')
      .eq('id', input.imovel_id)
      .eq('user_id', acesso.userId)
      .maybeSingle()
    if (!imovel) return { error: 'Imóvel não encontrado.' }
  }

  const token = gerarToken()
  const { error } = await supabase.from('solicitacoes_cadastro').insert({
    user_id: acesso.userId,
    pessoa_id: input.pessoa_id,
    token,
    campos,
    tipos_documento: docs,
    expira_em: expira,
    // Só manda as colunas da v100 quando usadas: o link só de pessoa
    // continua funcionando num banco que ainda não rodou a migration.
    ...(camposImovel.length > 0 ? { campos_imovel: camposImovel, imovel_id: input.imovel_id || null } : {}),
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

/**
 * Leva o que a proprietária mandou no bloco de imóvel pras colunas de um
 * imóvel do corretor, e amarra a solicitação a ele. Serve pros dois
 * caminhos: o imóvel já existia mas o link foi gerado sem ele, ou o
 * anúncio acabou de ser criado a partir destes dados.
 */
export async function aplicarDadosImovel(
  solicitacaoId: string,
  imovelId: string,
  /** Só amarra, sem regravar: o anúncio novo já salvou o que o corretor revisou. */
  opcoes: { soVincular?: boolean } = {},
) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: sol } = await supabase
    .from('solicitacoes_cadastro')
    .select('id, pessoa_id, dados_imovel')
    .eq('id', solicitacaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!sol) return { error: 'Solicitação não encontrada.' }

  const { data: imovel } = await supabase
    .from('imoveis')
    .select('id')
    .eq('id', imovelId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!imovel) return { error: 'Imóvel não encontrado.' }

  const colunas = opcoes.soVincular
    ? {}
    : dadosImovelParaColunas((sol.dados_imovel ?? {}) as Record<string, string>)
  if (Object.keys(colunas).length > 0) {
    const { error } = await supabase
      .from('imoveis')
      .update(colunas)
      .eq('id', imovelId)
      .eq('user_id', acesso.userId)
    if (error) return { error: error.message }
    // Condomínio e IPTU aparecem no anúncio público, que é servido de cache.
    updateTag(TAG_IMOVEIS)
    await revalidarImovel(imovelId)
  }

  const { error } = await supabase
    .from('solicitacoes_cadastro')
    .update({ imovel_id: imovelId })
    .eq('id', solicitacaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/clientes/${sol.pessoa_id}`)
  return { ok: true }
}
