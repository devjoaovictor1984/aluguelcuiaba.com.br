// Importação de XML (VRSync / ZAP legado): leitura, conversão e bairros.
// Dados fictícios.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { decodificarXml, lerXml, ErroImportacao } from '@/lib/importacao/xml'
import { mapearListagem, numero, paraTexto, textoParaHtml } from '@/lib/importacao/mapear'
import { criarBuscaBairros, normalizarBairro } from '@/lib/importacao/bairros'
import { gerarFeedVRSync, type ImovelPortal } from '@/lib/portais/vrsync'

const FOTOS = [1, 2, 3, 4, 5, 6].map(i => ({
  url: `https://exemplo.supabase.co/storage/v1/object/public/fotos-imoveis/u/i/${i}.jpg`,
  principal: i === 2,
  ordem: i,
}))

const IMOVEL: ImovelPortal = {
  id: 'abc-123', slug: 'apto-teste', titulo: 'Apartamento 3 quartos no Goiabeiras',
  descricao: '<p>Apartamento <strong>arejado</strong>, perto do shopping & do parque.</p><p>Segunda linha com bastante texto para passar do mínimo.</p>',
  tipo: 'apartamento', preco: 3200, taxa_condominio: 650, iptu: 120, custo_tipo: 'separado',
  area_m2: 98.5, area_construida_m2: null, area_terreno_m2: null, quartos: 3, suites: 1, banheiros: 2, vagas: 2,
  piscina: true, aceita_pets: true, mobiliado: false, condominio_id: null,
  endereco_completo: 'Rua das Flores', endereco_numero: '100', endereco_cep: '78043-000', lat: -15.58, lng: -56.08,
  garantia_fianca: true, garantia_caucao: false, garantia_fiador: true, portais_destaque: 'STANDARD',
  updated_at: '2026-11-20T10:00:00Z', bairro: { nome: 'Goiabeiras', slug: 'goiabeiras' }, fotos: FOTOS,
}

// ── ida e volta: o XML que o site gera é lido de volta igual ─────────

test('VRSync gerado pelo próprio site volta com os mesmos dados', () => {
  const xml = gerarFeedVRSync([IMOVEL], { nome: 'Fulano de Teste', email: 'f@exemplo.com', telefone: '65999887766' }, 'https://exemplo.com')
  const lido = lerXml(xml)
  assert.equal(lido.formato, 'vrsync')
  assert.equal(lido.listagens.length, 1)
  assert.equal(lido.provedor, 'AluguelCuiaba')

  const r = mapearListagem(lido.listagens[0], lido.formato)
  assert.equal(r.ignorar, null)
  const im = r.imovel!
  assert.equal(im.codigo, 'abc-123')
  assert.equal(im.titulo, 'Apartamento 3 quartos no Goiabeiras')
  assert.equal(im.tipo, 'apartamento')
  assert.equal(im.preco, 3200)
  assert.equal(im.taxa_condominio, 650)
  assert.equal(im.iptu, 120)                // ia como mensal, volta mensal
  assert.equal(im.area_m2, 99)              // o feed arredonda
  assert.equal(im.quartos, 3)
  assert.equal(im.suites, 1)
  assert.equal(im.banheiros, 2)
  assert.equal(im.vagas, 2)
  assert.equal(im.piscina, true)
  assert.equal(im.aceita_pets, true)
  assert.equal(im.mobiliado, false)
  assert.equal(im.garantia_fianca, true)
  assert.equal(im.garantia_fiador, true)
  assert.equal(im.garantia_caucao, false)
  assert.equal(im.bairro_nome, 'Goiabeiras')
  assert.equal(im.endereco_cep, '78043000')
  assert.equal(im.endereco_numero, '100')
  assert.equal(im.lat, -15.58)
  assert.equal(im.telefone, '65999887766')
  assert.equal(im.fotos.length, 6)
  assert.match(im.fotos[0], /\/2\.jpg\?v=/)  // a principal vem primeiro
  assert.match(im.descricao!, /^<p>Apartamento arejado, perto do shopping &amp; do parque\.<br>Segunda/)
})

// ── formatos e codificações ──────────────────────────────────────────

const VRSYNC_MIN = (corpo: string, enc = 'UTF-8') => `<?xml version="1.0" encoding="${enc}"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync">
  <Header><Provider>Sistema X</Provider></Header>
  <Listings>${corpo}</Listings>
</ListingDataFeed>`

const LISTING = (extra = '', transacao = 'For Rent', cidade = 'Cuiabá') => `
<Listing>
  <ListingID>X-1</ListingID>
  <Title><![CDATA[Casa no Jd. Itália]]></Title>
  <TransactionType>${transacao}</TransactionType>
  <Media>
    <Item medium="image">https://fotos.exemplo.com/a.jpg</Item>
    <Item medium="image" primary="true">https://fotos.exemplo.com/b.jpg</Item>
    <Item medium="video">https://youtube.com/watch?v=1</Item>
    <Item medium="image">https://fotos.exemplo.com/a.jpg</Item>
  </Media>
  <Details>
    <UsageType>Residential</UsageType>
    <PropertyType>Residential / Sobrado</PropertyType>
    <Description><![CDATA[Casa ótima.<br>Com quintal & <b>churrasqueira</b>. <script>alert(1)</script>]]></Description>
    <RentalPrice currency="BRL" period="Monthly">2.500,00</RentalPrice>
    <Iptu currency="BRL" period="Yearly">1200</Iptu>
    <LivingArea unit="square metres">150</LivingArea>
    <LotArea unit="square metres">300</LotArea>
    <Bedrooms>3</Bedrooms><Bathrooms>2</Bathrooms><Suites>5</Suites><Garage type="Parking Space">2</Garage>
    <Features><Feature>Elevator</Feature><Feature>Gym</Feature><Feature>Furnished</Feature></Features>
    <Warranties><Warranty>SECURITY_DEPOSIT</Warranty><Warranty>CAPITALIZATION_BOND</Warranty></Warranties>
  </Details>
  <Location displayAddress="Neighborhood">
    <City>${cidade}</City><Neighborhood>Jd. Itália</Neighborhood><PostalCode>78.060-000</PostalCode>
  </Location>
  ${extra}
</Listing>`

test('VRSync de outro sistema: foto principal, vídeo, duplicada, IPTU anual, HTML e script', () => {
  const { listagens, formato } = lerXml(VRSYNC_MIN(LISTING()))
  const r = mapearListagem(listagens[0], formato)
  const im = r.imovel!
  assert.equal(im.tipo, 'casa')
  assert.equal(im.preco, 2500)
  assert.equal(im.iptu, 100)                      // 1200/ano → 100/mês
  assert.deepEqual(im.fotos, ['https://fotos.exemplo.com/b.jpg', 'https://fotos.exemplo.com/a.jpg'])
  assert.equal(im.suites, 3)                      // suíte não passa de quarto
  assert.equal(im.mobiliado, true)
  assert.equal(im.garantia_caucao, true)
  assert.equal(im.endereco_cep, '78060000')
  assert.ok(!im.descricao!.includes('<script'))
  assert.ok(!im.descricao!.includes('alert'))
  assert.match(im.descricao!, /Características: Elevador, Academia\./)
  assert.ok(r.problemas.some(p => /vídeo/.test(p.texto)))
  assert.ok(r.problemas.some(p => /CAPITALIZATION_BOND/.test(p.texto)))
  assert.ok(r.problemas.some(p => /caução/.test(p.texto)))
})

test('venda, temporada, outra cidade e sem preço ficam de fora com o motivo', () => {
  const venda = lerXml(VRSYNC_MIN(LISTING('', 'For Sale')))
  assert.match(mapearListagem(venda.listagens[0], 'vrsync').ignorar!, /venda/)

  const vg = lerXml(VRSYNC_MIN(LISTING('', 'For Rent', 'Várzea Grande')))
  assert.match(mapearListagem(vg.listagens[0], 'vrsync').ignorar!, /Várzea Grande/)

  const temporada = lerXml(VRSYNC_MIN(LISTING().replace('period="Monthly"', 'period="Daily"')))
  assert.match(mapearListagem(temporada.listagens[0], 'vrsync').ignorar!, /temporada/)

  const sem = lerXml(VRSYNC_MIN(LISTING().replace(/<RentalPrice[^]*?<\/RentalPrice>/, '')))
  assert.match(mapearListagem(sem.listagens[0], 'vrsync').ignorar!, /Sem valor/)

  const ambos = lerXml(VRSYNC_MIN(LISTING('', 'Sale/Rent')))
  assert.equal(mapearListagem(ambos.listagens[0], 'vrsync').ignorar, null)
})

test('arquivo em ISO-8859-1 mantém os acentos', () => {
  const xml = VRSYNC_MIN(LISTING(), 'ISO-8859-1')
  const bytes = Buffer.from(xml, 'latin1')
  const lido = lerXml(decodificarXml(bytes))
  assert.equal(mapearListagem(lido.listagens[0], 'vrsync').imovel!.bairro_nome, 'Jd. Itália')
})

test('arquivo .gz é descompactado', () => {
  const bytes = gzipSync(Buffer.from(VRSYNC_MIN(LISTING()), 'utf8'))
  assert.equal(lerXml(decodificarXml(bytes)).listagens.length, 1)
})

test('HTML, XML desconhecido e lixo dão erro claro', () => {
  assert.throws(() => lerXml('<!DOCTYPE html><html><body>login</body></html>'), (e: unknown) => e instanceof ErroImportacao && /HTML/.test(e.message))
  assert.throws(() => lerXml('<?xml version="1.0"?><Produtos><P/></Produtos>'), /Produtos/)
  assert.throws(() => lerXml(''), ErroImportacao)
})

test('DOCTYPE com entidade (ataque) é descartado', () => {
  const xml = `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;">]>` + VRSYNC_MIN(LISTING()).replace(/^<\?xml[^>]*>/, '')
  const lido = lerXml(xml)
  assert.equal(lido.listagens.length, 1)
})

test('ZAP legado (<Carga>)', () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<Carga><Imoveis><Imovel>
  <CodigoImovel>Z-9</CodigoImovel><TipoImovel>Apartamento</TipoImovel><SubTipoImovel>Cobertura</SubTipoImovel>
  <Cidade>CUIABA</Cidade><Bairro>CPA I</Bairro><CEP>78055000</CEP>
  <PrecoLocacao>1800</PrecoLocacao><PrecoCondominio>300</PrecoCondominio><ValorIPTU>2400</ValorIPTU>
  <AreaUtil>70</AreaUtil><QtdDormitorios>2</QtdDormitorios><QtdBanheiros>1</QtdBanheiros><QtdVagas>1</QtdVagas>
  <Piscina>1</Piscina><Elevador>1</Elevador>
  <Observacao>Bom apartamento.</Observacao>
  <Fotos>
    <Foto><URLArquivo>https://f.exemplo.com/1.jpg</URLArquivo><Principal>0</Principal></Foto>
    <Foto><URLArquivo>https://f.exemplo.com/2.jpg</URLArquivo><Principal>1</Principal></Foto>
  </Fotos>
</Imovel></Imoveis></Carga>`
  const lido = lerXml(xml)
  assert.equal(lido.formato, 'zap_legado')
  const r = mapearListagem(lido.listagens[0], lido.formato)
  const im = r.imovel!
  assert.equal(im.codigo, 'Z-9')
  assert.equal(im.tipo, 'apartamento')
  assert.equal(im.preco, 1800)
  assert.equal(im.iptu, 200)               // anual maior que o aluguel → /12
  assert.equal(im.piscina, true)
  assert.deepEqual(im.fotos, ['https://f.exemplo.com/2.jpg', 'https://f.exemplo.com/1.jpg'])
  assert.match(im.descricao!, /Elevador/)
  assert.match(im.titulo, /Apartamento 2 quartos no CPA I/)
})

// ── miudezas ─────────────────────────────────────────────────────────

test('números em vários formatos', () => {
  assert.equal(numero('1.234,56'), 1234.56)
  assert.equal(numero('1234.56'), 1234.56)
  assert.equal(numero('R$ 2.500'), 2500)
  assert.equal(numero('1,500'), 1500)
  assert.equal(numero('1500,5'), 1500.5)
  assert.equal(numero('abc'), null)
  assert.equal(numero(''), null)
})

test('texto e HTML', () => {
  assert.equal(paraTexto('a&nbsp;b &amp; c&#233;'), 'a b & cé')
  assert.equal(textoParaHtml('linha 1\nlinha 2\n\n<b>x</b>'), '<p>linha 1<br>linha 2</p><p>&lt;b&gt;x&lt;/b&gt;</p>')
})

test('bairros: abreviação, acento, romano e núcleo', () => {
  assert.equal(normalizarBairro('Jd. Itália'), 'jardim italia')
  assert.equal(normalizarBairro('CPA-I'), 'cpa 1')
  assert.equal(normalizarBairro('CPA 1'), 'cpa 1')
  const achar = criarBuscaBairros(
    [{ id: '1', nome: 'Jardim Itália' }, { id: '2', nome: 'CPA I' }, { id: '3', nome: 'Residencial Paiaguás' }, { id: '4', nome: 'Jardim Paulista' }, { id: '5', nome: 'Vila Paulista' }],
    new Map([['centro velho', '9']]),
  )
  assert.equal(achar('JD ITALIA'), '1')
  assert.equal(achar('CPA 1'), '2')
  assert.equal(achar('Paiaguás'), '3')
  assert.equal(achar('Paulista'), null)   // ambíguo: Jardim ou Vila
  assert.equal(achar('Centro Velho'), '9') // escolha salva pelo anunciante
  assert.equal(achar('Bairro Inexistente'), null)
})
