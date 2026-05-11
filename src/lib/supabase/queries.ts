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

  return query
}

export async function getImovelPorId(id: string) {
  const supabase = await createClient()
  return supabase
    .from('imoveis')
    .select(`*, bairro:bairros(*), condominio:condominios(*), fotos(*), perfil:perfis(*)`)
    .eq('id', id)
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
