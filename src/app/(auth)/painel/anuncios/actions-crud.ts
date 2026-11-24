'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidarImovel } from '../actions'
import { invalidarVitrine } from './actions-cache'
import type { StatusImovel } from '@/types'

/**
 * Ações da lista "Meus anúncios" (nov/2026). Ver docs/painel-anuncios.md.
 *
 * Regra de acesso, conferida AQUI no servidor (o botão escondido na tela não
 * vale como proteção):
 *  - o dono do anúncio age sobre ele com o cliente da sessão (RLS por cima);
 *  - o admin age sobre qualquer anúncio, com o cliente de serviço;
 *  - qualquer outro recebe erro.
 */
type Resultado = { error?: string; success?: boolean }

const STATUS_PERMITIDOS: StatusImovel[] = ['ativo', 'pausado', 'alugado']

async function acessoAnuncio(imovelId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erro: 'Não autenticado' as const }

  const [{ data: perfil }, { data: imovel }] = await Promise.all([
    supabase.from('perfis').select('role').eq('id', user.id).single(),
    // Lido com o cliente de serviço: o admin precisa enxergar o anúncio de
    // outro anunciante pra decidir. O dado não sai daqui.
    createAdminClient().from('imoveis').select('id, user_id').eq('id', imovelId).maybeSingle(),
  ])
  if (!imovel) return { erro: 'Anúncio não encontrado' as const }

  const dono = imovel.user_id === user.id
  const admin = perfil?.role === 'admin'
  if (!dono && !admin) return { erro: 'Sem permissão para este anúncio' as const }

  return { db: dono ? supabase : createAdminClient(), dono, admin }
}

export async function alterarStatusAnuncio(imovelId: string, status: StatusImovel): Promise<Resultado> {
  if (!STATUS_PERMITIDOS.includes(status)) return { error: 'Status inválido' }
  const acesso = await acessoAnuncio(imovelId)
  if ('erro' in acesso) return { error: acesso.erro }

  const patch: Record<string, unknown> = { status }
  // O card de alugado conta os 30 dias de vitrine a partir daqui.
  if (status === 'alugado') patch.data_alugado = new Date().toISOString()

  const { error } = await acesso.db.from('imoveis').update(patch).eq('id', imovelId)
  if (error) return { error: error.message }
  await revalidarImovel(imovelId)
  await invalidarVitrine()
  return { success: true }
}

export async function renovarAnuncio30d(imovelId: string): Promise<Resultado> {
  const acesso = await acessoAnuncio(imovelId)
  if ('erro' in acesso) return { error: acesso.erro }

  const expira = new Date()
  expira.setDate(expira.getDate() + 30)
  const { error } = await acesso.db
    .from('imoveis')
    .update({ expira_em: expira.toISOString(), status: 'ativo' })
    .eq('id', imovelId)
  if (error) return { error: error.message }
  await revalidarImovel(imovelId)
  await invalidarVitrine()
  return { success: true }
}

/**
 * Exclusão definitiva. Contratos, administrações e seguros que apontam pro
 * imóvel ficam (FK `ON DELETE SET NULL`); as fotos saem junto.
 * Os arquivos no Storage NÃO são apagados — ver docs/pendencias.md.
 */
export async function excluirAnuncio(imovelId: string): Promise<Resultado> {
  const acesso = await acessoAnuncio(imovelId)
  if ('erro' in acesso) return { error: acesso.erro }

  // Veio de importação (v108)? Anota o código: a próxima importação do
  // mesmo XML não traz de volta o que a pessoa apagou de propósito.
  const { data: origem } = await createAdminClient().from('imoveis')
    .select('user_id, importacao_codigo').eq('id', imovelId).maybeSingle()

  await acesso.db.from('fotos').delete().eq('imovel_id', imovelId)
  const { error } = await acesso.db.from('imoveis').delete().eq('id', imovelId)
  if (error) return { error: error.message }
  if (origem?.importacao_codigo) {
    await createAdminClient().from('importacao_descartados')
      .upsert({ user_id: origem.user_id, codigo: origem.importacao_codigo }, { onConflict: 'user_id,codigo' })
      .then(() => {}, () => {})
  }
  await invalidarVitrine()
  return { success: true }
}

// ── Portais (OLX · ZAP · Viva Real) — v107, ver docs/integracoes/portais ──

const DESTAQUES = ['STANDARD', 'PREMIUM', 'SUPER_PREMIUM'] as const

export async function configurarPortal(
  imovelId: string,
  config: { publicar?: boolean; destaque?: string },
): Promise<Resultado> {
  const acesso = await acessoAnuncio(imovelId)
  if ('erro' in acesso) return { error: acesso.erro }

  const patch: Record<string, unknown> = {}
  if (typeof config.publicar === 'boolean') patch.publicar_portais = config.publicar
  if (config.destaque !== undefined) {
    if (!(DESTAQUES as readonly string[]).includes(config.destaque)) return { error: 'Tipo de destaque inválido' }
    patch.portais_destaque = config.destaque
  }
  if (!Object.keys(patch).length) return { success: true }

  const { error } = await acesso.db.from('imoveis').update(patch).eq('id', imovelId)
  if (error) return { error: error.message }
  return { success: true }
}

/**
 * Cria (ou troca) o token da URL do feed do usuário logado. Trocar derruba a
 * URL antiga na hora — é o "revogar" caso a URL tenha vazado. Depois de
 * trocar, a URL nova precisa ser recadastrada no Canal Pro.
 */
export async function gerarTokenFeed(): Promise<Resultado & { token?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = Buffer.from(bytes).toString('base64url') // 43 caracteres

  const { error } = await createAdminClient()
    .from('portais_feed')
    .upsert({ user_id: user.id, token, criado_em: new Date().toISOString(), lido_em: null, lido_por: null }, { onConflict: 'user_id' })
  if (error) return { error: error.message }
  return { success: true, token }
}
