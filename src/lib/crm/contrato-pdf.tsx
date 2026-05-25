/* eslint-disable jsx-a11y/alt-text */
import fs from 'fs'
import path from 'path'
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'

// ── Carregamento de Poppins ─────────────────────────────────────────
// Lê os TTFs do filesystem e converte em data URL base64. O typing do
// react-pdf aceita Buffer no `src`, mas internamente chama .substring()
// no valor — então só funciona com string. Data URL resolve isso e
// também garante que a fonte está disponível antes do render começar
// (sem dependência de download de URL externa).
function tryReadFontAsDataUrl(filename: string): string | null {
  try {
    const p = path.join(process.cwd(), 'public', 'fonts', filename)
    if (!fs.existsSync(p)) return null
    const buf = fs.readFileSync(p)
    return `data:font/ttf;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

// DEBUG: Poppins temporariamente desativada — o erro "unsupported number"
// no PDFDocument.translate aponta pra cálculo de coordenada NaN, que pode
// vir das métricas da fonte custom. Voltamos a Helvetica pra confirmar
// se é isso. Se gerar com Helvetica, o problema é a Poppins.
const FORCAR_HELVETICA = true
const fontRegular = FORCAR_HELVETICA ? null : tryReadFontAsDataUrl('Poppins-Regular.ttf')
const fontMedium = FORCAR_HELVETICA ? null : tryReadFontAsDataUrl('Poppins-Medium.ttf')
const fontBold = FORCAR_HELVETICA ? null : tryReadFontAsDataUrl('Poppins-Bold.ttf')

const POPPINS_LOADED = !!(fontRegular && fontBold)
const FAMILIA = POPPINS_LOADED ? 'Poppins' : 'Helvetica'

if (POPPINS_LOADED) {
  Font.register({
    family: 'Poppins',
    fonts: [
      { src: fontRegular!, fontWeight: 'normal' },
      ...(fontMedium ? [{ src: fontMedium, fontWeight: 'medium' as const }] : []),
      { src: fontBold!, fontWeight: 'bold' },
    ],
  })
}

// Desativa hifenização (pt-BR flui melhor sem)
Font.registerHyphenationCallback(word => [word])

export interface ContratoPDFClausula {
  numero: number
  titulo: string
  corpo: string  // já com placeholders substituídos
}

export interface ContratoPDFData {
  // Identificação
  codigo: string
  data_assinatura: string  // YYYY-MM-DD

  // Emitente (administradora)
  anunciante_nome: string
  anunciante_razao_social: string | null
  anunciante_cnpj: string | null
  anunciante_creci: string | null
  anunciante_creci_juridico: string | null
  anunciante_logo_url: string | null
  anunciante_endereco: string | null
  anunciante_cidade_uf: string | null

  // Partes (pra folha de assinatura)
  locador_nome: string
  locador_cpf: string | null
  /** True quando há administração imobiliária — quem assina é o admin/corretor representando o locador. */
  tem_administracao: boolean
  admin_responsavel_nome: string | null   // nome do corretor (ex: João Victor Vieira)
  admin_responsavel_creci: string | null  // CRECI do corretor

  locatario_nome: string
  locatario_cpf: string | null
  conjuge_nome: string | null
  conjuge_cpf: string | null

  // Moradores adicionais (co-locatários solidários, moradores, responsáveis financeiros)
  moradores_adicionais: Array<{
    nome: string
    cpf: string | null
    papel: string  // "Co-locatário solidário", "Morador", "Responsável financeiro"
  }>

  fiador_nome: string | null
  fiador_cpf: string | null

  // Testemunhas pré-cadastradas; se vazias, vira linha em branco
  testemunhas: Array<{
    nome: string
    cpf: string | null
    rg: string | null
  }>

  // Cláusulas da seguradora (texto livre) — só pra seguro fiança
  clausulas_seguradora_texto: string | null

  // Cláusulas montadas
  clausulas: ContratoPDFClausula[]
}

const COR = {
  texto: '#1f2937',
  textoForte: '#111827',
  cinza: '#6b7280',
  cinzaClaro: '#9ca3af',
  borda: '#e5e7eb',
  bordaForte: '#d1d5db',
  destaque: '#581c87',   // violeta escuro pra títulos
  acento: '#7c3aed',     // violeta brand
  fundoSuave: '#faf5ff', // background pra boxes
}

const styles = StyleSheet.create({
  page: {
    padding: 56,
    paddingTop: 110,    // cabeçalho fixo ocupa ~85px (logo 45 + linhas + border); 110 dá folga
    paddingBottom: 65,
    fontSize: 10,
    fontFamily: FAMILIA,
    color: COR.texto,
    lineHeight: 1.5,
  },
  // ── Cabeçalho institucional fixo (todas as páginas) ──
  // A4 = 595.28pt de largura. Margem 56 de cada lado → width 483.28.
  cabecalhoInst: {
    position: 'absolute',
    top: 28,
    left: 56,
    width: 483,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  cabecalhoLinha: {
    position: 'absolute',
    top: 85,
    left: 56,
    width: 483,
    height: 1.5,
    backgroundColor: COR.acento,
  },
  cabecalhoLogo: { width: 70, height: 50, objectFit: 'contain' },
  cabecalhoDados: { textAlign: 'right', fontSize: 7.5, color: COR.cinza, lineHeight: 1.4 },
  cabecalhoRazao: {
    fontSize: 9.5,
    fontFamily: FAMILIA,
    fontWeight: 'bold',
    color: COR.textoForte,
    marginBottom: 2,
  },

  // ── Footer (paginação) ──
  // Sem border direto: o react-pdf pode quebrar com border em position:absolute.
  // A linha separadora vai como View independente.
  rodape: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    width: 483,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: COR.cinzaClaro,
    paddingTop: 6,
  },
  rodapeLinha: {
    position: 'absolute',
    bottom: 44,
    left: 56,
    width: 483,
    height: 0.5,
    backgroundColor: COR.borda,
  },
  rodapeCodigo: { fontFamily: FAMILIA, fontWeight: 'normal' },

  // ── Capa: título e subtítulo ──
  capa: {
    marginTop: 30,
    marginBottom: 24,
    paddingBottom: 16,
  },
  capaSeparador: {
    height: 1,
    backgroundColor: COR.borda,
    marginBottom: 24,
  },
  capaSelo: {
    fontSize: 8,
    fontFamily: FAMILIA,
    fontWeight: 'normal',
    color: COR.acento,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
    textAlign: 'center',
  },
  capaTitulo: {
    fontSize: 18,
    fontFamily: FAMILIA,
    fontWeight: 'bold',
    color: COR.textoForte,
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 1.25,
    marginBottom: 6,
  },
  capaSubtitulo: {
    fontSize: 9.5,
    color: COR.cinza,
    textAlign: 'center',
    marginTop: 4,
    fontFamily: FAMILIA,
  },
  capaCodigo: {
    fontSize: 8,
    fontFamily: FAMILIA,
    fontWeight: 'normal',
    color: COR.cinzaClaro,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.6,
  },

  // ── Cláusulas ──
  clausulaWrap: {
    marginBottom: 14,
  },
  clausulaNumero: {
    color: COR.acento,
  },
  clausulaTitulo: {
    fontSize: 11,
    fontFamily: FAMILIA,
    fontWeight: 'bold',
    color: COR.textoForte,
    marginBottom: 6,
  },
  clausulaCorpo: {
    fontSize: 10,
    color: COR.texto,
    textAlign: 'justify',
    lineHeight: 1.6,
    fontFamily: FAMILIA,
  },

  // ── Seção (cláusulas seguradora etc.) ──
  secaoTituloCentral: {
    fontSize: 14,
    fontFamily: FAMILIA,
    fontWeight: 'bold',
    color: COR.textoForte,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Folha de assinatura ──
  assinaturaPagina: {
    marginTop: 28,
  },
  assinaturaFecho: {
    fontSize: 10,
    color: COR.texto,
    textAlign: 'justify',
    marginBottom: 14,
    lineHeight: 1.65,
    fontFamily: FAMILIA,
  },
  assinaturaData: {
    fontSize: 10.5,
    fontFamily: FAMILIA,
    fontWeight: 'bold',
    color: COR.textoForte,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 28,
  },
  assinaturaBloco: {
    marginBottom: 14,
    paddingBottom: 8,
  },
  assinaturaLinha: {
    height: 0.7,
    backgroundColor: COR.bordaForte,
    marginBottom: 14,
  },
  assinaturaPapel: {
    fontSize: 7.5,
    fontFamily: FAMILIA,
    fontWeight: 'normal',
    color: COR.acento,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  assinaturaNome: {
    fontSize: 10.5,
    fontFamily: FAMILIA,
    fontWeight: 'bold',
    color: COR.textoForte,
    marginBottom: 1,
  },
  assinaturaCpf: {
    fontSize: 9,
    color: COR.cinza,
    fontFamily: FAMILIA,
  },
  testemunha: {
    fontSize: 8.5,
    fontFamily: FAMILIA,
    fontWeight: 'normal',
    color: COR.acento,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 22,
    marginBottom: 4,
  },
})

function fmtDataExtenso(iso: string): string {
  const s = iso.slice(0, 10)
  const [y, m, d] = s.split('-').map(Number)
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  return `${d.toString().padStart(2, '0')} de ${meses[m - 1]} de ${y}`
}

export function ContratoDocument({ data }: { data: ContratoPDFData }) {
  const nomeInst = data.anunciante_razao_social ?? data.anunciante_nome
  const dataExtenso = fmtDataExtenso(data.data_assinatura)
  const cidadeUf = data.anunciante_cidade_uf ?? 'Cuiabá-MT'

  return (
    <Document
      title={`Contrato ${data.codigo}`}
      author={nomeInst}
      subject={`Contrato de Locação Residencial — ${data.locatario_nome}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Linha separadora do cabeçalho (View independente — sem border em absolute) */}
        <View style={styles.cabecalhoLinha} fixed />

        {/* Linha separadora do rodapé */}
        <View style={styles.rodapeLinha} fixed />

        {/* Cabeçalho fixo */}
        <View style={styles.cabecalhoInst} fixed>
          {data.anunciante_logo_url ? (
            <Image src={data.anunciante_logo_url} style={styles.cabecalhoLogo} />
          ) : (
            <View style={styles.cabecalhoLogo} />
          )}
          <View style={styles.cabecalhoDados}>
            <Text style={styles.cabecalhoRazao}>
              {nomeInst}
              {data.anunciante_creci_juridico ? ` — CRECI-J ${data.anunciante_creci_juridico}` : ''}
            </Text>
            {data.anunciante_creci && (
              <Text>{data.anunciante_nome} — CRECI {data.anunciante_creci}</Text>
            )}
            {data.anunciante_endereco && <Text>{data.anunciante_endereco}</Text>}
            {data.anunciante_cnpj && <Text>CNPJ {data.anunciante_cnpj}</Text>}
          </View>
        </View>

        {/* Footer fixo com paginação */}
        <View style={styles.rodape} fixed>
          <Text style={styles.rodapeCodigo}>Contrato {data.codigo}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>

        {/* Capa / Título */}
        <View style={styles.capa}>
          <Text style={styles.capaSelo}>Instrumento particular</Text>
          <Text style={styles.capaTitulo}>
            Contrato de Locação Residencial{'\n'}com Administração Imobiliária
          </Text>
          <Text style={styles.capaSubtitulo}>
            {data.locatario_nome}
          </Text>
          <Text style={styles.capaCodigo}>
            Nº {data.codigo}
          </Text>
        </View>
        <View style={styles.capaSeparador} />

        {/* Cláusulas numeradas */}
        {data.clausulas.map((c, idx) => (
          <View key={idx} style={styles.clausulaWrap} wrap={true}>
            <Text style={styles.clausulaTitulo}>
              {idx + 1}. {c.titulo}
            </Text>
            <Text style={styles.clausulaCorpo}>{c.corpo}</Text>
          </View>
        ))}

        {/* Cláusulas da seguradora (quando garantia é seguro fiança e tem texto) */}
        {data.clausulas_seguradora_texto && (
          <View break>
            <Text style={styles.secaoTituloCentral}>Cláusulas da Seguradora</Text>
            <Text style={styles.clausulaCorpo}>{data.clausulas_seguradora_texto}</Text>
          </View>
        )}

        {/* Folha de assinatura */}
        <View style={styles.assinaturaPagina} break>
          <Text style={styles.assinaturaFecho}>
            E, por estarem justos e contratados, plenamente cientes da seriedade das obrigações
            assumidas, assinam o presente instrumento digitalmente, em vias de igual teor,
            juntamente com 02 (duas) testemunhas.
          </Text>

          <Text style={styles.assinaturaData}>
            {cidadeUf}, {dataExtenso}.
          </Text>

          {/* Locador / Administradora — quando há administração, quem assina é o corretor */}
          {data.tem_administracao ? (
            <View style={styles.assinaturaBloco}>
              <Text style={styles.assinaturaPapel}>Locador / Administradora</Text>
              <Text style={styles.assinaturaNome}>
                {data.admin_responsavel_nome ?? data.locador_nome}
              </Text>
              {data.admin_responsavel_creci && (
                <Text style={styles.assinaturaCpf}>CRECI {data.admin_responsavel_creci}</Text>
              )}
              <Text style={styles.assinaturaCpf}>
                Representando: {data.locador_nome}
                {data.locador_cpf ? ` — CPF ${data.locador_cpf}` : ''}
              </Text>
            </View>
          ) : (
            <View style={styles.assinaturaBloco}>
              <Text style={styles.assinaturaPapel}>Locador</Text>
              <Text style={styles.assinaturaNome}>{data.locador_nome}</Text>
              {data.locador_cpf && <Text style={styles.assinaturaCpf}>CPF {data.locador_cpf}</Text>}
            </View>
          )}
          <View style={styles.assinaturaLinha} />

          <View style={styles.assinaturaBloco}>
            <Text style={styles.assinaturaPapel}>Locatário</Text>
            <Text style={styles.assinaturaNome}>{data.locatario_nome}</Text>
            {data.locatario_cpf && <Text style={styles.assinaturaCpf}>CPF {data.locatario_cpf}</Text>}
          </View>
          <View style={styles.assinaturaLinha} />

          {data.conjuge_nome && (
            <>
              <View style={styles.assinaturaBloco}>
                <Text style={styles.assinaturaPapel}>Cônjuge do locatário</Text>
                <Text style={styles.assinaturaNome}>{data.conjuge_nome}</Text>
                {data.conjuge_cpf && <Text style={styles.assinaturaCpf}>CPF {data.conjuge_cpf}</Text>}
              </View>
              <View style={styles.assinaturaLinha} />
            </>
          )}

          {/* Moradores adicionais (co-locatários, moradores, responsáveis financeiros) */}
          {data.moradores_adicionais.map((m, idx) => (
            <View key={idx}>
              <View style={styles.assinaturaBloco}>
                <Text style={styles.assinaturaPapel}>{m.papel}</Text>
                <Text style={styles.assinaturaNome}>{m.nome}</Text>
                {m.cpf && <Text style={styles.assinaturaCpf}>CPF {m.cpf}</Text>}
              </View>
              <View style={styles.assinaturaLinha} />
            </View>
          ))}

          {data.fiador_nome && (
            <>
              <View style={styles.assinaturaBloco}>
                <Text style={styles.assinaturaPapel}>Fiador</Text>
                <Text style={styles.assinaturaNome}>{data.fiador_nome}</Text>
                {data.fiador_cpf && <Text style={styles.assinaturaCpf}>CPF {data.fiador_cpf}</Text>}
              </View>
              <View style={styles.assinaturaLinha} />
            </>
          )}

          {/* Testemunhas */}
          {(data.testemunhas.length > 0 ? data.testemunhas : [null, null]).map((t, idx) => (
            <View key={idx}>
              <Text style={styles.testemunha}>Testemunha {idx + 1}:</Text>
              <View style={styles.assinaturaBloco}>
                {t ? (
                  <>
                    <Text style={styles.assinaturaNome}>{t.nome}</Text>
                    {t.cpf && <Text style={styles.assinaturaCpf}>CPF {t.cpf}</Text>}
                    {t.rg && <Text style={styles.assinaturaCpf}>RG {t.rg}</Text>}
                  </>
                ) : (
                  <>
                    <Text style={styles.assinaturaCpf}>Nome: _____________________________________</Text>
                    <Text style={styles.assinaturaCpf}>CPF: ______________________________________</Text>
                  </>
                )}
              </View>
              <View style={styles.assinaturaLinha} />
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
