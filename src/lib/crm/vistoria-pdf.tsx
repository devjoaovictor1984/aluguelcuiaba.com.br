/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { LABEL_ESTADO, type EstadoItem } from '@/lib/vistorias/modelos'

export interface VistoriaPDFItem {
  id: string
  comodo: string
  item: string
  estado: EstadoItem
  observacao: string | null
  observacao_inquilino: string | null
  fotos_corretor: string[]   // URLs
  fotos_inquilino: string[]  // URLs
}

export interface VistoriaPDFData {
  tipo: 'entrada' | 'saida'
  data_vistoria: string | null
  observacoes_gerais: string | null
  qtd_chaves: number
  qtd_controles: number
  inquilino_observacoes: string | null
  assinatura_inquilino_url: string | null
  assinada_em: string | null
  assinada_ip: string | null
  // Emitente
  anunciante_nome: string
  contrato_codigo: string
  imovel_titulo: string | null
  imovel_endereco: string | null
  inquilino_nome: string
  inquilino_cpf: string | null
  itens: VistoriaPDFItem[]
}

const roxo = '#7c3aed'
const cinza = '#6b7280'
const fundo = '#f9fafb'

const COR_ESTADO: Record<EstadoItem, { bg: string; cor: string }> = {
  perfeito: { bg: '#dcfce7', cor: '#15803d' },
  bom: { bg: '#dbeafe', cor: '#1d4ed8' },
  regular: { bg: '#fef3c7', cor: '#a16207' },
  danificado: { bg: '#fee2e2', cor: '#b91c1c' },
  nao_aplicavel: { bg: '#f3f4f6', cor: '#6b7280' },
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1f2937',
    lineHeight: 1.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 12,
    marginBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: roxo,
    borderBottomStyle: 'solid',
  },
  titulo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitulo: {
    fontSize: 9,
    color: cinza,
    marginTop: 2,
  },
  badge: {
    backgroundColor: roxo,
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  infoBox: {
    backgroundColor: fundo,
    padding: 8,
    borderRadius: 4,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: { fontSize: 7, color: cinza, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValor: { fontSize: 9, color: '#111827', marginTop: 1 },

  comodoHeader: {
    backgroundColor: roxo,
    color: '#fff',
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 3,
  },

  itemRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
  },
  itemNome: { flex: 2, fontSize: 9, fontWeight: 'bold' },
  itemEstadoBox: {
    fontSize: 7,
    fontWeight: 'bold',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },
  itemObs: { fontSize: 8, color: cinza, marginTop: 3, fontStyle: 'italic' },
  obsInquilino: {
    fontSize: 8,
    backgroundColor: '#dbeafe',
    color: '#1e3a8a',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
    marginTop: 3,
  },
  fotosLinha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 4,
  },
  foto: {
    width: 50,
    height: 50,
    borderRadius: 3,
    objectFit: 'cover',
  },
  fotoInquilino: {
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    borderStyle: 'solid',
  },

  assinaturaBox: {
    marginTop: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'solid',
    borderRadius: 4,
  },
  assinaturaTitulo: { fontSize: 9, fontWeight: 'bold', color: '#111827', marginBottom: 6 },
  obsFinal: {
    fontSize: 8,
    color: cinza,
    backgroundColor: fundo,
    padding: 6,
    borderRadius: 3,
    marginTop: 6,
    fontStyle: 'italic',
  },
  rodape: {
    marginTop: 18,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderTopStyle: 'solid',
    fontSize: 7,
    color: '#9ca3af',
    textAlign: 'center',
  },
})

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  const s = iso.slice(0, 10)
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function fmtDataHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

export function VistoriaDocument({ data }: { data: VistoriaPDFData }) {
  const grupos = data.itens.reduce<Record<string, VistoriaPDFItem[]>>((acc, it) => {
    if (!acc[it.comodo]) acc[it.comodo] = []
    acc[it.comodo].push(it)
    return acc
  }, {})

  return (
    <Document title={`Vistoria ${data.tipo} - ${data.contrato_codigo}`} author={data.anunciante_nome}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.titulo}>
              Vistoria de {data.tipo === 'entrada' ? 'Entrada' : 'Saída'}
            </Text>
            <Text style={styles.subtitulo}>
              Contrato {data.contrato_codigo} · {data.imovel_titulo ?? '—'}
            </Text>
            <Text style={styles.subtitulo}>
              {data.inquilino_nome}
              {data.inquilino_cpf && ` · CPF ${data.inquilino_cpf}`}
            </Text>
          </View>
          <Text style={styles.badge}>
            {data.assinada_em ? 'Assinada' : 'Rascunho'}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <View>
            <Text style={styles.infoLabel}>Data da vistoria</Text>
            <Text style={styles.infoValor}>{fmtData(data.data_vistoria)}</Text>
          </View>
          <View>
            <Text style={styles.infoLabel}>Chaves</Text>
            <Text style={styles.infoValor}>{data.qtd_chaves}</Text>
          </View>
          <View>
            <Text style={styles.infoLabel}>Controles</Text>
            <Text style={styles.infoValor}>{data.qtd_controles}</Text>
          </View>
          {data.imovel_endereco && (
            <View style={{ maxWidth: 220 }}>
              <Text style={styles.infoLabel}>Endereço</Text>
              <Text style={styles.infoValor}>{data.imovel_endereco}</Text>
            </View>
          )}
        </View>

        {data.observacoes_gerais && (
          <View style={{ marginBottom: 10, padding: 6, backgroundColor: '#faf5ff', borderRadius: 3 }}>
            <Text style={{ fontSize: 7, color: roxo, fontWeight: 'bold', marginBottom: 2 }}>OBSERVAÇÕES GERAIS</Text>
            <Text style={{ fontSize: 8, color: '#581c87' }}>{data.observacoes_gerais}</Text>
          </View>
        )}

        {/* Itens por cômodo */}
        {Object.entries(grupos).map(([comodo, itens]) => (
          <View key={comodo} wrap={false}>
            <Text style={styles.comodoHeader}>{comodo}</Text>
            {itens.map(it => {
              const cor = COR_ESTADO[it.estado]
              const todasFotos = [
                ...it.fotos_corretor.map(url => ({ url, origem: 'corretor' as const })),
                ...it.fotos_inquilino.map(url => ({ url, origem: 'inquilino' as const })),
              ]
              return (
                <View key={it.id} style={styles.itemRow}>
                  <View style={styles.itemNome}>
                    <Text>{it.item}</Text>
                    {it.observacao && <Text style={styles.itemObs}>{it.observacao}</Text>}
                    {it.observacao_inquilino && (
                      <Text style={styles.obsInquilino}>
                        Inquilino: {it.observacao_inquilino}
                      </Text>
                    )}
                    {todasFotos.length > 0 && (
                      <View style={styles.fotosLinha}>
                        {todasFotos.slice(0, 6).map((f, i) => (
                          <Image
                            key={i}
                            src={f.url}
                            style={[
                              styles.foto,
                              f.origem === 'inquilino' ? styles.fotoInquilino : {},
                            ]}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <View style={[styles.itemEstadoBox, { backgroundColor: cor.bg, color: cor.cor }]}>
                      <Text>{LABEL_ESTADO[it.estado]}</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        ))}

        {/* Assinatura */}
        <View style={styles.assinaturaBox} wrap={false}>
          <Text style={styles.assinaturaTitulo}>Assinatura do inquilino</Text>
          {data.assinatura_inquilino_url ? (
            <Image
              src={data.assinatura_inquilino_url}
              style={{ width: 200, height: 70, objectFit: 'contain', alignSelf: 'center', marginVertical: 4 }}
            />
          ) : (
            <Text style={{ fontSize: 8, color: cinza, textAlign: 'center', paddingVertical: 16 }}>
              (sem assinatura registrada)
            </Text>
          )}
          <Text style={{ fontSize: 8, textAlign: 'center', color: '#111827', fontWeight: 'bold', marginTop: 4 }}>
            {data.inquilino_nome}
          </Text>
          <Text style={{ fontSize: 7, textAlign: 'center', color: cinza }}>
            Assinada em {fmtDataHora(data.assinada_em)}
            {data.assinada_ip && ` · IP ${data.assinada_ip}`}
          </Text>
          {data.inquilino_observacoes && (
            <View style={styles.obsFinal}>
              <Text style={{ fontSize: 7, color: cinza, fontWeight: 'bold' }}>Observações do inquilino:</Text>
              <Text>{data.inquilino_observacoes}</Text>
            </View>
          )}
        </View>

        <Text style={styles.rodape}>
          Vistoria gerada via AluguelCuiabá · {data.anunciante_nome}
        </Text>
      </Page>
    </Document>
  )
}
