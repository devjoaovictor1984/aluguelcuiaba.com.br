import type { FiltrosBusca, TipoImovel } from '@/types'

// Mapeamento: termos que o usuário pode digitar → tipo do imóvel canônico
const SINONIMOS_TIPO: Record<string, TipoImovel> = {
  apartamento: 'apartamento', apto: 'apartamento', ap: 'apartamento', apartamentos: 'apartamento',
  casa: 'casa', casas: 'casa', sobrado: 'casa', sobrados: 'casa',
  kitnet: 'kitnet', kit: 'kitnet', kitnets: 'kitnet', studio: 'kitnet', stúdio: 'kitnet', loft: 'kitnet',
  comercial: 'comercial', sala: 'comercial', salas: 'comercial', loja: 'comercial', escritorio: 'comercial', escritório: 'comercial',
  terreno: 'terreno', terrenos: 'terreno', lote: 'terreno', lotes: 'terreno',
}

// Palavras que não agregam — removidas
const STOPWORDS = new Set([
  'para', 'alugar', 'aluguel', 'em', 'no', 'na', 'nos', 'nas', 'de', 'da', 'do',
  'com', 'a', 'o', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'que', 'e',
])

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

interface Bairro { slug: string; nome: string }

/**
 * Recebe a frase do usuário + lista de bairros conhecidos e extrai filtros.
 * Termos reconhecidos são removidos da query; o que sobra vira o `q` (texto livre).
 *
 * Exemplo: "apartamento 2 quartos no araés para alugar"
 *   → { tipo: 'apartamento', quartos_min: 2, bairro_slug: 'araes', q: '' }
 */
export function parseBusca(texto: string, bairros: Bairro[]): FiltrosBusca {
  if (!texto?.trim()) return {}

  let tokens = normalizar(texto).split(/\s+/).filter(Boolean)
  const filtros: FiltrosBusca = {}

  // 1. Tipo de imóvel
  for (let i = 0; i < tokens.length; i++) {
    const t = SINONIMOS_TIPO[tokens[i]]
    if (t) {
      filtros.tipo = t
      tokens.splice(i, 1)
      break
    }
  }

  // 2. Quartos: "3 quartos", "2 quarto", "1 dormitorio"
  for (let i = 0; i < tokens.length - 1; i++) {
    const n = parseInt(tokens[i])
    const prox = tokens[i + 1]
    if (Number.isFinite(n) && (prox === 'quartos' || prox === 'quarto' || prox === 'dormitorio' || prox === 'dormitorios')) {
      filtros.quartos_min = n
      tokens.splice(i, 2)
      break
    }
  }

  // 3. Bairro — testa todos os bairros conhecidos (maior nome primeiro para
  //    bairros compostos como "jardim cuiabá")
  const bairrosOrdenados = [...bairros].sort((a, b) => b.nome.length - a.nome.length)
  for (const b of bairrosOrdenados) {
    const nomeTokens = normalizar(b.nome).split(/\s+/)
    const fraseRestante = tokens.join(' ')
    const fraseAlvo = nomeTokens.join(' ')
    const regex = new RegExp(`\\b${fraseAlvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    if (regex.test(fraseRestante)) {
      filtros.bairro_slug = b.slug
      // Remove os tokens do nome do bairro
      const idx = fraseRestante.indexOf(fraseAlvo)
      const before = fraseRestante.slice(0, idx).trim().split(/\s+/).filter(Boolean)
      const after = fraseRestante.slice(idx + fraseAlvo.length).trim().split(/\s+/).filter(Boolean)
      tokens = [...before, ...after]
      break
    }
  }

  // 4. "mobiliado", "pets"
  const idxMob = tokens.findIndex(t => t === 'mobiliado' || t === 'mobiliada')
  if (idxMob >= 0) { filtros.mobiliado = true; tokens.splice(idxMob, 1) }
  const idxPet = tokens.findIndex(t => t === 'pets' || t === 'pet')
  if (idxPet >= 0) { filtros.aceita_pets = true; tokens.splice(idxPet, 1) }

  // 5. Remove stopwords
  tokens = tokens.filter(t => !STOPWORDS.has(t))

  // 6. O resto vira o texto livre
  const q = tokens.join(' ').trim()
  if (q) filtros.q = q

  return filtros
}
