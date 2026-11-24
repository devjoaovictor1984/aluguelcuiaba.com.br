/**
 * Converte um imóvel cru do XML (VRSync ou ZAP legado) para as colunas do
 * site, e diz o que não deu para trazer. É o caminho inverso de
 * src/lib/portais/vrsync.ts — os mesmos códigos, lidos de volta.
 *
 * Tolerante de propósito: campo opcional faltando NÃO derruba o imóvel; ele
 * entra e fica marcado ("falta CEP") para completar no rascunho. Só fica de
 * fora o que não faz sentido aqui: venda, temporada, outra cidade, sem valor.
 */
import type { TipoImovel } from '@/types'
import { atributo, caminho, filho, lista, texto, type FormatoImportacao, type NoXml } from './xml'
import { normalizarCidade } from './bairros'

export interface Problema { nivel: 'erro' | 'aviso'; texto: string }

/** O imóvel já no formato do site (o que vai em importacoes_itens.dados). */
export interface ImovelImportado {
  codigo: string
  titulo: string
  descricao: string | null        // HTML simples, todo texto já escapado
  tipo: TipoImovel
  preco: number | null            // aluguel MENSAL
  taxa_condominio: number | null
  iptu: number | null             // MENSAL (o site guarda assim)
  area_m2: number | null
  area_construida_m2: number | null
  area_terreno_m2: number | null
  quartos: number
  suites: number
  banheiros: number
  vagas: number
  piscina: boolean
  aceita_pets: boolean
  mobiliado: boolean
  garantia_fianca: boolean
  garantia_caucao: boolean
  garantia_fiador: boolean
  bairro_nome: string | null
  cidade: string | null
  endereco_completo: string | null
  endereco_numero: string | null
  endereco_complemento: string | null
  endereco_cep: string | null     // 8 dígitos
  lat: number | null
  lng: number | null
  telefone: string | null         // só dígitos
  fotos: string[]                 // URLs de origem, principal primeiro
  url_origem: string | null
}

export interface ResultadoMapeamento {
  imovel: ImovelImportado | null
  /** Preenchido quando o imóvel não deve ser importado (e o porquê). */
  ignorar: string | null
  problemas: Problema[]
  /** 'aluguel' | 'venda' | 'temporada' ... — pro resumo da análise. */
  transacao: 'aluguel' | 'venda' | 'temporada' | 'desconhecida'
}

export const MAX_FOTOS_IMPORTACAO = 20

// ── números ──────────────────────────────────────────────────────────

/** "1.234,56", "1234.56", "R$ 1.234" → 1234.56. */
export function numero(v: unknown): number | null {
  const t = texto(v)
  if (!t) return null
  let s = t.replace(/[^\d,.-]/g, '')
  if (!s || s === '-' ) return null
  const virgula = s.lastIndexOf(',')
  const ponto = s.lastIndexOf('.')
  if (virgula > -1 && ponto > -1) {
    // O último separador é o decimal.
    s = virgula > ponto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (virgula > -1) {
    // "1,500" / "12,345,678" (milhar em inglês) vs "1500,50" (decimal)
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(/,/g, '.')
  } else if (ponto > -1) {
    // "1.500" (milhar) vs "1500.50" (decimal)
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function inteiro(v: unknown, max = 99): number {
  const n = numero(v)
  if (n == null || n < 0) return 0
  return Math.min(Math.round(n), max)
}

function positivo(v: unknown): number | null {
  const n = numero(v)
  return n != null && n > 0 ? n : null
}

function simNao(v: unknown): boolean {
  const t = (texto(v) ?? '').toLowerCase()
  return ['1', 'true', 'sim', 's', 'yes', 'y'].includes(t)
}

/** Área em m² a partir do valor + unidade. */
function areaM2(v: unknown): number | null {
  const n = positivo(v)
  if (n == null) return null
  const unidade = (atributo(v, 'unit') ?? '').toLowerCase()
  if (unidade.includes('hect')) return Math.round(n * 10000)
  if (unidade.includes('acre')) return Math.round(n * 4046.86)
  // Valor absurdo (erro de digitação no sistema de origem) é descartado.
  if (n > 10_000_000) return null
  return Math.round(n * 100) / 100
}

/** Valor por período → mensal. */
function mensal(valor: number | null, periodo: string | null): { valor: number | null; periodo: string } {
  const p = (periodo ?? 'monthly').toLowerCase()
  if (valor == null) return { valor: null, periodo: p }
  if (p.startsWith('year') || p.startsWith('anual') || p === 'annual') return { valor: Math.round((valor / 12) * 100) / 100, periodo: p }
  if (p.startsWith('month') || p.startsWith('mens')) return { valor, periodo: p }
  return { valor: null, periodo: p } // Daily / Weekly: temporada, não é o produto daqui
}

function digitos(s: string | null | undefined) {
  return (s ?? '').replace(/\D/g, '')
}

function cep(v: unknown): string | null {
  const d = digitos(texto(v))
  return d.length === 8 ? d : null
}

function coordenada(v: unknown, limite: number): number | null {
  const n = numero(v)
  if (n == null || n === 0 || Math.abs(n) > limite) return null
  return n
}

// ── texto ────────────────────────────────────────────────────────────

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const ENTIDADES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }

/** Tira qualquer HTML que o sistema de origem tenha mandado e devolve texto. */
export function paraTexto(bruto: string | null): string {
  if (!bruto) return ''
  return bruto
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(br|\/p|\/div|\/li|\/h\d|\/tr)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const cod = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
        return Number.isFinite(cod) && cod > 0 && cod < 0x110000 ? String.fromCodePoint(cod) : ''
      }
      return ENTIDADES[e.toLowerCase()] ?? m
    })
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Texto → HTML do editor do site (parágrafos), com TUDO escapado. */
export function textoParaHtml(t: string): string | null {
  const limpo = t.trim()
  if (!limpo) return null
  return limpo
    .split(/\n{2,}/)
    .map(par => `<p>${par.split('\n').map(escHtml).join('<br>')}</p>`)
    .join('')
}

/** Características que o site não guarda em coluna, traduzidas pro anúncio. */
const FEATURES_PT: Record<string, string> = {
  'air conditioning': 'Ar-condicionado', 'alarm system': 'Alarme', 'american kitchen': 'Cozinha americana',
  'balcony': 'Sacada', 'bar': 'Bar', 'barbecue grill': 'Churrasqueira', 'bbq': 'Churrasqueira',
  'cable television': 'TV a cabo', 'closet': 'Closet', 'concierge': 'Portaria', 'copa': 'Copa',
  'cooling': 'Ar-condicionado', 'deck': 'Deck', 'elevator': 'Elevador', 'fireplace': 'Lareira',
  'fitness room': 'Academia', 'garden': 'Jardim', 'gated community': 'Condomínio fechado',
  'gourmet area': 'Espaço gourmet', 'gourmet balcony': 'Varanda gourmet', 'gourmet space': 'Espaço gourmet',
  'guardhouse': 'Guarita', 'gym': 'Academia', 'heating': 'Aquecimento', 'intercom': 'Interfone',
  'internet access': 'Internet', 'jacuzzi': 'Hidromassagem', 'kitchen': 'Cozinha',
  'laundry': 'Lavanderia', 'lawn': 'Gramado', 'mezzanine': 'Mezanino', 'office': 'Escritório',
  'party room': 'Salão de festas', 'pantry': 'Despensa', 'patio': 'Pátio', 'planned kitchen': 'Cozinha planejada',
  'planned furniture': 'Móveis planejados', 'playground': 'Playground', 'porch': 'Varanda',
  'sauna': 'Sauna', 'security guard on duty': 'Segurança 24h', 'security 24 hours': 'Segurança 24h',
  '24 hour security': 'Segurança 24h', 'service area': 'Área de serviço', 'solar energy': 'Energia solar',
  'sports court': 'Quadra poliesportiva', 'tennis court': 'Quadra de tênis', 'terrace': 'Terraço',
  'toys place': 'Brinquedoteca', 'veranda': 'Varanda', 'wall': 'Muro', 'electric gate': 'Portão eletrônico',
  'electronic gate': 'Portão eletrônico', 'game room': 'Salão de jogos', 'cinema': 'Cinema',
  'coworking': 'Coworking', 'pool': 'Piscina', 'pets allowed': 'Aceita pets', 'furnished': 'Mobiliado',
  'backyard': 'Quintal', 'cabinets': 'Armários', 'built-in wardrobe': 'Armários embutidos',
  'disabled access': 'Acessibilidade', 'water tank': 'Caixa d’água', 'generator': 'Gerador',
  'garage': 'Garagem', 'storage': 'Depósito', 'pantry room': 'Despensa', 'reception': 'Recepção',
}

// ── tipo ─────────────────────────────────────────────────────────────

function tipoDoTexto(t: string, comercial: boolean): { tipo: TipoImovel; certo: boolean } {
  const s = t.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  if (/land ?lot|terreno|lote\b|\blote|land/.test(s)) return { tipo: 'terreno', certo: true }
  if (/kitnet|kitinete|kit\b|studio|estudio|conjugado|loft/.test(s)) return { tipo: 'kitnet', certo: true }
  if (/apartment|apartamento|\bapto\b|penthouse|cobertura|flat|duplex|triplex/.test(s)) {
    return { tipo: comercial ? 'comercial' : 'apartamento', certo: true }
  }
  if (/business|office|sala|loja|store|retail|comercial|commercial|galpao|shed|warehouse|industrial|consultorio|predio|building|edificio|ponto|hotel|pousada|clinica/.test(s)) {
    return { tipo: 'comercial', certo: true }
  }
  if (/home|house|casa|sobrado|condo|village|chacara|farm|ranch|sitio|fazenda|agricultural/.test(s)) {
    return { tipo: comercial ? 'comercial' : 'casa', certo: true }
  }
  return { tipo: comercial ? 'comercial' : 'casa', certo: false }
}

// ── VRSync ───────────────────────────────────────────────────────────

function mapearVRSync(l: NoXml, cidadeSite: string): ResultadoMapeamento {
  const problemas: Problema[] = []
  const det = filho(l, 'Details')
  const loc = filho(l, 'Location')
  const codigo = (texto(filho(l, 'ListingID')) ?? '').slice(0, 120)

  const transacaoBruta = (texto(filho(l, 'TransactionType')) ?? '').toLowerCase()
  const precoNo = filho(det, 'RentalPrice')
  let transacao: ResultadoMapeamento['transacao'] =
    transacaoBruta.includes('rent') ? 'aluguel'
      : transacaoBruta.includes('sale') ? 'venda'
        : precoNo !== undefined ? 'aluguel' : 'desconhecida'

  const { valor: preco, periodo } = mensal(positivo(precoNo), atributo(precoNo, 'period'))
  if (transacao === 'aluguel' && precoNo !== undefined && preco == null && positivo(precoNo) != null) transacao = 'temporada'

  const usage = (texto(filho(det, 'UsageType')) ?? '').toLowerCase()
  const propertyType = texto(filho(det, 'PropertyType')) ?? ''
  const comercial = usage.includes('commercial') || /^commercial/i.test(propertyType)
  const { tipo, certo } = tipoDoTexto(propertyType || usage, comercial)
  if (!certo) problemas.push({ nivel: 'aviso', texto: `Tipo "${propertyType || 'vazio'}" não reconhecido — entrou como ${tipo}` })

  const iptuNo = filho(det, 'Iptu') ?? filho(det, 'YearlyTax') ?? filho(det, 'MonthlyTax')
  const iptuPeriodo = atributo(iptuNo, 'period')
    ?? (filho(det, 'Iptu') === undefined && filho(det, 'YearlyTax') !== undefined ? 'Yearly' : 'Monthly')
  const iptu = mensal(positivo(iptuNo), iptuPeriodo).valor

  const featuresBrutas = lista(caminho(det, 'Features', 'Feature')).map(f => texto(f)).filter((f): f is string => !!f)
  const feats = new Set(featuresBrutas.map(f => f.toLowerCase()))
  const extras = featuresBrutas
    .filter(f => !['pool', 'pets allowed', 'furnished'].includes(f.toLowerCase()))
    .map(f => FEATURES_PT[f.toLowerCase()] ?? f)

  const garantias = new Set(lista(caminho(det, 'Warranties', 'Warranty')).map(w => (texto(w) ?? '').toUpperCase()))
  const garantiasConhecidas = ['INSURANCE_GUARANTEE', 'SECURITY_DEPOSIT', 'GUARANTOR']
  const outrasGarantias = [...garantias].filter(g => g && !garantiasConhecidas.includes(g))
  if (outrasGarantias.length) {
    problemas.push({ nivel: 'aviso', texto: `Garantia não usada aqui: ${outrasGarantias.join(', ')}` })
  }

  const midia = lista(caminho(l, 'Media', 'Item'))
  const fotosNos = midia.filter(m => (atributo(m, 'medium') ?? 'image').toLowerCase() === 'image')
  const videos = midia.length - fotosNos.length
  const principal = fotosNos.findIndex(m => (atributo(m, 'primary') ?? '').toLowerCase() === 'true')
  if (principal > 0) fotosNos.unshift(...fotosNos.splice(principal, 1))
  const fotos = urlsFotos(fotosNos.map(m => texto(m)))
  if (videos > 0) problemas.push({ nivel: 'aviso', texto: `${videos} vídeo(s) não importado(s) — o site só guarda fotos` })

  const contato = filho(l, 'ContactInfo')
  const telefone = lista(filho(contato, 'Telephone')).map(t => digitos(texto(t))).find(t => t.length >= 10) ?? null

  const descricaoTexto = paraTexto(texto(filho(det, 'Description')))
  const lat = coordenada(filho(loc, 'Latitude'), 90)
  const lng = coordenada(filho(loc, 'Longitude'), 180)

  return finalizar({
    codigo,
    tituloBruto: texto(filho(l, 'Title')),
    descricaoTexto,
    extras,
    tipo,
    preco,
    periodo,
    transacao,
    taxa_condominio: positivo(filho(det, 'PropertyAdministrationFee')),
    iptu,
    area_m2: areaM2(filho(det, 'LivingArea')) ?? areaM2(filho(det, 'UsableArea')),
    area_construida_m2: areaM2(filho(det, 'ConstructedArea')) ?? areaM2(filho(det, 'BuiltArea')),
    area_terreno_m2: areaM2(filho(det, 'LotArea')) ?? areaM2(filho(det, 'TotalArea')),
    quartos: inteiro(filho(det, 'Bedrooms')),
    suites: inteiro(filho(det, 'Suites')),
    banheiros: inteiro(filho(det, 'Bathrooms')),
    vagas: inteiro(filho(det, 'Garage')),
    piscina: feats.has('pool'),
    aceita_pets: feats.has('pets allowed'),
    mobiliado: feats.has('furnished'),
    garantia_fianca: garantias.has('INSURANCE_GUARANTEE'),
    garantia_caucao: garantias.has('SECURITY_DEPOSIT'),
    garantia_fiador: garantias.has('GUARANTOR'),
    bairro_nome: texto(filho(loc, 'Neighborhood')),
    cidade: texto(filho(loc, 'City')),
    endereco_completo: texto(filho(loc, 'Address')),
    endereco_numero: texto(filho(loc, 'StreetNumber')),
    endereco_complemento: texto(filho(loc, 'Complement')),
    endereco_cep: cep(filho(loc, 'PostalCode')),
    cepBruto: texto(filho(loc, 'PostalCode')),
    lat, lng,
    telefone,
    fotos,
    url_origem: texto(filho(l, 'DetailViewUrl')),
  }, problemas, cidadeSite)
}

// ── ZAP legado (<Carga>) ─────────────────────────────────────────────

function mapearZapLegado(l: NoXml, cidadeSite: string): ResultadoMapeamento {
  const problemas: Problema[] = []
  const v = (nome: string) => filho(l, nome)
  const codigo = (texto(v('CodigoImovel')) ?? texto(v('Codigo')) ?? '').slice(0, 120)

  const precoLoc = positivo(v('PrecoLocacao'))
  const precoTemp = positivo(v('PrecoLocacaoTemporada'))
  const precoVenda = positivo(v('PrecoVenda'))
  const transacao: ResultadoMapeamento['transacao'] =
    precoLoc ? 'aluguel' : precoTemp ? 'temporada' : precoVenda ? 'venda' : 'desconhecida'

  const tipoTexto = [texto(v('TipoImovel')), texto(v('SubTipoImovel'))].filter(Boolean).join(' / ')
  const comercial = /comercial|industrial/i.test(texto(v('CategoriaImovel')) ?? '') || /comercial/i.test(texto(v('TipoImovel')) ?? '')
  const { tipo, certo } = tipoDoTexto(tipoTexto, comercial)
  if (!certo) problemas.push({ nivel: 'aviso', texto: `Tipo "${tipoTexto || 'vazio'}" não reconhecido — entrou como ${tipo}` })

  const fotosNos = lista(caminho(l, 'Fotos', 'Foto'))
  const principal = fotosNos.findIndex(f => simNao(filho(f, 'Principal')))
  if (principal > 0) fotosNos.unshift(...fotosNos.splice(principal, 1))
  const fotos = urlsFotos(fotosNos.map(f => texto(filho(f, 'URLArquivo')) ?? texto(filho(f, 'URL')) ?? texto(f)))

  const extras: string[] = []
  const flags: Array<[string, string]> = [
    ['ArCondicionado', 'Ar-condicionado'], ['Churrasqueira', 'Churrasqueira'], ['Elevador', 'Elevador'],
    ['Academia', 'Academia'], ['SalaoFestas', 'Salão de festas'], ['Playground', 'Playground'],
    ['Sauna', 'Sauna'], ['Quadra', 'Quadra'], ['Varanda', 'Varanda'], ['Sacada', 'Sacada'],
    ['Lavanderia', 'Lavanderia'], ['AreaServico', 'Área de serviço'], ['ArmarioCozinha', 'Armários na cozinha'],
    ['ArmarioEmbutido', 'Armários embutidos'], ['Portaria24h', 'Portaria 24h'], ['Interfone', 'Interfone'],
    ['Quintal', 'Quintal'], ['Jardim', 'Jardim'], ['Closet', 'Closet'], ['Hidromassagem', 'Hidromassagem'],
  ]
  for (const [tag, rotulo] of flags) if (simNao(v(tag))) extras.push(rotulo)

  const iptuBruto = positivo(v('ValorIPTU')) ?? positivo(v('IPTU'))
  // O formato antigo manda o IPTU ANUAL na maioria dos sistemas; valor
  // maior que o aluguel não pode ser mensal.
  const iptu = iptuBruto == null ? null
    : precoLoc && iptuBruto > precoLoc ? Math.round((iptuBruto / 12) * 100) / 100 : iptuBruto
  if (iptuBruto != null && precoLoc && iptuBruto > precoLoc) {
    problemas.push({ nivel: 'aviso', texto: 'IPTU parecia anual — foi dividido por 12' })
  }

  return finalizar({
    codigo,
    tituloBruto: texto(v('TituloImovel')) ?? texto(v('Titulo')),
    descricaoTexto: paraTexto(texto(v('Observacao')) ?? texto(v('Descricao'))),
    extras,
    tipo,
    preco: precoLoc,
    periodo: 'monthly',
    transacao,
    taxa_condominio: positivo(v('PrecoCondominio')) ?? positivo(v('ValorCondominio')),
    iptu,
    area_m2: positivo(v('AreaUtil')) ?? positivo(v('AreaPrivativa')),
    area_construida_m2: positivo(v('AreaConstruida')),
    area_terreno_m2: positivo(v('AreaTerreno')) ?? positivo(v('AreaTotal')),
    quartos: inteiro(v('QtdDormitorios')),
    suites: inteiro(v('QtdSuites')),
    banheiros: inteiro(v('QtdBanheiros')),
    vagas: inteiro(v('QtdVagas')),
    piscina: simNao(v('Piscina')),
    aceita_pets: simNao(v('AceitaAnimais')) || simNao(v('AceitaPet')),
    mobiliado: simNao(v('Mobiliado')),
    garantia_fianca: false,
    garantia_caucao: false,
    garantia_fiador: false,
    bairro_nome: texto(v('Bairro')),
    cidade: texto(v('Cidade')),
    endereco_completo: texto(v('Endereco')),
    endereco_numero: texto(v('Numero')),
    endereco_complemento: texto(v('Complemento')),
    endereco_cep: cep(v('CEP')),
    cepBruto: texto(v('CEP')),
    lat: coordenada(v('Latitude'), 90),
    lng: coordenada(v('Longitude'), 180),
    telefone: null,
    fotos,
    url_origem: null,
  }, problemas, cidadeSite)
}

// ── comum ────────────────────────────────────────────────────────────

function urlsFotos(urls: Array<string | null>): string[] {
  const vistas = new Set<string>()
  const ok: string[] = []
  for (const u of urls) {
    const s = (u ?? '').trim()
    if (!/^https?:\/\//i.test(s)) continue
    if (vistas.has(s)) continue
    vistas.add(s)
    ok.push(s)
  }
  return ok
}

interface Bruto extends Omit<ImovelImportado, 'titulo' | 'descricao'> {
  tituloBruto: string | null
  descricaoTexto: string
  extras: string[]
  periodo: string
  transacao: ResultadoMapeamento['transacao']
  cepBruto: string | null
}

const NOME_TIPO: Record<TipoImovel, string> = {
  apartamento: 'Apartamento', casa: 'Casa', kitnet: 'Kitnet', comercial: 'Imóvel comercial', terreno: 'Terreno',
}

function finalizar(b: Bruto, problemas: Problema[], cidadeSite: string): ResultadoMapeamento {
  const transacao = b.transacao
  const base = { problemas, transacao }

  if (!b.codigo) return { ...base, imovel: null, ignorar: 'Sem código do imóvel (ListingID) no arquivo' }
  if (transacao === 'venda') return { ...base, imovel: null, ignorar: 'Só venda — o site é de aluguel' }
  if (transacao === 'temporada' || (b.preco == null && /day|week|di|seman/.test(b.periodo))) {
    return { ...base, transacao: 'temporada', imovel: null, ignorar: 'Aluguel por temporada (diária/semana)' }
  }
  if (b.preco == null) return { ...base, imovel: null, ignorar: 'Sem valor de aluguel' }
  if (b.preco > 1_000_000) return { ...base, imovel: null, ignorar: 'Valor de aluguel fora do normal (confira no sistema de origem)' }

  const cidade = normalizarCidade(b.cidade)
  if (cidade && cidade !== cidadeSite) {
    return { ...base, imovel: null, ignorar: `Fora de ${cidadeSite === 'cuiaba' ? 'Cuiabá' : cidadeSite} (${b.cidade})` }
  }

  // Título: o do arquivo, ou um montado com o que se sabe.
  let titulo = (b.tituloBruto ?? '').replace(/\s+/g, ' ').trim()
  if (titulo.length < 5) {
    const partes = [
      NOME_TIPO[b.tipo],
      b.quartos ? `${b.quartos} quarto${b.quartos > 1 ? 's' : ''}` : '',
      b.bairro_nome ? `no ${b.bairro_nome}` : '',
    ].filter(Boolean)
    titulo = `${partes.join(' ')} para alugar`
    problemas.push({ nivel: 'aviso', texto: 'Sem título no arquivo — montamos um' })
  }
  titulo = titulo.slice(0, 120)

  let descricao = b.descricaoTexto
  if (b.extras.length) {
    const unicos = [...new Set(b.extras)]
    descricao = [descricao, `Características: ${unicos.join(', ')}.`].filter(Boolean).join('\n\n')
  }

  if (b.fotos.length === 0) problemas.push({ nivel: 'aviso', texto: 'Sem fotos no arquivo' })
  else if (b.fotos.length > MAX_FOTOS_IMPORTACAO) {
    problemas.push({ nivel: 'aviso', texto: `${b.fotos.length} fotos — entram as ${MAX_FOTOS_IMPORTACAO} primeiras (limite do site)` })
  }
  if (!b.bairro_nome) problemas.push({ nivel: 'aviso', texto: 'Sem bairro no arquivo' })
  if (!b.endereco_cep) {
    problemas.push({ nivel: 'aviso', texto: b.cepBruto ? `CEP inválido no arquivo (${b.cepBruto})` : 'Sem CEP (o portal exige)' })
  }
  if (!b.area_m2 && !b.area_construida_m2 && !(b.tipo === 'terreno' && b.area_terreno_m2)) {
    problemas.push({ nivel: 'aviso', texto: 'Sem área (m²)' })
  }
  if (b.garantia_caucao) problemas.push({ nivel: 'aviso', texto: 'Aceita caução: informe quantos meses no anúncio' })

  const imovel: ImovelImportado = {
    codigo: b.codigo,
    titulo,
    descricao: textoParaHtml(descricao.slice(0, 20000)),
    tipo: b.tipo,
    preco: Math.round(b.preco * 100) / 100,
    taxa_condominio: b.taxa_condominio,
    iptu: b.iptu,
    area_m2: b.area_m2,
    area_construida_m2: b.area_construida_m2,
    area_terreno_m2: b.area_terreno_m2,
    quartos: b.tipo === 'terreno' ? 0 : b.quartos,
    suites: b.tipo === 'terreno' ? 0 : Math.min(b.suites, b.quartos || b.suites),
    banheiros: b.tipo === 'terreno' ? 0 : b.banheiros,
    vagas: b.vagas,
    piscina: b.piscina,
    aceita_pets: b.aceita_pets,
    mobiliado: b.mobiliado,
    garantia_fianca: b.garantia_fianca,
    garantia_caucao: b.garantia_caucao,
    garantia_fiador: b.garantia_fiador,
    bairro_nome: b.bairro_nome?.replace(/\s+/g, ' ').trim().slice(0, 120) || null,
    cidade: b.cidade,
    endereco_completo: b.endereco_completo?.slice(0, 300) ?? null,
    endereco_numero: b.endereco_numero?.slice(0, 30) ?? null,
    endereco_complemento: b.endereco_complemento?.slice(0, 120) ?? null,
    endereco_cep: b.endereco_cep,
    lat: b.lat != null && b.lng != null ? b.lat : null,
    lng: b.lat != null && b.lng != null ? b.lng : null,
    telefone: b.telefone,
    fotos: b.fotos.slice(0, MAX_FOTOS_IMPORTACAO),
    url_origem: b.url_origem,
  }
  return { ...base, imovel, ignorar: null }
}

export function mapearListagem(l: NoXml, formato: FormatoImportacao, cidadeSite = 'cuiaba'): ResultadoMapeamento {
  return formato === 'vrsync' ? mapearVRSync(l, cidadeSite) : mapearZapLegado(l, cidadeSite)
}
