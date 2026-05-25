export type TipoImovel = 'apartamento' | 'casa' | 'kitnet' | 'comercial' | 'terreno'
export type StatusImovel = 'ativo' | 'pausado' | 'expirado' | 'rascunho' | 'alugado'
export type TipoUsuario = 'proprietario' | 'corretor' | 'imobiliaria'
export type PlanoUsuario = 'free' | 'basico' | 'profissional'
export type OrdenarPor = 'relevantes' | 'recentes' | 'menor_preco' | 'maior_preco'

export interface BairroInfraestrutura {
  escolas?: string[]
  hospitais?: string[]
  onibus?: string[]
  supermercados?: string[]
  farmacias?: string[]
}

export interface BairroFAQ {
  pergunta: string
  resposta: string
}

export interface Bairro {
  id: string
  nome: string
  slug: string
  regiao: string | null
  descricao: string | null
  descricao_longa: string | null
  foto_url: string | null
  lat: number | null
  lng: number | null
  infraestrutura: BairroInfraestrutura | null
  faq: BairroFAQ[] | null
  created_at: string
}

export interface Condominio {
  id: string
  nome: string
  slug: string
  bairro_id: string | null
  bairro?: Bairro
  created_at: string
}

export interface Perfil {
  id: string
  nome: string | null
  cpf: string | null
  telefone: string | null
  tipo: TipoUsuario
  plano: PlanoUsuario
  plano_expira_em: string | null
  role: 'admin' | 'user' | null
  endereco_cep: string | null
  endereco_logradouro: string | null
  endereco_numero: string | null
  endereco_bairro: string | null
  endereco_cidade: string | null
  endereco_uf: string | null
  consentimento_lgpd_em: string | null
  foto_url: string | null
  creci: string | null
  razao_social: string | null
  cnpj: string | null
  creci_juridico: string | null
  created_at: string
}

export interface Foto {
  id: string
  imovel_id: string
  url: string
  ordem: number
  principal: boolean
}

export interface Imovel {
  id: string
  slug?: string | null
  user_id: string
  titulo: string
  descricao: string | null
  tipo: TipoImovel
  bairro_id: string | null
  condominio_id: string | null
  condominio_nome: string | null
  endereco_resumido: string | null
  preco: number
  preco_antigo: number | null
  area_m2: number | null
  quartos: number
  suites: number
  banheiros: number
  vagas: number
  piscina: boolean
  aceita_pets: boolean
  mobiliado: boolean
  taxa_condominio: number | null
  iptu: number | null
  custo_tipo: 'separado' | 'pacote'
  semimobiliado: boolean
  gas_incluso: boolean
  agua_inclusa: boolean
  luz_inclusa: boolean
  observacoes: string | null
  whatsapp: string
  status: StatusImovel
  data_alugado: string | null
  destaque: boolean
  destaque_expira_em: string | null
  visualizacoes: number
  aviso_enviado: boolean
  expira_em: string
  lat: number | null
  lng: number | null
  created_at: string
  updated_at: string
  bairro?: Bairro
  condominio?: Condominio
  fotos?: Foto[]
  perfil?: Perfil
}

export interface FiltrosBusca {
  tipo?: TipoImovel
  bairro_slug?: string
  preco_min?: number
  preco_max?: number
  taxa_condo_min?: number
  taxa_condo_max?: number
  iptu_min?: number
  iptu_max?: number
  quartos_min?: number
  aceita_pets?: boolean
  mobiliado?: boolean
  tipo_anunciante?: TipoUsuario
  ordenar?: OrdenarPor
  /** [minLng, minLat, maxLng, maxLat] — bounding box do mapa */
  bbox?: [number, number, number, number]
  /** Texto livre para busca em título + descrição (ILIKE) */
  q?: string
}

export interface PostBlog {
  slug: string
  titulo: string
  descricao: string
  data: string
  categoria: string
  tempo_leitura: string
  conteudo?: string
}
