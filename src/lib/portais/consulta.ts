import { createAdminClient } from '@/lib/supabase/admin'
import type { ImovelPortal } from './vrsync'

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
export async function imoveisDoFeed(userId: string): Promise<ImovelPortal[]> {
  const { data, error } = await createAdminClient()
    .from('imoveis')
    .select(COLUNAS_PORTAL)
    .eq('user_id', userId)
    .eq('publicar_portais', true)
    .eq('status', 'ativo')
    .gte('expira_em', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ImovelPortal[]
}

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://aluguelcuiaba.com.br').replace(/\/$/, '')
