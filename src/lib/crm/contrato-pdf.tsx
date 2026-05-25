/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

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

  // Cláusulas montadas
  clausulas: ContratoPDFClausula[]
}

const cinza = '#6b7280'

const styles = StyleSheet.create({
  page: {
    padding: 56,
    paddingTop: 110,    // cabeçalho fixo ocupa ~85px (logo 45 + linhas + border); 110 dá folga
    paddingBottom: 65,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1f2937',
    lineHeight: 1.5,
  },
  // Cabeçalho fixo (todas as páginas)
  cabecalhoInst: {
    position: 'absolute',
    top: 28,
    left: 56,
    right: 56,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
  },
  cabecalhoLogo: { width: 65, height: 45, objectFit: 'contain' },
  cabecalhoDados: { textAlign: 'right', fontSize: 7.5, color: '#374151', lineHeight: 1.35 },
  cabecalhoRazao: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 1 },

  // Footer (paginação)
  rodape: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    right: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#9ca3af',
    borderTopWidth: 0.5,
    borderTopColor: '#e5e7eb',
    borderTopStyle: 'solid',
    paddingTop: 5,
  },

  tituloPrincipal: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  clausulaWrap: {
    marginBottom: 12,
  },
  clausulaTitulo: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  clausulaCorpo: {
    fontSize: 10,
    color: '#1f2937',
    textAlign: 'justify',
    lineHeight: 1.55,
  },

  // Folha de assinatura
  assinaturaPagina: {
    marginTop: 30,
  },
  assinaturaFecho: {
    fontSize: 10,
    color: '#1f2937',
    textAlign: 'justify',
    marginBottom: 12,
    lineHeight: 1.6,
  },
  assinaturaData: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 30,
  },
  assinaturaBloco: {
    marginBottom: 30,
    paddingBottom: 22,
    borderBottomWidth: 0.7,
    borderBottomColor: '#9ca3af',
    borderBottomStyle: 'solid',
  },
  assinaturaPapel: {
    fontSize: 7.5,
    color: cinza,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  assinaturaNome: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  assinaturaCpf: {
    fontSize: 9,
    color: cinza,
  },
  testemunha: {
    fontSize: 9,
    color: cinza,
    marginTop: 26,
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
          <Text>Contrato {data.codigo}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>

        {/* Título */}
        <Text style={styles.tituloPrincipal}>
          Contrato de Locação Residencial{'\n'}
          com Administração Imobiliária
        </Text>

        {/* Cláusulas numeradas */}
        {data.clausulas.map((c, idx) => (
          <View key={idx} style={styles.clausulaWrap} wrap={true}>
            <Text style={styles.clausulaTitulo}>
              {idx + 1}. {c.titulo}
            </Text>
            <Text style={styles.clausulaCorpo}>{c.corpo}</Text>
          </View>
        ))}

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

          <View style={styles.assinaturaBloco}>
            <Text style={styles.assinaturaPapel}>Locatário</Text>
            <Text style={styles.assinaturaNome}>{data.locatario_nome}</Text>
            {data.locatario_cpf && <Text style={styles.assinaturaCpf}>CPF {data.locatario_cpf}</Text>}
          </View>

          {data.conjuge_nome && (
            <View style={styles.assinaturaBloco}>
              <Text style={styles.assinaturaPapel}>Cônjuge do locatário</Text>
              <Text style={styles.assinaturaNome}>{data.conjuge_nome}</Text>
              {data.conjuge_cpf && <Text style={styles.assinaturaCpf}>CPF {data.conjuge_cpf}</Text>}
            </View>
          )}

          {/* Moradores adicionais (co-locatários, moradores, responsáveis financeiros) */}
          {data.moradores_adicionais.map((m, idx) => (
            <View key={idx} style={styles.assinaturaBloco}>
              <Text style={styles.assinaturaPapel}>{m.papel}</Text>
              <Text style={styles.assinaturaNome}>{m.nome}</Text>
              {m.cpf && <Text style={styles.assinaturaCpf}>CPF {m.cpf}</Text>}
            </View>
          ))}

          {data.fiador_nome && (
            <View style={styles.assinaturaBloco}>
              <Text style={styles.assinaturaPapel}>Fiador</Text>
              <Text style={styles.assinaturaNome}>{data.fiador_nome}</Text>
              {data.fiador_cpf && <Text style={styles.assinaturaCpf}>CPF {data.fiador_cpf}</Text>}
            </View>
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
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
