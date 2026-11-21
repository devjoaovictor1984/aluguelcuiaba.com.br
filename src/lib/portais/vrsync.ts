/**
 * Gerador do feed VRSync — o XML que o Canal Pro (Grupo OLX) lê para
 * publicar no OLX, ZAP Imóveis e Viva Real.
 *
 * Especificação: https://developers.grupozap.com/feeds/vrsync/
 * Documentação interna: docs/integracoes/portais/README.md
 *
 * Funções puras (sem banco): recebem o imóvel já carregado e devolvem XML
 * ou a lista de problemas. A rota /api/portais/vrsync/[token] faz o resto.
 */

export interface ImovelPortal {
  id: string
  slug: string | null
  titulo: string
  descricao: string | null
  tipo: string
  preco: number
  taxa_condominio: number | null
  iptu: number | null
  custo_tipo: string | null
  area_m2: number | null
  area_construida_m2: number | null
  area_terreno_m2: number | null
  quartos: number | null
  suites: number | null
  banheiros: number | null
  vagas: number | null
  piscina: boolean | null
  aceita_pets: boolean | null
  mobiliado: boolean | null
  condominio_id: string | null
  endereco_completo: string | null
  endereco_numero: string | null
  endereco_cep: string | null
  lat: number | null
  lng: number | null
  garantia_fianca: boolean | null
  garantia_caucao: boolean | null
  garantia_fiador: boolean | null
  portais_destaque: string | null
  updated_at: string
  bairro: { nome: string; slug: string } | null
  fotos: Array<{ url: string; principal: boolean | null; ordem: number | null }> | null
}

export interface ContatoPortal {
  nome: string
  email: string
  telefone: string | null
}

export interface Problema {
  /** `erro` tira o anúncio do feed (o portal recusaria); `aviso` vai, mas pode perder qualidade. */
  nivel: 'erro' | 'aviso'
  texto: string
}

// Valores aceitos pelo VRSync (PropertyType) para os tipos do site.
function tipoVRSync(im: ImovelPortal): { usage: string; property: string } {
  switch (im.tipo) {
    case 'apartamento': return { usage: 'Residential', property: 'Residential / Apartment' }
    case 'casa':        return { usage: 'Residential', property: im.condominio_id ? 'Residential / Condo' : 'Residential / Home' }
    case 'kitnet':      return { usage: 'Residential', property: 'Residential / Kitnet' }
    case 'terreno':     return { usage: 'Residential', property: 'Residential / Land Lot' }
    case 'comercial':   return { usage: 'Commercial',  property: 'Commercial / Business' }
    default:            return { usage: 'Residential', property: 'Residential / Home' }
  }
}

/** O editor do site grava HTML; o portal quer texto (máx. 3000). */
export function textoPlano(html: string | null): string {
  if (!html) return ''
  return html
    .replace(/<\s*(br|\/p|\/li|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function ehJpg(url: string) {
  return /\.jpe?g(\?|$)/i.test(url)
}

function fotosOrdenadas(im: ImovelPortal) {
  const fs = [...(im.fotos ?? [])].sort((a, b) =>
    Number(!!b.principal) - Number(!!a.principal) || (a.ordem ?? 0) - (b.ordem ?? 0))
  return fs.filter(f => ehJpg(f.url))
}

/** O portal usa o formato dos exemplos (`78000-000`); o site aceita com ou sem traço. */
export function cepPortal(cep: string | null): string | null {
  const d = (cep ?? '').replace(/\D/g, '')
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : null
}

function area(im: ImovelPortal) {
  const v = im.area_m2 ?? im.area_construida_m2 ?? null
  return v ? Math.round(v) : null
}

/** Mínimo de 5 fotos JPG, área, CEP, descrição — o que o portal cobra. */
export function validarParaPortal(im: ImovelPortal): Problema[] {
  const p: Problema[] = []
  const fotos = fotosOrdenadas(im)
  const naoJpg = (im.fotos ?? []).length - fotos.length

  if (fotos.length < 5) p.push({ nivel: 'erro', texto: `Precisa de pelo menos 5 fotos JPG (tem ${fotos.length})` })
  if (naoJpg > 0) p.push({ nivel: 'aviso', texto: `${naoJpg} foto(s) PNG/WebP ficam de fora — o portal só aceita JPG` })
  if (!area(im) && !(im.tipo === 'terreno' && im.area_terreno_m2)) p.push({ nivel: 'erro', texto: 'Falta a área (m²)' })
  if (!im.bairro?.nome) p.push({ nivel: 'erro', texto: 'Falta o bairro' })
  if (!im.endereco_cep) p.push({ nivel: 'erro', texto: 'Falta o CEP (aba "Dados do contrato")' })
  else if (!cepPortal(im.endereco_cep)) p.push({ nivel: 'erro', texto: 'CEP inválido — precisa ter 8 dígitos' })
  if (!im.preco || im.preco <= 0) p.push({ nivel: 'erro', texto: 'Falta o valor do aluguel' })
  if (im.titulo.trim().length < 10) p.push({ nivel: 'erro', texto: 'Título com menos de 10 caracteres' })
  if (textoPlano(im.descricao).length < 50) p.push({ nivel: 'aviso', texto: 'Descrição curta — completamos com os dados do imóvel' })
  if (im.custo_tipo === 'pacote') p.push({ nivel: 'aviso', texto: 'Valor em pacote: vai como aluguel, sem condomínio/IPTU separados' })
  if (im.lat == null || im.lng == null) p.push({ nivel: 'aviso', texto: 'Sem localização no mapa' })
  return p
}

/** O robô do Grupo OLX se identifica como VivaRealBot (feeds/connection_guideline). */
export function ehRoboDoPortal(userAgent: string | null | undefined) {
  return /vivarealbot|grupozap|olx/i.test(userAgent ?? '')
}

export function podeIrProPortal(im: ImovelPortal) {
  return !validarParaPortal(im).some(x => x.nivel === 'erro')
}

// ── XML ─────────────────────────────────────────────────────────────

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Caracteres de controle quebram o parser do portal.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

/** CDATA não pode conter "]]>"; quebra em dois blocos se aparecer. */
function cdata(s: string) {
  const limpo = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  return `<![CDATA[${limpo.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

function inteiro(n: number | null | undefined) {
  return n == null ? null : Math.round(Number(n))
}

function descricaoFinal(im: ImovelPortal): string {
  let d = textoPlano(im.descricao)
  if (d.length < 50) {
    // Completa com o que o anúncio já diz, pra passar do mínimo de 50.
    const partes = [
      im.titulo.trim(),
      im.quartos ? `${im.quartos} quarto${im.quartos > 1 ? 's' : ''}` : '',
      im.banheiros ? `${im.banheiros} banheiro${im.banheiros > 1 ? 's' : ''}` : '',
      im.vagas ? `${im.vagas} vaga${im.vagas > 1 ? 's' : ''}` : '',
      area(im) ? `${area(im)} m²` : '',
      im.bairro?.nome ? `no bairro ${im.bairro.nome}, Cuiabá/MT` : 'em Cuiabá/MT',
    ].filter(Boolean)
    d = [d, partes.join(' · ') + '.'].filter(Boolean).join('\n\n')
  }
  return d.slice(0, 3000)
}

function listingXml(im: ImovelPortal, contato: ContatoPortal, siteUrl: string): string {
  const { usage, property } = tipoVRSync(im)
  const titulo = im.titulo.trim().slice(0, 100)
  const url = `${siteUrl}/imoveis/${im.bairro?.slug ? `${im.bairro.slug}/` : ''}${im.slug ?? im.id}`
  const fotos = fotosOrdenadas(im)
  const pacote = im.custo_tipo === 'pacote'

  const features: string[] = []
  if (im.piscina) features.push('Pool')
  if (im.aceita_pets) features.push('Pets Allowed')
  if (im.mobiliado) features.push('Furnished')

  const garantias: string[] = []
  if (im.garantia_fianca) garantias.push('INSURANCE_GUARANTEE')
  if (im.garantia_caucao) garantias.push('SECURITY_DEPOSIT')
  if (im.garantia_fiador) garantias.push('GUARANTOR')

  const destaque = ['STANDARD', 'PREMIUM', 'SUPER_PREMIUM'].includes(im.portais_destaque ?? '')
    ? im.portais_destaque!
    : 'STANDARD'

  const L: string[] = []
  L.push('    <Listing>')
  L.push(`      <ListingID>${esc(im.id)}</ListingID>`)
  L.push(`      <Title>${cdata(titulo)}</Title>`)
  L.push('      <TransactionType>For Rent</TransactionType>')
  L.push(`      <PublicationType>${destaque}</PublicationType>`)
  L.push(`      <DetailViewUrl>${esc(url)}</DetailViewUrl>`)
  L.push('      <Media>')
  // O portal guarda a foto pela URL e só baixa de novo se a URL mudar. O site
  // regrava a foto no MESMO caminho (`<user>/<imovel>/1.jpg`, upsert), então
  // a versão vai na query: editou o anúncio, a URL muda e o portal rebaixa.
  const versao = new Date(im.updated_at).getTime().toString(36)
  fotos.forEach((f, i) => {
    const u = `${f.url}${f.url.includes('?') ? '&' : '?'}v=${versao}`
    L.push(`        <Item medium="image"${i === 0 ? ' primary="true"' : ''}>${esc(u)}</Item>`)
  })
  L.push('      </Media>')
  L.push('      <Details>')
  L.push(`        <UsageType>${usage}</UsageType>`)
  L.push(`        <PropertyType>${property}</PropertyType>`)
  L.push(`        <Description>${cdata(descricaoFinal(im))}</Description>`)
  L.push(`        <RentalPrice currency="BRL" period="Monthly">${inteiro(im.preco)}</RentalPrice>`)
  if (!pacote && im.taxa_condominio != null) {
    L.push(`        <PropertyAdministrationFee currency="BRL">${inteiro(im.taxa_condominio)}</PropertyAdministrationFee>`)
  }
  if (!pacote && im.iptu != null) {
    // No site o IPTU é digitado como valor MENSAL.
    L.push(`        <Iptu currency="BRL" period="Monthly">${inteiro(im.iptu)}</Iptu>`)
  }
  const a = area(im)
  if (a) L.push(`        <LivingArea unit="square metres">${a}</LivingArea>`)
  if (im.area_terreno_m2) L.push(`        <LotArea unit="square metres">${inteiro(im.area_terreno_m2)}</LotArea>`)
  if (im.tipo !== 'terreno') {
    L.push(`        <Bedrooms>${inteiro(im.quartos) ?? 0}</Bedrooms>`)
    L.push(`        <Bathrooms>${inteiro(im.banheiros) ?? 1}</Bathrooms>`)
    if (im.suites) L.push(`        <Suites>${inteiro(im.suites)}</Suites>`)
    L.push(`        <Garage type="Parking Space">${inteiro(im.vagas) ?? 0}</Garage>`)
  }
  if (features.length) {
    L.push('        <Features>')
    features.forEach(f => L.push(`          <Feature>${f}</Feature>`))
    L.push('        </Features>')
  }
  if (garantias.length) {
    L.push('        <Warranties>')
    garantias.forEach(g => L.push(`          <Warranty>${g}</Warranty>`))
    L.push('        </Warranties>')
  }
  L.push('      </Details>')
  // displayAddress="Neighborhood": o portal mostra só o bairro — mesmo
  // critério do site, que não expõe o endereço do imóvel no anúncio. Rua e
  // número vão só pra geolocalização do portal.
  L.push('      <Location displayAddress="Neighborhood">')
  L.push('        <Country abbreviation="BR">Brasil</Country>')
  L.push(`        <State abbreviation="MT">${cdata('Mato Grosso')}</State>`)
  L.push(`        <City>${cdata('Cuiabá')}</City>`)
  L.push(`        <Neighborhood>${cdata(im.bairro?.nome ?? '')}</Neighborhood>`)
  if (im.endereco_completo) L.push(`        <Address>${cdata(im.endereco_completo)}</Address>`)
  if (im.endereco_numero) L.push(`        <StreetNumber>${esc(im.endereco_numero)}</StreetNumber>`)
  const cep = cepPortal(im.endereco_cep)
  if (cep) L.push(`        <PostalCode>${cep}</PostalCode>`)
  if (im.lat != null && im.lng != null) {
    L.push(`        <Latitude>${im.lat}</Latitude>`)
    L.push(`        <Longitude>${im.lng}</Longitude>`)
  }
  L.push('      </Location>')
  L.push('      <ContactInfo>')
  L.push(`        <Name>${cdata(contato.nome)}</Name>`)
  L.push(`        <Email>${esc(contato.email)}</Email>`)
  if (contato.telefone) L.push(`        <Telephone>${esc(contato.telefone)}</Telephone>`)
  L.push(`        <Website>${esc(siteUrl)}</Website>`)
  L.push('      </ContactInfo>')
  L.push('    </Listing>')
  return L.join('\n')
}

export function gerarFeedVRSync(imoveis: ImovelPortal[], contato: ContatoPortal, siteUrl: string): string {
  const publicaveis = imoveis.filter(podeIrProPortal)
  const agora = new Date().toISOString().slice(0, 19)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd">',
    '  <Header>',
    '    <Provider>AluguelCuiaba</Provider>',
    `    <Email>${esc(contato.email)}</Email>`,
    `    <ContactName>${cdata(contato.nome)}</ContactName>`,
    `    <PublishDate>${agora}</PublishDate>`,
    contato.telefone ? `    <Telephone>${esc(contato.telefone)}</Telephone>` : '',
    '  </Header>',
    '  <Listings>',
    ...publicaveis.map(im => listingXml(im, contato, siteUrl)),
    '  </Listings>',
    '</ListingDataFeed>',
    '',
  ].filter(l => l !== '').join('\n')
}
