/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
// Importar daqui também dispara o registro da fonte Poppins (side-effect no
// topo de contrato-pdf.tsx). Reusamos a mesma família pra manter a identidade.
import { FAMILIA } from './contrato-pdf'

const COR = {
  texto: '#1f2937',
  textoForte: '#111827',
  cinza: '#6b7280',
  cinzaClaro: '#9ca3af',
  borda: '#e5e7eb',
  bordaForte: '#d1d5db',
  roxo: '#581c87',
  roxoClaro: '#7c3aed',
}

const TIPO_LABEL: Record<string, string> = {
  reajuste: 'Reajuste de aluguel',
  prorrogacao: 'Prorrogação de prazo',
  garantia: 'Alteração de garantia',
  valor: 'Alteração de valor',
  clausula: 'Inclusão / alteração de cláusula',
  outro: 'Aditamento',
}

export interface AditivoPDFData {
  // Emitente (administradora / corretor)
  anunciante_nome: string
  anunciante_razao_social: string | null
  anunciante_cnpj: string | null
  anunciante_creci: string | null
  anunciante_creci_juridico: string | null
  anunciante_logo_url: string | null
  anunciante_endereco: string | null
  anunciante_cidade_uf: string | null

  // Contrato original
  contrato_codigo: string
  contrato_data_assinatura: string | null  // dd/mm/yyyy (texto pronto)
  imovel_endereco: string
  finalidade?: 'residencial' | 'comercial' | 'misto'

  // Partes (qualificação curta pro preâmbulo e blocos de assinatura)
  locador_nome: string
  locador_cpf: string | null
  tem_administracao: boolean
  admin_responsavel_nome: string | null
  admin_responsavel_creci: string | null

  locatario_nome: string
  locatario_cpf: string | null
  conjuge_nome: string | null
  conjuge_cpf: string | null
  conjuge_papel?: 'solidario' | 'anuente' | 'nao_participa'

  fiador_nome: string | null
  fiador_cpf: string | null

  testemunhas: Array<{ nome: string; cpf: string | null; rg: string | null }>

  // O aditivo em si
  numero: number
  data_aditivo: string  // YYYY-MM-DD
  tipo: string
  titulo: string | null
  objeto: string  // texto livre digitado pelo corretor
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 56, paddingBottom: 56, paddingLeft: 56, paddingRight: 56,
    fontSize: 10, fontFamily: FAMILIA, color: COR.texto, lineHeight: 1.55,
  },
  cabecalhoLinha: { height: 1.5, backgroundColor: COR.roxoClaro, marginTop: 8, marginBottom: 16 },
  selo: {
    fontSize: 9, fontFamily: FAMILIA, fontWeight: 'bold', color: COR.roxoClaro,
    textAlign: 'center', letterSpacing: 1.6, marginBottom: 6,
  },
  titulo: {
    fontSize: 16, fontFamily: FAMILIA, fontWeight: 'bold', color: COR.textoForte,
    textAlign: 'center', lineHeight: 1.25, marginBottom: 4,
  },
  subtitulo: { fontSize: 9.5, color: COR.cinza, textAlign: 'center', marginBottom: 2 },
  preambulo: {
    fontSize: 10, color: COR.texto, textAlign: 'justify', lineHeight: 1.65,
    marginTop: 16, marginBottom: 6, fontFamily: FAMILIA,
  },
  parteNome: { fontFamily: FAMILIA, fontWeight: 'bold', color: COR.textoForte },
  clausulaWrap: { marginTop: 14 },
  clausulaTitulo: {
    fontSize: 11, fontFamily: FAMILIA, fontWeight: 'bold', color: COR.textoForte, marginBottom: 5,
  },
  clausulaCorpo: {
    fontSize: 10, color: COR.texto, textAlign: 'justify', lineHeight: 1.6,
    fontFamily: FAMILIA, marginBottom: 5,
  },
  data: {
    fontSize: 10.5, fontFamily: FAMILIA, fontWeight: 'bold', color: COR.textoForte,
    textAlign: 'center', marginTop: 26, marginBottom: 30,
  },
  assinaturaBloco: { marginBottom: 14 },
  assinaturaLinha: { height: 0.7, backgroundColor: COR.bordaForte, marginBottom: 6 },
  assinaturaPapel: {
    fontSize: 7.5, fontFamily: FAMILIA, fontWeight: 'normal', color: COR.roxoClaro,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2,
  },
  assinaturaNome: { fontSize: 10.5, fontFamily: FAMILIA, fontWeight: 'bold', color: COR.textoForte },
  assinaturaCpf: { fontSize: 9, color: COR.cinza, fontFamily: FAMILIA },
  testemunhaTit: {
    fontSize: 8.5, fontFamily: FAMILIA, fontWeight: 'normal', color: COR.roxoClaro,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 18, marginBottom: 6,
  },
})

function fmtDataExtenso(iso: string): string {
  const s = iso.slice(0, 10)
  const [y, m, d] = s.split('-').map(Number)
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  return `${String(d).padStart(2, '0')} de ${meses[m - 1]} de ${y}`
}

/** Numera os parágrafos do objeto como N.1, N.2… (caput inclui), pulando incisos. */
function numerarObjeto(num: number, corpo: string): string[] {
  const blocos = corpo.split(/\n\n+/)
  let p = 0
  return blocos.map(bloco => {
    const t = bloco.trim()
    if (!t) return ''
    if (/^([IVXLCDM]{1,5}\.|[a-zA-Z]\)|\d+[.)])\s/.test(t)) return t
    p++
    return `${num}.${p}. ${t}`
  }).filter(Boolean)
}

export function AditivoDocument({ data }: { data: AditivoPDFData }) {
  const nomeInst = data.anunciante_razao_social ?? data.anunciante_nome
  const cidadeUf = data.anunciante_cidade_uf ?? 'Cuiabá-MT'
  const dataExtenso = fmtDataExtenso(data.data_aditivo)
  const ordinal = `${data.numero}º`

  const finalidade = data.finalidade ?? 'residencial'
  const tipoContrato =
    finalidade === 'comercial' ? 'Locação Comercial' :
    finalidade === 'misto'     ? 'Locação Residencial e Comercial' :
                                 'Locação Residencial'

  const objetoParagrafos = numerarObjeto(1, data.objeto)
  const tipoLabel = data.titulo?.trim() || TIPO_LABEL[data.tipo] || TIPO_LABEL.outro

  // Qualificação curta das partes pro preâmbulo
  const locadorQuali = `${data.locador_nome}${data.locador_cpf ? `, inscrito(a) no CPF/CNPJ sob nº ${data.locador_cpf}` : ''}`
  const locatarioQuali = `${data.locatario_nome}${data.locatario_cpf ? `, inscrito(a) no CPF/CNPJ sob nº ${data.locatario_cpf}` : ''}`

  return (
    <Document
      title={`Termo Aditivo ${ordinal} — Contrato ${data.contrato_codigo}`}
      author={nomeInst}
      subject={`${ordinal} Termo Aditivo ao contrato ${data.contrato_codigo}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho institucional */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {data.anunciante_logo_url && (
              <Image src={data.anunciante_logo_url} style={{ width: 48, height: 48, objectFit: 'contain' }} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontFamily: FAMILIA, fontWeight: 'bold', color: COR.textoForte }}>
                {nomeInst}
                {data.anunciante_creci_juridico ? ` — CRECI-J ${data.anunciante_creci_juridico}` : ''}
              </Text>
              {data.anunciante_creci && (
                <Text style={{ fontSize: 8, color: COR.cinza }}>
                  {data.anunciante_nome} — Corretor de Imóveis | CRECI {data.anunciante_creci}
                </Text>
              )}
              {data.anunciante_endereco && (
                <Text style={{ fontSize: 8, color: COR.cinza }}>{data.anunciante_endereco}</Text>
              )}
              {data.anunciante_cnpj && (
                <Text style={{ fontSize: 8, color: COR.cinza }}>CNPJ {data.anunciante_cnpj}</Text>
              )}
            </View>
          </View>
          <View style={styles.cabecalhoLinha} />
        </View>

        {/* Título */}
        <Text style={styles.selo}>INSTRUMENTO PARTICULAR</Text>
        <Text style={styles.titulo}>
          {ordinal} Termo Aditivo ao Contrato de {tipoContrato}
        </Text>
        <Text style={styles.subtitulo}>Contrato originário nº {data.contrato_codigo}</Text>
        <Text style={styles.subtitulo}>Objeto: {tipoLabel}</Text>

        {/* Preâmbulo */}
        <Text style={styles.preambulo}>
          Pelo presente instrumento particular, de um lado{' '}
          <Text style={styles.parteNome}>{locadorQuali}</Text>, doravante designado(a){' '}
          <Text style={styles.parteNome}>LOCADOR(A)</Text>
          {data.tem_administracao && data.admin_responsavel_nome && (
            <Text>, neste ato representado(a) por sua administradora {nomeInst}{data.admin_responsavel_creci ? `, na pessoa do corretor responsável (CRECI ${data.admin_responsavel_creci})` : ''}</Text>
          )}
          , e de outro lado{' '}
          <Text style={styles.parteNome}>{locatarioQuali}</Text>, doravante designado(a){' '}
          <Text style={styles.parteNome}>LOCATÁRIO(A)</Text>
          {data.fiador_nome && (
            <Text>, e ainda <Text style={styles.parteNome}>{data.fiador_nome}{data.fiador_cpf ? `, CPF nº ${data.fiador_cpf}` : ''}</Text>, na qualidade de FIADOR(A)</Text>
          )}
          , têm entre si justo e acordado o presente{' '}
          <Text style={styles.parteNome}>{ordinal} TERMO ADITIVO</Text> ao Contrato de Locação nº{' '}
          {data.contrato_codigo}
          {data.contrato_data_assinatura ? `, firmado em ${data.contrato_data_assinatura}` : ''}, que tem
          por objeto o imóvel situado à {data.imovel_endereco || '[ENDEREÇO DO IMÓVEL]'}, mediante as
          cláusulas e condições a seguir, com fundamento na Lei nº 8.245/1991 (Lei do Inquilinato) e no
          Código Civil Brasileiro.
        </Text>

        {/* Cláusula 1 — Objeto do aditivo */}
        <View style={styles.clausulaWrap}>
          <Text style={styles.clausulaTitulo}>CLÁUSULA 1ª — DO OBJETO DESTE ADITIVO</Text>
          {objetoParagrafos.map((par, i) => (
            <Text key={i} style={styles.clausulaCorpo}>{par}</Text>
          ))}
        </View>

        {/* Cláusula 2 — Ratificação */}
        <View style={styles.clausulaWrap}>
          <Text style={styles.clausulaTitulo}>CLÁUSULA 2ª — DA RATIFICAÇÃO</Text>
          <Text style={styles.clausulaCorpo}>
            2.1. Permanecem em pleno vigor, ratificadas e inalteradas, todas as demais cláusulas,
            condições e obrigações do contrato originário e de eventuais aditivos anteriores que não
            tenham sido expressamente modificadas por este instrumento.
          </Text>
          <Text style={styles.clausulaCorpo}>
            2.2. Este Termo Aditivo passa a integrar o contrato de locação para todos os fins de direito,
            como se nele estivesse transcrito.
          </Text>
        </View>

        {/* Cláusula 3 — Foro */}
        <View style={styles.clausulaWrap}>
          <Text style={styles.clausulaTitulo}>CLÁUSULA 3ª — DO FORO</Text>
          <Text style={styles.clausulaCorpo}>
            3.1. As partes elegem o foro da Comarca de {cidadeUf.replace('-', '/')} para dirimir quaisquer
            controvérsias oriundas deste Termo Aditivo, com renúncia a qualquer outro, por mais
            privilegiado que seja.
          </Text>
          <Text style={styles.clausulaCorpo}>
            E, por estarem assim justas e acordadas, as partes assinam o presente em 2 (duas) vias de igual
            teor e forma, na presença das testemunhas abaixo.
          </Text>
        </View>

        {/* Data */}
        <Text style={styles.data}>{cidadeUf}, {dataExtenso}.</Text>

        {/* Assinaturas */}
        <View wrap={false}>
          {/* Locador / administradora */}
          <View style={styles.assinaturaBloco}>
            <View style={styles.assinaturaLinha} />
            {data.tem_administracao && data.admin_responsavel_nome ? (
              <>
                <Text style={styles.assinaturaPapel}>Locador(a) — p.p. administradora</Text>
                <Text style={styles.assinaturaNome}>{data.admin_responsavel_nome}</Text>
                <Text style={styles.assinaturaCpf}>
                  {nomeInst}{data.admin_responsavel_creci ? ` · CRECI ${data.admin_responsavel_creci}` : ''} — representando {data.locador_nome}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.assinaturaPapel}>Locador(a)</Text>
                <Text style={styles.assinaturaNome}>{data.locador_nome}</Text>
                {data.locador_cpf && <Text style={styles.assinaturaCpf}>CPF/CNPJ {data.locador_cpf}</Text>}
              </>
            )}
          </View>

          {/* Locatário */}
          <View style={styles.assinaturaBloco}>
            <View style={styles.assinaturaLinha} />
            <Text style={styles.assinaturaPapel}>Locatário(a)</Text>
            <Text style={styles.assinaturaNome}>{data.locatario_nome}</Text>
            {data.locatario_cpf && <Text style={styles.assinaturaCpf}>CPF {data.locatario_cpf}</Text>}
          </View>

          {/* Cônjuge solidário */}
          {data.conjuge_nome && data.conjuge_papel !== 'nao_participa' && (
            <View style={styles.assinaturaBloco}>
              <View style={styles.assinaturaLinha} />
              <Text style={styles.assinaturaPapel}>
                {data.conjuge_papel === 'solidario' ? 'Locatário(a) solidário(a) / cônjuge' : 'Cônjuge anuente'}
              </Text>
              <Text style={styles.assinaturaNome}>{data.conjuge_nome}</Text>
              {data.conjuge_cpf && <Text style={styles.assinaturaCpf}>CPF {data.conjuge_cpf}</Text>}
            </View>
          )}

          {/* Fiador */}
          {data.fiador_nome && (
            <View style={styles.assinaturaBloco}>
              <View style={styles.assinaturaLinha} />
              <Text style={styles.assinaturaPapel}>Fiador(a)</Text>
              <Text style={styles.assinaturaNome}>{data.fiador_nome}</Text>
              {data.fiador_cpf && <Text style={styles.assinaturaCpf}>CPF {data.fiador_cpf}</Text>}
            </View>
          )}

          {/* Testemunhas */}
          <Text style={styles.testemunhaTit}>Testemunhas</Text>
          {(data.testemunhas.length > 0 ? data.testemunhas : [null, null]).map((t, i) => (
            <View key={i} style={styles.assinaturaBloco}>
              <View style={styles.assinaturaLinha} />
              {t ? (
                <>
                  <Text style={styles.assinaturaNome}>{t.nome}</Text>
                  <Text style={styles.assinaturaCpf}>
                    {[t.cpf ? `CPF ${t.cpf}` : null, t.rg ? `RG ${t.rg}` : null].filter(Boolean).join(' · ') || 'Testemunha'}
                  </Text>
                </>
              ) : (
                <Text style={styles.assinaturaCpf}>Nome / CPF</Text>
              )}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Termo aditivo ao CONTRATO DE ADMINISTRAÇÃO (administradora ↔ proprietária).
// ─────────────────────────────────────────────────────────────────────────────

const TIPO_LABEL_ADM: Record<string, string> = {
  taxa: 'Alteração da taxa de administração',
  prorrogacao: 'Prorrogação de prazo',
  exclusividade: 'Alteração de exclusividade',
  repasse: 'Alteração de repasse',
  clausula: 'Inclusão / alteração de cláusula',
  outro: 'Aditamento',
}

export interface AditivoAdmPDFData {
  anunciante_nome: string
  anunciante_razao_social: string | null
  anunciante_cnpj: string | null
  anunciante_creci: string | null
  anunciante_creci_juridico: string | null
  anunciante_logo_url: string | null
  anunciante_endereco: string | null
  anunciante_cidade_uf: string | null

  contrato_codigo: string
  contrato_data_assinatura: string | null
  imovel_endereco: string

  proprietario_nome: string
  proprietario_cpf: string | null
  admin_responsavel_nome: string | null
  admin_responsavel_creci: string | null

  testemunhas: Array<{ nome: string; cpf: string | null; rg: string | null }>

  numero: number
  data_aditivo: string
  tipo: string
  titulo: string | null
  objeto: string
}

export function AditivoAdmDocument({ data }: { data: AditivoAdmPDFData }) {
  const nomeInst = data.anunciante_razao_social ?? data.anunciante_nome
  const cidadeUf = data.anunciante_cidade_uf ?? 'Cuiabá-MT'
  const dataExtenso = fmtDataExtenso(data.data_aditivo)
  const ordinal = `${data.numero}º`

  const objetoParagrafos = numerarObjeto(1, data.objeto)
  const tipoLabel = data.titulo?.trim() || TIPO_LABEL_ADM[data.tipo] || TIPO_LABEL_ADM.outro

  const adminQuali = `${nomeInst}${data.anunciante_cnpj ? `, inscrita no CNPJ sob nº ${data.anunciante_cnpj}` : ''}${data.anunciante_creci_juridico ? `, CRECI-J ${data.anunciante_creci_juridico}` : ''}`
  const propQuali = `${data.proprietario_nome}${data.proprietario_cpf ? `, inscrito(a) no CPF/CNPJ sob nº ${data.proprietario_cpf}` : ''}`

  return (
    <Document
      title={`Termo Aditivo ${ordinal} — Contrato de Administração ${data.contrato_codigo}`}
      author={nomeInst}
      subject={`${ordinal} Termo Aditivo ao contrato de administração ${data.contrato_codigo}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho institucional */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {data.anunciante_logo_url && (
              <Image src={data.anunciante_logo_url} style={{ width: 48, height: 48, objectFit: 'contain' }} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontFamily: FAMILIA, fontWeight: 'bold', color: COR.textoForte }}>
                {nomeInst}
                {data.anunciante_creci_juridico ? ` — CRECI-J ${data.anunciante_creci_juridico}` : ''}
              </Text>
              {data.anunciante_creci && (
                <Text style={{ fontSize: 8, color: COR.cinza }}>
                  {data.anunciante_nome} — Corretor de Imóveis | CRECI {data.anunciante_creci}
                </Text>
              )}
              {data.anunciante_endereco && (
                <Text style={{ fontSize: 8, color: COR.cinza }}>{data.anunciante_endereco}</Text>
              )}
              {data.anunciante_cnpj && (
                <Text style={{ fontSize: 8, color: COR.cinza }}>CNPJ {data.anunciante_cnpj}</Text>
              )}
            </View>
          </View>
          <View style={styles.cabecalhoLinha} />
        </View>

        <Text style={styles.selo}>INSTRUMENTO PARTICULAR</Text>
        <Text style={styles.titulo}>{ordinal} Termo Aditivo ao Contrato de Administração de Imóvel</Text>
        <Text style={styles.subtitulo}>Contrato originário nº {data.contrato_codigo}</Text>
        <Text style={styles.subtitulo}>Objeto: {tipoLabel}</Text>

        {/* Preâmbulo */}
        <Text style={styles.preambulo}>
          Pelo presente instrumento particular, de um lado{' '}
          <Text style={styles.parteNome}>{adminQuali}</Text>, doravante designada{' '}
          <Text style={styles.parteNome}>ADMINISTRADORA</Text>
          {data.admin_responsavel_nome && (
            <Text>, neste ato representada por seu corretor responsável {data.admin_responsavel_nome}{data.admin_responsavel_creci ? ` (CRECI ${data.admin_responsavel_creci})` : ''}</Text>
          )}
          , e de outro lado{' '}
          <Text style={styles.parteNome}>{propQuali}</Text>, doravante designado(a){' '}
          <Text style={styles.parteNome}>PROPRIETÁRIA</Text>, têm entre si justo e acordado o presente{' '}
          <Text style={styles.parteNome}>{ordinal} TERMO ADITIVO</Text> ao Contrato de Administração de Imóvel nº{' '}
          {data.contrato_codigo}
          {data.contrato_data_assinatura ? `, firmado em ${data.contrato_data_assinatura}` : ''}, relativo ao
          imóvel situado à {data.imovel_endereco || '[ENDEREÇO DO IMÓVEL]'}, mediante as cláusulas e condições a
          seguir, com fundamento na Lei nº 8.245/1991 e no Código Civil Brasileiro.
        </Text>

        <View style={styles.clausulaWrap}>
          <Text style={styles.clausulaTitulo}>CLÁUSULA 1ª — DO OBJETO DESTE ADITIVO</Text>
          {objetoParagrafos.map((par, i) => (
            <Text key={i} style={styles.clausulaCorpo}>{par}</Text>
          ))}
        </View>

        <View style={styles.clausulaWrap}>
          <Text style={styles.clausulaTitulo}>CLÁUSULA 2ª — DA RATIFICAÇÃO</Text>
          <Text style={styles.clausulaCorpo}>
            2.1. Permanecem em pleno vigor, ratificadas e inalteradas, todas as demais cláusulas, condições e
            obrigações do contrato de administração originário e de eventuais aditivos anteriores que não tenham
            sido expressamente modificadas por este instrumento.
          </Text>
          <Text style={styles.clausulaCorpo}>
            2.2. Este Termo Aditivo passa a integrar o contrato de administração para todos os fins de direito.
          </Text>
        </View>

        <View style={styles.clausulaWrap}>
          <Text style={styles.clausulaTitulo}>CLÁUSULA 3ª — DO FORO</Text>
          <Text style={styles.clausulaCorpo}>
            3.1. As partes elegem o foro da Comarca de {cidadeUf.replace('-', '/')} para dirimir quaisquer
            controvérsias oriundas deste Termo Aditivo, com renúncia a qualquer outro.
          </Text>
          <Text style={styles.clausulaCorpo}>
            E, por estarem assim justas e acordadas, as partes assinam o presente em 2 (duas) vias de igual teor
            e forma, na presença das testemunhas abaixo.
          </Text>
        </View>

        <Text style={styles.data}>{cidadeUf}, {dataExtenso}.</Text>

        <View wrap={false}>
          {/* Administradora */}
          <View style={styles.assinaturaBloco}>
            <View style={styles.assinaturaLinha} />
            <Text style={styles.assinaturaPapel}>Administradora</Text>
            <Text style={styles.assinaturaNome}>{data.admin_responsavel_nome || nomeInst}</Text>
            <Text style={styles.assinaturaCpf}>
              {nomeInst}{data.admin_responsavel_creci ? ` · CRECI ${data.admin_responsavel_creci}` : ''}
            </Text>
          </View>

          {/* Proprietária */}
          <View style={styles.assinaturaBloco}>
            <View style={styles.assinaturaLinha} />
            <Text style={styles.assinaturaPapel}>Proprietária / Contratante</Text>
            <Text style={styles.assinaturaNome}>{data.proprietario_nome}</Text>
            {data.proprietario_cpf && <Text style={styles.assinaturaCpf}>CPF/CNPJ {data.proprietario_cpf}</Text>}
          </View>

          <Text style={styles.testemunhaTit}>Testemunhas</Text>
          {(data.testemunhas.length > 0 ? data.testemunhas : [null, null]).map((t, i) => (
            <View key={i} style={styles.assinaturaBloco}>
              <View style={styles.assinaturaLinha} />
              {t ? (
                <>
                  <Text style={styles.assinaturaNome}>{t.nome}</Text>
                  <Text style={styles.assinaturaCpf}>
                    {[t.cpf ? `CPF ${t.cpf}` : null, t.rg ? `RG ${t.rg}` : null].filter(Boolean).join(' · ') || 'Testemunha'}
                  </Text>
                </>
              ) : (
                <Text style={styles.assinaturaCpf}>Nome / CPF</Text>
              )}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
