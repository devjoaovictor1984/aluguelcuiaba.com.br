// Geradores de JSON-LD reutilizáveis. Centraliza schema.org para o site
// inteiro — qualquer mudança vira efeito global. Use junto com <JsonLd>.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aluguelcuiaba.com.br'

interface OrganizationInput {
  logo?: string
  email?: string
  instagram?: string
  facebook?: string
}
export function organizationJsonLd(o: OrganizationInput = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AluguelCuiabá',
    alternateName: 'AluguelCuiabá.com.br',
    url: APP_URL,
    logo: o.logo
      ? (o.logo.startsWith('http') ? o.logo : `${APP_URL}${o.logo}`)
      : `${APP_URL}/logo.png`,
    email: o.email,
    sameAs: [o.instagram, o.facebook].filter(Boolean),
    areaServed: {
      '@type': 'City',
      name: 'Cuiabá',
      containedInPlace: { '@type': 'State', name: 'Mato Grosso' },
    },
  }
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AluguelCuiabá',
    url: APP_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${APP_URL}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

interface BlogPostingInput {
  titulo: string
  descricao?: string | null
  url: string
  imagem?: string | null
  publicadoEm: string
  atualizadoEm?: string | null
  categoria?: string
  tags?: string[] | null
  conteudoHtml?: string | null
}
export function blogPostingJsonLd(p: BlogPostingInput) {
  const articleBody = (p.conteudoHtml ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const wordCount = articleBody ? articleBody.split(' ').length : undefined
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: p.titulo,
    description: p.descricao ?? undefined,
    image: [(p.imagem || `${APP_URL}/og-default.jpg`).split('?')[0]],
    datePublished: p.publicadoEm,
    dateModified: p.atualizadoEm ?? p.publicadoEm,
    author: { '@type': 'Organization', name: 'AluguelCuiabá', url: APP_URL },
    publisher: {
      '@type': 'Organization',
      name: 'AluguelCuiabá',
      logo: { '@type': 'ImageObject', url: `${APP_URL}/logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': p.url },
    keywords: p.tags?.join(', ') ?? undefined,
    articleSection: p.categoria,
    articleBody: articleBody || undefined,
    wordCount,
    inLanguage: 'pt-BR',
  }
}

interface RealEstateInput {
  titulo: string
  descricao?: string | null
  url: string
  fotos?: string[]
  tipo: string
  quartos?: number
  banheiros?: number
  areaM2?: number | null
  aceitaPets?: boolean
  bairro?: string | null
  endereco?: string | null
  lat?: number | null
  lng?: number | null
  preco: number
  status: string
  criadoEm: string
}
export function realEstateJsonLd(i: RealEstateInput) {
  const tipoSchema =
    i.tipo === 'apartamento' ? 'Apartment' :
    i.tipo === 'casa' ? 'House' :
    i.tipo === 'kitnet' ? 'Apartment' :
    'Residence'
  return {
    '@context': 'https://schema.org',
    '@type': ['RealEstateListing', tipoSchema],
    name: i.titulo,
    description: i.descricao || `${i.tipo} para alugar em ${i.bairro ?? 'Cuiabá'}.`,
    url: i.url,
    image: i.fotos && i.fotos.length > 0 ? i.fotos.map(f => f.split('?')[0]) : undefined,
    datePosted: i.criadoEm,
    leaseLength: { '@type': 'QuantitativeValue', value: 12, unitCode: 'MON' },
    numberOfRooms: i.quartos && i.quartos > 0 ? i.quartos : undefined,
    numberOfBathroomsTotal: i.banheiros && i.banheiros > 0 ? i.banheiros : undefined,
    floorSize: i.areaM2 ? { '@type': 'QuantitativeValue', value: i.areaM2, unitCode: 'MTK' } : undefined,
    petsAllowed: i.aceitaPets || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: i.endereco || undefined,
      addressLocality: 'Cuiabá',
      addressRegion: 'MT',
      addressCountry: 'BR',
      ...(i.bairro && { addressNeighborhood: i.bairro }),
    },
    geo: i.lat && i.lng ? { '@type': 'GeoCoordinates', latitude: i.lat, longitude: i.lng } : undefined,
    offers: {
      '@type': 'Offer',
      price: i.preco,
      priceCurrency: 'BRL',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: i.preco,
        priceCurrency: 'BRL',
        referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
      },
      availability: i.status === 'ativo' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      url: i.url,
    },
  }
}

interface Crumb { name: string; url: string }
export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  }
}

interface FaqItem { pergunta: string; resposta: string }
export function faqJsonLd(faqs: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: f.resposta },
    })),
  }
}
