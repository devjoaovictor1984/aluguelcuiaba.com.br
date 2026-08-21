/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

export interface CertificadoSignatario {
  nome: string
  email: string
  celular: string | null
  papel: string | null
  assinado_em: string | null
  otp_usado: boolean
  ip: string | null
  geo: string | null
  /** URL assinada do bucket privado (ou data URL legada, pré-v82). */
  selfie_url: string | null
  assinatura_b64: string | null
  user_agent: string | null
  /** Ainda nao assinou — so aparece na previa, com o bloco vazio. */
  pendente?: boolean
}

/** User-agent cru é ruído no certificado: vira "Navegador · Sistema". */
function fmtDispositivo(ua: string | null): string {
  if (!ua) return '—'
  const nav =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' :
    /Firefox\//.test(ua) ? 'Firefox' : 'Navegador'
  const so =
    /iPhone|iPad|iPod/.test(ua) ? 'iPhone/iPad' :
    /Android/.test(ua) ? 'Android' :
    /Windows/.test(ua) ? 'Windows' :
    /Mac OS X/.test(ua) ? 'Mac' :
    /Linux/.test(ua) ? 'Linux' : null
  return so ? `${nav} · ${so}` : nav
}

function fmtCel(c: string | null): string {
  if (!c) return '—'
  const d = c.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
  return c
}

export interface CertificadoData {
  titulo: string
  tipo_contrato: 'locacao' | 'administracao'
  emitente_nome: string
  concluido_em: string | null
  hash: string | null
  signatarios: CertificadoSignatario[]
  /** Previa emitida com o processo em andamento (nem todos assinaram). */
  parcial?: boolean
}

const styles = StyleSheet.create({
  // paddingBottom maior que o resto: o carimbo de validação (código + QR) é
  // desenhado depois, por pdf-lib, e ocupa os ~50pt de baixo da página.
  page: { padding: 40, paddingBottom: 62, fontSize: 10, fontFamily: 'Helvetica', color: '#1f2937', lineHeight: 1.5 },
  selo: { fontSize: 8, color: '#7c3aed', fontWeight: 'bold', letterSpacing: 1.5, textAlign: 'center', marginBottom: 4 },
  titulo: { fontSize: 16, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 4 },
  sub: { fontSize: 9, color: '#6b7280', textAlign: 'center', marginBottom: 2 },
  linha: { height: 1.5, backgroundColor: '#7c3aed', marginTop: 10, marginBottom: 16 },
  bloco: { borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'solid', borderRadius: 6, padding: 10, marginBottom: 12 },
  nome: { fontSize: 11, fontWeight: 'bold', color: '#111827' },
  papel: { fontSize: 8, color: '#7c3aed', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  campo: { fontSize: 8.5, color: '#4b5563', marginTop: 1 },
  label: { color: '#9ca3af' },
  imgRow: { flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'flex-end' },
  selfie: { width: 64, height: 64, objectFit: 'cover', borderRadius: 4 },
  assinatura: { width: 160, height: 54, objectFit: 'contain' },
  hashBox: { backgroundColor: '#f9fafb', borderRadius: 4, padding: 8, marginTop: 6 },
  avisoParcial: {
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderStyle: 'solid',
    borderRadius: 6, padding: 8, marginBottom: 14, fontSize: 8.5, color: '#92400e',
  },
  aguardando: { fontSize: 8.5, color: '#b45309', marginTop: 2 },
  rodape: { marginTop: 16, fontSize: 7.5, color: '#9ca3af', textAlign: 'justify', lineHeight: 1.5 },
})

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR')
}

export function CertificadoAssinaturaDocument({ data }: { data: CertificadoData }) {
  return (
    <Document title={`Certificado de Assinatura — ${data.titulo}`} author={data.emitente_nome}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.selo}>ASSINATURA ELETRÔNICA</Text>
        <Text style={styles.titulo}>Certificado de Assinatura</Text>
        <Text style={styles.sub}>{data.titulo} · {data.tipo_contrato === 'administracao' ? 'Contrato de Administração' : 'Contrato de Locação'}</Text>
        <Text style={styles.sub}>
          {data.parcial
            ? `Emitido em ${fmt(new Date().toISOString())}`
            : `Concluído em ${fmt(data.concluido_em)}`} · Emitente: {data.emitente_nome}
        </Text>
        <View style={styles.linha} />

        {data.parcial && (
          <View style={styles.avisoParcial}>
            <Text>
              PRÉVIA — processo em andamento. Faltam assinaturas, então este documento
              registra apenas as já coletadas até o momento e não vale como certificado
              final. O certificado definitivo sai anexo ao contrato quando todas as partes
              assinarem.
            </Text>
          </View>
        )}

        {data.signatarios.map((s, i) => (
          <View key={i} style={styles.bloco} wrap={false}>
            {s.papel && <Text style={styles.papel}>{s.papel}</Text>}
            <Text style={styles.nome}>{s.nome}</Text>
            {s.pendente ? (
              <>
                <Text style={styles.campo}><Text style={styles.label}>E-mail: </Text>{s.email}</Text>
                <Text style={styles.aguardando}>Aguardando assinatura.</Text>
              </>
            ) : (
              <>
                <Text style={styles.campo}><Text style={styles.label}>E-mail{s.otp_usado ? ' (OTP confirmado)' : ''}: </Text>{s.email}</Text>
                <Text style={styles.campo}><Text style={styles.label}>Celular: </Text>{fmtCel(s.celular)}</Text>
                <Text style={styles.campo}><Text style={styles.label}>Assinado em: </Text>{fmt(s.assinado_em)}</Text>
                <Text style={styles.campo}><Text style={styles.label}>IP: </Text>{s.ip ?? '—'}   <Text style={styles.label}>Localização: </Text>{s.geo ?? '—'}</Text>
                <Text style={styles.campo}><Text style={styles.label}>Dispositivo: </Text>{fmtDispositivo(s.user_agent)}</Text>
                <View style={styles.imgRow}>
                  {s.selfie_url && <Image src={s.selfie_url} style={styles.selfie} />}
                  {s.assinatura_b64 && <Image src={s.assinatura_b64} style={styles.assinatura} />}
                </View>
              </>
            )}
          </View>
        ))}

        {data.hash && (
          <View style={styles.hashBox}>
            <Text style={styles.campo}><Text style={styles.label}>Hash SHA-256 do contrato (integridade): </Text></Text>
            <Text style={{ fontSize: 7.5, fontFamily: 'Courier', color: '#111827' }}>{data.hash}</Text>
          </View>
        )}

        <Text style={styles.rodape}>
          Documento assinado eletronicamente pelos signatários acima identificados, com validação de e-mail e
          celular, registro de selfie, assinatura manuscrita digital, trilha de auditoria (data, hora, IP e
          localização) e, quando exigido, confirmação de código enviado por e-mail (OTP), nos termos da
          Medida Provisória nº 2.200-2/2001 (ICP-Brasil),
          do art. 10, §2º, e da Lei nº 13.709/2018 (LGPD).
          {data.hash ? ' O código hash acima garante a integridade do documento contratual ao qual este '
            + 'certificado se anexa: qualquer alteração no contrato resultará em hash diferente.' : ''}
        </Text>
      </Page>
    </Document>
  )
}
