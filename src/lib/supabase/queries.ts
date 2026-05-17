import { createClient } from './server'
import type { FiltrosBusca } from '@/types'
import { seedDoDia, shuffleSeeded } from '@/lib/random'

// Filtro de visibilidade pública: imóvel aparece se está ativo
// OU se foi marcado como alugado nos últimos 30 dias (mostra com faixa).
function filtroStatusPublico(): string {
  const limite = new Date()
  limite.setDate(limite.getDate() - 30)
  return `status.eq.ativo,and(status.eq.alugado,data_alugado.gt.${limite.toISOString()})`
}

// Resolve filtros que precisam de I/O extra (ex: bairro_slug → bairro_id).
// Retorna struct pronto pra ser aplicado pela função síncrona.
async function resolverFiltros(filtros: FiltrosBusca, supabase: Awaited<ReturnType<typeof createClient>>) {
  let bairroId: string | undefined
  if (filtros.bairro_slug) {
    const { data: bairro } = await supabase
      .from('bairros').select('id').eq('slug', filtros.bairro_slug).single()
    if (bairro) bairroId = bairro.id
  }
  return { ...filtros, bairro_id: bairroId }
}

// Aplica filtros simples diretamente na query (síncrono).
function aplicarFiltros<Q extends {
  eq: (col: string, val: unknown) => Q
  gte: (col: string, val: unknown) => Q
  lte: (col: string, val: unknown) => Q
  or: (filter: string) => Q
}>(query: Q, f: FiltrosBusca & { bairro_id?: string }): Q {
  if (f.tipo) query = query.eq('tipo', f.tipo)
  if (f.preco_min) query = query.gte('preco', f.preco_min)
  if (f.preco_max) query = query.lte('preco', f.preco_max)
  if (f.quartos_min) query = query.gte('quartos', f.quartos_min)
  if (f.aceita_pets) query = query.eq('aceita_pets', true)
  if (f.mobiliado) query = query.eq('mobiliado', true)
  if (f.taxa_condo_min) query = query.gte('taxa_condominio', f.taxa_condo_min)
  if (f.taxa_condo_max) query = query.lte('taxa_condominio', f.taxa_condo_max)
  if (f.iptu_min) query = query.gte('iptu', f.iptu_min)
  if (f.iptu_max) query = query.lte('iptu', f.iptu_max)

  if (f.q) {
    const termo = `%${f.q.replace(/[%_]/g, '')}%`
    query = query.or(`titulo.ilike.${termo},descricao.ilike.${termo}`)
  }

  if (f.tipo_anunciante) query = query.eq('perfis.tipo', f.tipo_anunciante)
  if (f.bairro_id) query = query.eq('bairro_id', f.bairro_id)

  if (f.bbox) {
    const [minLng, minLat, maxLng, maxLat] = f.bbox
    query = query
      .gte('lat', minLat).lte('lat', maxLat)
      .gte('lng', minLng).lte('lng', maxLng)
  }
  return query
}

export async function getImoveis(filtros: FiltrosBusca = {}, pagina = 1, porPagina = 24) {
  const supabase = await createClient()
  const offset = (pagina - 1) * porPagina

  const selectStr = filtros.tipo_anunciante
    ? `*, bairro:bairros(*), condominio:condominios(*), fotos(*), perfil:perfis!inner(id, tipo, nome, telefone)`
    : `*, bairro:bairros(*), condominio:condominios(*), fotos(*), perfil:perfis(id, tipo, nome, telefone)`

  // Modo "relevantes" (default): random estável por dia, com destaques no topo.
  // Pra isso precisamos saber a lista completa de ids antes de paginar.
  const usarRandom = !filtros.ordenar || filtros.ordenar === 'relevantes'

  const fResolv = await resolverFiltros(filtros, supabase)

  if (usarRandom) {
    // Pra filtrar por tipo_anunciante precisamos do inner join — incluímos no select
    const idsSelect = fResolv.tipo_anunciante
      ? '*, perfis!inner(tipo)' // select abrangente; pegamos só id/destaque depois
      : 'id, destaque'
    let idsQuery = supabase
      .from('imoveis')
      .select(idsSelect)
      .or(filtroStatusPublico())
    idsQuery = aplicarFiltros(idsQuery, fResolv)

    const { data: linhas, error: erroIds } = await idsQuery
    if (erroIds || !linhas) return { data: [], count: 0, error: erroIds }

    type Linha = { id: string; destaque: boolean }
    const seed = seedDoDia()
    const lista = linhas as unknown as Linha[]
    const destaques = shuffleSeeded(lista.filter(l => l.destaque), seed)
    const normais = shuffleSeeded(lista.filter(l => !l.destaque), seed + 1)
    const ordenado = [...destaques, ...normais]
    const total = ordenado.length
    const slice = ordenado.slice(offset, offset + porPagina).map(l => l.id)

    if (slice.length === 0) return { data: [], count: total, error: null }

    const { data: imoveis, error } = await supabase
      .from('imoveis')
      .select(selectStr)
      .in('id', slice)
    if (error || !imoveis) return { data: [], count: total, error }

    // Re-ordena na ordem do slice (Supabase .in() não preserva ordem)
    const porId = new Map((imoveis as { id: string }[]).map(i => [i.id, i]))
    const data = slice.map(id => porId.get(id)).filter(Boolean)
    return { data, count: total, error: null }
  }

  // Modos explícitos (recentes / menor_preco / maior_preco): paginação direta no banco.
  let query = supabase
    .from('imoveis')
    .select(selectStr, { count: 'exact' })
    .or(filtroStatusPublico())
    .range(offset, offset + porPagina - 1)

  if (filtros.ordenar === 'recentes') {
    query = query.order('created_at', { ascending: false })
  } else if (filtros.ordenar === 'menor_preco') {
    query = query.order('preco', { ascending: true })
  } else if (filtros.ordenar === 'maior_preco') {
    query = query.order('preco', { ascending: false })
  }

  query = aplicarFiltros(query, fResolv)
  return query
}

// Versão leve só para o mapa: retorna apenas lat/lng/preco/título/slug
// + foto principal. Limite alto para mostrar todos os pins.
export async function getImoveisParaMapa(filtros: FiltrosBusca = {}) {
  const supabase = await createClient()

  let query = supabase
    .from('imoveis')
    .select('id, slug, titulo, preco, lat, lng, status, data_alugado, bairro:bairros(slug, nome), fotos(url, principal, ordem)')
    .or(filtroStatusPublico())
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
  const selectStr = `*, bairro:bairros(*), condominio:condominios(*), fotos(*), perfil:perfis(*)`
  const filtroStatus = filtroStatusPublico()

  const bySlug = await supabase
    .from('imoveis')
    .select(selectStr)
    .eq('slug', idOrSlug)
    .or(filtroStatus)
    .maybeSingle()
  if (bySlug.data) return { data: bySlug.data, error: null }
  return supabase
    .from('imoveis')
    .select(selectStr)
    .eq('id', idOrSlug)
    .or(filtroStatus)
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
    .or(filtroStatusPublico())
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
    .or(filtroStatusPublico())
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
    .or(filtroStatusPublico())
    .order('destaque', { ascending: false })
    .order('created_at', { ascending: false })
}
