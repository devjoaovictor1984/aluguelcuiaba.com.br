import { createAdminClient } from '@/lib/supabase/admin'
import { gerarFeedVRSync, podeIrProPortal, type ImovelPortal } from './vrsync'

/** Colunas que o feed usa — a mesma lista na rota e na tela de Portais. */
export const COLUNAS_PORTAL =
  'id, slug, titulo, descricao, tipo, preco, taxa_condominio, iptu, custo_tipo, area_m2, area_construida_m2, area_terreno_m2, ' +
  'quartos, suites, banheiros, vagas, piscina, aceita_pets, mobiliado, condominio_id, endereco_completo, endereco_numero, endereco_cep, ' +
  'lat, lng, garantia_fianca, garantia_caucao, garantia_fiador, portais_destaque, updated_at, ' +
  'bairro:bairros(nome, slug), fotos(url, principal, ordem)'

/**
 * Anúncios que estão no feed de um anunciante: marcados pra portal, no ar e
 * dentro da validade. Alugou, pausou ou venceu → sai do feed e o portal
 * despublica na próxima leitura.
 */
export async function imoveisDoFeed(userId: string, { soLigados = true } = {}): Promise<ImovelPortal[]> {
  let q = createAdminClient()
    .from('imoveis')
    .select(COLUNAS_PORTAL)
    .eq('user_id', userId)
    .eq('status', 'ativo')
  if (soLigados) q = q.eq('publicar_portais', true)
  const { data, error } = await q
    .gte('expira_em', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ImovelPortal[]
}

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://aluguelcuiaba.com.br').replace(/\/$/, '')

/**
 * Monta o XML de um anunciante — usado pela URL pública (portal) e pelo
 * "Baixar arquivo de teste" do painel. `soLigados: false` põe todos os
 * anúncios no ar que passam nas regras, pra testar antes de ligar.
 */
export async function montarFeed(userId: string, opts: { soLigados?: boolean } = {}) {
  const db = createAdminClient()
  const [{ data: perfil }, { data: auth }, imoveis] = await Promise.all([
    db.from('perfis').select('nome, telefone').eq('id', userId).single(),
    db.auth.admin.getUserById(userId),
    imoveisDoFeed(userId, opts),
  ])
  const xml = gerarFeedVRSync(
    imoveis,
    {
      nome: perfil?.nome || 'AluguelCuiabá',
      email: auth?.user?.email || 'contato@aluguelcuiaba.com.br',
      telefone: perfil?.telefone ?? null,
    },
    SITE_URL,
  )
  return { xml, total: imoveis.filter(podeIrProPortal).length }
}

