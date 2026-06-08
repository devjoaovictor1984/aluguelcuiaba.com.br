/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

export interface TermoEntregaPDFData {
  data_entrega: string | null
  qtd_chaves: number
  qtd_controles: number
  estado_entrega: string | null
  observacoes: string | null
  status: string

  // Locatário (quem devolve)
  assinatura_locatario_url: string | null
  selfie_locatario_url: string | null
  assinado_locatario_em: string | null
  assinado_locatario_ip: string | null
  observacoes_locatario: string | null

  // Locador/Administradora (quem recebe)
  assinatura_locador_url: string | null
  selfie_locador_url: string | null
  assinado_locador_em: string | null
  assinado_locador_ip: string | null

  // Emitente
  anunciante_nome: string
  anunciante_razao_social: string | null
  anunciante_cnpj: string | null
  anunciante_creci: string | null
  anunciante_creci_juridico: string | null
  anunciante_logo_url: string | null
  anunciante_endereco: string | null
  anunciante_cidade_uf: string | null

  contrato_codigo: string
  imovel_titulo: string | null
  imovel_endereco: string | null
  inquilino_nome: string
  inquilino_cpf: string | null
}

const roxo = '#7c3aed'
const cinza = '#6b7280'
const fundo = '#f9fafb'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica', color: '#1f2937', lineHeight: 1.4 },
  cabecalhoInst: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingBottom: 8, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', borderBottomStyle: 'solid',
  },
  cabecalhoLogo: { width: 70, height: 50, objectFit: 'contain' },
  cabecalhoDados: { textAlign: 'right', fontSize: 8, color: '#374151', lineHeight: 1.35 },
  cabecalhoRazao: { fontSize: 10, fontWeight: 'bold', color: '#111827', marginBottom: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingBottom: 12, marginBottom: 14, borderBottomWidth: 2, borderBottomColor: roxo, borderBottomStyle: 'solid',
  },
  titulo: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  subtitulo: { fontSize: 9, color: cinza, marginTop: 2 },
  badge: {
    backgroundColor: roxo, color: '#fff', fontSize: 8, fontWeight: 'bold',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  introBox: { backgroundColor: '#faf5ff', borderLeftWidth: 3, borderLeftColor: roxo, borderLeftStyle: 'solid', padding: 8, marginBottom: 10 },
  introTexto: { fontSize: 8.5, color: '#1f2937', textAlign: 'justify', lineHeight: 1.45 },
  secaoTitulo: { fontSize: 9, fontWeight: 'bold', color: '#111827', marginTop: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  secaoParagrafo: { fontSize: 8.5, color: '#374151', textAlign: 'justify', marginBottom: 3, lineHeight: 1.45 },
  infoBox: { backgroundColor: fundo, padding: 8, borderRadius: 4, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 7, color: cinza, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValor: { fontSize: 9, color: '#111827', marginTop: 1 },
  aceiteBox: { marginTop: 14, padding: 10, backgroundColor: fundo, borderRadius: 3 },
  aceiteTexto: { fontSize: 8.5, color: '#1f2937', textAlign: 'justify', fontStyle: 'italic', lineHeight: 1.45 },
  aceiteLocal: { fontSize: 8.5, color: '#111827', fontWeight: 'bold', textAlign: 'center', marginTop: 6 },
  assinaturasRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  assinaturaBox: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#d1d5db', borderStyle: 'solid', borderRadius: 4 },
  assinaturaTitulo: { fontSize: 8, fontWeight: 'bold', color: roxo, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  selfieImg: { width: 54, height: 54, borderRadius: 4, objectFit: 'cover', alignSelf: 'center', marginBottom: 4 },
  assinaturaImg: { width: 150, height: 50, objectFit: 'contain', alignSelf: 'center', marginVertical: 2 },
  assNome: { fontSize: 8, textAlign: 'center', color: '#111827', fontWeight: 'bold', marginTop: 4 },
  assMeta: { fontSize: 6.5, textAlign: 'center', color: cinza, marginTop: 1 },
  obsFinal: { fontSize: 8, color: cinza, backgroundColor: fundo, padding: 6, borderRadius: 3, marginTop: 6, fontStyle: 'italic' },
  rodape: {
    marginTop: 18, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb', borderTopStyle: 'solid',
    fontSize: 7, color: '#9ca3af', textAlign: 'center',
  },
})

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
function fmtDataHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

export function TermoEntregaDocument({ data }: { data: TermoEntregaPDFData }) {
  const nomeInst = data.anunciante_razao_social ?? data.anunciante_nome
  const dataExtenso = data.data_entrega
    ? new Date(data.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return (
    <Document title={`Termo de entrega de chaves - ${data.contrato_codigo}`} author={nomeInst}>
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho institucional */}
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
              <Text>{data.anunciante_nome} — Corretor de Imóveis | CRECI {data.anunciante_creci}</Text>
            )}
            {data.anunciante_endereco && <Text>{data.anunciante_endereco}</Text>}
            {data.anunciante_cnpj && <Text>CNPJ {data.anunciante_cnpj}</Text>}
          </View>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.titulo}>Termo de Entrega de Chaves</Text>
            <Text style={styles.subtitulo}>Contrato {data.contrato_codigo} · {data.imovel_titulo ?? '—'}</Text>
            <Text style={styles.subtitulo}>
              {data.inquilino_nome}{data.inquilino_cpf && ` · CPF ${data.inquilino_cpf}`}
            </Text>
          </View>
          <Text style={styles.badge}>{data.status === 'assinado' ? 'Assinado' : 'Pendente'}</Text>
        </View>

        {/* Identificação */}
        <View style={styles.introBox}>
          <Text style={styles.introTexto}>
            Pelo presente instrumento, fica registrada a{' '}
            <Text style={{ fontWeight: 'bold' }}>entrega e devolução das chaves</Text> do imóvel objeto do{' '}
            <Text style={{ fontWeight: 'bold' }}>Contrato de Locação {data.contrato_codigo}</Text>
            {data.imovel_endereco ? `, situado em ${data.imovel_endereco}` : ''}, pelo LOCATÁRIO{' '}
            <Text style={{ fontWeight: 'bold' }}>{data.inquilino_nome}</Text>
            {data.inquilino_cpf ? ` (CPF ${data.inquilino_cpf})` : ''} ao LOCADOR/ADMINISTRADORA{' '}
            <Text style={{ fontWeight: 'bold' }}>{nomeInst}</Text>, nos termos da Lei nº 8.245/1991.
          </Text>
        </View>

        {/* Dados da entrega */}
        <View style={styles.infoBox}>
          <View>
            <Text style={styles.infoLabel}>Data da entrega</Text>
            <Text style={styles.infoValor}>{fmtData(data.data_entrega)}</Text>
          </View>
          <View>
            <Text style={styles.infoLabel}>Chaves</Text>
            <Text style={styles.infoValor}>{data.qtd_chaves}</Text>
          </View>
          <View>
            <Text style={styles.infoLabel}>Controles</Text>
            <Text style={styles.infoValor}>{data.qtd_controles}</Text>
          </View>
          <View style={{ maxWidth: 200 }}>
            <Text style={styles.infoLabel}>Estado do imóvel</Text>
            <Text style={styles.infoValor}>{data.estado_entrega ?? '—'}</Text>
          </View>
        </View>

        {/* Cláusulas */}
        <Text style={styles.secaoTitulo}>1. Devolução das chaves e desocupação</Text>
        <Text style={styles.secaoParagrafo}>
          <Text style={{ fontWeight: 'bold' }}>1.1.</Text> O LOCATÁRIO devolve nesta data{' '}
          <Text style={{ fontWeight: 'bold' }}>{data.qtd_chaves} chave{data.qtd_chaves === 1 ? '' : 's'}</Text> e{' '}
          <Text style={{ fontWeight: 'bold' }}>{data.qtd_controles} controle{data.qtd_controles === 1 ? '' : 's'}</Text>
          , juntamente com tags, cartões e demais acessos eventualmente recebidos, declarando entregar o imóvel desocupado de pessoas e bens.
        </Text>
        <Text style={styles.secaoParagrafo}>
          <Text style={{ fontWeight: 'bold' }}>1.2.</Text> O LOCADOR/ADMINISTRADORA confirma o recebimento das chaves e acessos acima, cessando a partir desta data a posse do LOCATÁRIO sobre o imóvel.
        </Text>
        <Text style={styles.secaoParagrafo}>
          <Text style={{ fontWeight: 'bold' }}>1.3.</Text> A entrega das chaves não implica, por si só, quitação de eventuais débitos de aluguel, encargos, consumos ou indenização por danos apurados em vistoria, que permanecem exigíveis nos termos do contrato.
        </Text>

        <Text style={styles.secaoTitulo}>2. Assinatura eletrônica</Text>
        <Text style={styles.secaoParagrafo}>
          <Text style={{ fontWeight: 'bold' }}>2.1.</Text> As partes reconhecem a validade jurídica das assinaturas eletrônicas e das selfies registradas neste documento, nos termos da <Text style={{ fontWeight: 'bold' }}>MP nº 2.200-2/2001</Text> e da <Text style={{ fontWeight: 'bold' }}>Lei nº 14.063/2020</Text>, ficando registrados data, hora e endereço IP dos dispositivos utilizados, com tratamento de dados conforme a <Text style={{ fontWeight: 'bold' }}>LGPD (Lei nº 13.709/2018)</Text>.
        </Text>

        {data.observacoes && (
          <View style={{ marginTop: 6, padding: 6, backgroundColor: '#faf5ff', borderRadius: 3 }}>
            <Text style={{ fontSize: 7, color: roxo, fontWeight: 'bold', marginBottom: 2 }}>OBSERVAÇÕES</Text>
            <Text style={{ fontSize: 8, color: '#581c87' }}>{data.observacoes}</Text>
          </View>
        )}

        {/* Aceite */}
        <View style={styles.aceiteBox} wrap={false}>
          <Text style={styles.aceiteTexto}>
            E, por estarem de pleno acordo com a entrega e o recebimento das chaves nas condições aqui descritas, as partes assinam o presente Termo de Entrega de Chaves, que passa a integrar o Contrato de Locação como anexo, para todos os fins de direito.
          </Text>
          {dataExtenso && (
            <Text style={styles.aceiteLocal}>{data.anunciante_cidade_uf ?? 'Cuiabá-MT'}, {dataExtenso}.</Text>
          )}
        </View>

        {/* Assinaturas lado a lado */}
        <View style={styles.assinaturasRow} wrap={false}>
          {/* Locatário */}
          <View style={styles.assinaturaBox}>
            <Text style={styles.assinaturaTitulo}>Locatário (entrega)</Text>
            {data.selfie_locatario_url && <Image src={data.selfie_locatario_url} style={styles.selfieImg} />}
            {data.assinatura_locatario_url ? (
              <Image src={data.assinatura_locatario_url} style={styles.assinaturaImg} />
            ) : (
              <Text style={{ fontSize: 8, color: cinza, textAlign: 'center', paddingVertical: 14 }}>(sem assinatura)</Text>
            )}
            <Text style={styles.assNome}>{data.inquilino_nome}</Text>
            <Text style={styles.assMeta}>
              {fmtDataHora(data.assinado_locatario_em)}{data.assinado_locatario_ip ? ` · IP ${data.assinado_locatario_ip}` : ''}
            </Text>
            {data.observacoes_locatario && (
              <View style={styles.obsFinal}>
                <Text style={{ fontSize: 6.5, color: cinza, fontWeight: 'bold' }}>Observações do locatário:</Text>
                <Text style={{ fontSize: 7 }}>{data.observacoes_locatario}</Text>
              </View>
            )}
          </View>

          {/* Locador/Administradora */}
          <View style={styles.assinaturaBox}>
            <Text style={styles.assinaturaTitulo}>Locador / Administradora (recebimento)</Text>
            {data.selfie_locador_url && <Image src={data.selfie_locador_url} style={styles.selfieImg} />}
            {data.assinatura_locador_url ? (
              <Image src={data.assinatura_locador_url} style={styles.assinaturaImg} />
            ) : (
              <Text style={{ fontSize: 8, color: cinza, textAlign: 'center', paddingVertical: 14 }}>(sem assinatura)</Text>
            )}
            <Text style={styles.assNome}>{nomeInst}</Text>
            {data.anunciante_creci_juridico && (
              <Text style={styles.assMeta}>CRECI-J {data.anunciante_creci_juridico}</Text>
            )}
            {data.anunciante_razao_social ? (
              <Text style={styles.assMeta}>
                Corretor(a) responsável: {data.anunciante_nome}
                {data.anunciante_creci ? ` — CRECI ${data.anunciante_creci}` : ''}
              </Text>
            ) : data.anunciante_creci ? (
              <Text style={styles.assMeta}>CRECI {data.anunciante_creci}</Text>
            ) : null}
            <Text style={styles.assMeta}>
              {fmtDataHora(data.assinado_locador_em)}{data.assinado_locador_ip ? ` · IP ${data.assinado_locador_ip}` : ''}
            </Text>
          </View>
        </View>

        <Text style={styles.rodape}>
          Termo de entrega de chaves gerado via AluguelCuiabá · {data.anunciante_nome}
        </Text>
      </Page>
    </Document>
  )
}
