import { createClient } from './server'
import type { FiltrosBusca } from '@/types'

export async function getImoveis(filtros: FiltrosBusca = {}, pagina = 1, porPagina = 24) {
  const supabase = await createClient()
  const offset = (pagina - 1) * porPagina

  const selectStr = filtros.tipo_anunciante
    ? `*, bairro:bairros(*), condominio:condominios(*), fotos(*), perfil:perfis!inner(id, tipo, nome, telefone)`
    : `*, bairro:bairros(*), condominio:condominios(*), fotos(*), perfil:perfis(id, tipo, nome, telefone)`

  let query = supabase
    .from('imoveis')
    .select(selectStr, { count: 'exact' })
    .eq('status', 'ativo')
    .range(offset, offset + porPagina - 1)

  // Ordenação
  if (!filtros.ordenar || filtros.ordenar === 'relevantes') {
    query = query.order('destaque', { ascending: false }).order('created_at', { ascending: false })
  } else if (filtros.ordenar === 'recentes') {
    query = query.order('created_at', { ascending: false })
  } else if (filtros.ordenar === 'menor_preco') {
    query = query.order('preco', { ascending: true })
  } else if (filtros.ordenar === 'maior_preco') {
    query = query.order('preco', { ascending: false })
  }

  // Filtros simples
  if (filtros.tipo) query = query.eq('tipo', filtros.tipo)
  if (filtros.preco_min) query = query.gte('preco', filtros.preco_min)
  if (filtros.preco_max) query = query.lte('preco', filtros.preco_max)
  if (filtros.quartos_min) query = query.gte('quartos', filtros.quartos_min)
  if (filtros.aceita_pets) query = query.eq('aceita_pets', true)
  if (filtros.mobiliado) query = query.eq('mobiliado', true)
  if (filtros.taxa_condo_min) query = query.gte('taxa_condominio', filtros.taxa_condo_min)
  if (filtros.taxa_condo_max) query = query.lte('taxa_condominio', filtros.taxa_condo_max)
  if (filtros.iptu_min) query = query.gte('iptu', filtros.iptu_min)
  if (filtros.iptu_max) query = query.lte('iptu', filtros.iptu_max)

  // Texto livre — busca em título + descrição
  if (filtros.q) {
    const termo = `%${filtros.q.replace(/[%_]/g, '')}%`
    query = query.or(`titulo.ilike.${termo},descricao.ilike.${termo}`)
  }

  // Filtro por tipo de anunciante (usa inner join)
  if (filtros.tipo_anunciante) {
    query = query.eq('perfis.tipo', filtros.tipo_anunciante)
  }

  // Filtro por bairro via slug
  if (filtros.bairro_slug) {
    const { data: bairro } = await supabase
      .from('bairros')
      .select('id')
      .eq('slug', filtros.bairro_slug)
      .single()
    if (bairro) query = query.eq('bairro_id', bairro.id)
  }

  // Filtro por bounding box do mapa (lat/lng) — Airbnb-style
  if (filtros.bbox) {
    const [minLng, minLat, maxLng, maxLat] = filtros.bbox
    query = query
      .gte('lat', minLat).lte('lat', maxLat)
      .gte('lng', minLng).lte('lng', maxLng)
  }

  return query
}

// Versão leve só para o mapa: retorna apenas lat/lng/preco/título/slug
// + foto principal. Limite alto para mostrar todos os pins.
export async function getImoveisParaMapa(filtros: FiltrosBusca = {}) {
  const supabase = await createClient()

  let query = supabase
    .from('imoveis')
    .select('id, slug, titulo, preco, lat, lng, bairro:bairros(slug, nome), fotos(url, principal, ordem)')
    .eq('status', 'ativo')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(500)

  if (filtros.tipo) query = query.eq('tipo', filtros.tipo)
  if (filtros.preco_min) query = query.gte('preco', filtros.preco_min)
  if (filtros.preco_max) query = query.lte('preco', filtros.preco_max)
  if (filtros.quartos_min) query = query.gte('quartos', filtros.quartos_min)

  if (filtros.bairro_slug) {
    const { data: bairro } = await supabase
      .from('bairros')
      .select('id')
      .eq('slug', filtros.bairro_slug)
      .single()
    if (bairro) query = query.eq('bairro_id', bairro.id)
  }

  if (filtros.q) {
    const termo = `%${filtros.q.replace(/[%_]/g, '')}%`
    query = query.or(`titulo.ilike.${termo},descricao.ilike.${termo}`)
  }

  return query
}

export async function getImovelPorId(idOrSlug: string) {
  const supabase = await createClient()
  const bySlug = await supabase
    .from('imoveis')
    .select(`*, bairro:bairros(*), condominio:condominios(*), fotos(*), perfil:perfis(*)`)
    .eq('slug', idOrSlug)
    .eq('status', 'ativo')
    .maybeSingle()
  if (bySlug.data) return { data: bySlug.data, error: null }
  return supabase
    .from('imoveis')
    .select(`*, bairro:bairros(*), condominio:condominios(*), fotos(*), perfil:perfis(*)`)
    .eq('id', idOrSlug)
    .eq('status', 'ativo')
    .single()
}

export async function getBairros() {
  const supabase = await createClient()
  return supabase.from('bairros').select('*').order('nome')
}

export async function getBairroPorSlug(slug: string) {
  const supabase = await createClient()
  return supabase.from('bairros').select('*').eq('slug', slug).single()
}

export async function getImoveisPorBairro(bairroId: string) {
  const supabase = await createClient()
  return supabase
    .from('imoveis')
    .select(`*, fotos(*), bairro:bairros(*)`)
    .eq('bairro_id', bairroId)
    .eq('status', 'ativo')
    .order('destaque', { ascending: false })
    .order('created_at', { ascending: false })
}

export async function getCondominios() {
  const supabase = await createClient()
  return supabase.from('condominios').select('*, bairro:bairros(*)').order('nome')
}

export async function getImoveisSimilares(bairroId: string, excluirId: string, limite = 6) {
  const supabase = await createClient()
  return supabase
    .from('imoveis')
    .select(`*, fotos(*), bairro:bairros(*)`)
    .eq('bairro_id', bairroId)
    .eq('status', 'ativo')
    .neq('id', excluirId)
    .order('destaque', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limite)
}

export async function getPerfil(userId: string) {
  const supabase = await createClient()
  return supabase.from('perfis').select('*').eq('id', userId).single()
}

export async function getMeusImoveis(userId: string) {
  const supabase = await createClient()
  return supabase
    .from('imoveis')
    .select(`*, bairro:bairros(*), fotos(*)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
}

export async function getBannersSidebar() {
  const supabase = await createClient()
  return supabase
    .from('banners_sidebar')
    .select('id, imagem_url, link_url, ordem')
    .eq('ativo', true)
    .order('ordem')
    .limit(10)
}

export async function getPerfilPublico(userId: string) {
  const supabase = await createClient()
  return supabase
    .from('perfis')
    .select('id, nome, foto_url, tipo, creci, created_at')
    .eq('id', userId)
    .single()
}

export async function getImoveisDoAnunciante(userId: string) {
  const supabase = await createClient()
  return supabase
    .from('imoveis')
    .select(`*, bairro:bairros(*), fotos(*), perfil:perfis(id, nome, foto_url, tipo)`)
    .eq('user_id', userId)
    .eq('status', 'ativo')
    .order('destaque', { ascending: false })
    .order('created_at', { ascending: false })
}
