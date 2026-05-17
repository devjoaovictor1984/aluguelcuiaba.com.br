/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { valorPorExtenso } from '@/lib/extenso'

export interface ReciboData {
  numero_recibo: number
  contrato_codigo: string
  // Inquilino
  inquilino_nome: string
  inquilino_cpf: string | null
  // Imóvel
  imovel_titulo: string | null
  imovel_endereco: string | null
  // Valores
  valor_aluguel: number
  valor_seguro: number
  valor_iptu: number
  valor_condominio: number
  valor_total: number
  valor_pago: number
  juros_multa: number
  desconto: number
  mes_referencia: string  // YYYY-MM-01
  data_pagamento: string  // YYYY-MM-DD
  // Emitente
  emitente_nome: string
  emitente_cpf_cnpj: string | null
  emitente_endereco: string | null
  emitente_telefone: string | null
  cidade: string
  logo_url: string | null
  // Personalização da assinatura
  assinatura_url?: string | null
  assinatura_nome?: string | null    // nome impresso embaixo da linha
  mostrar_linha_assinatura?: boolean
  assinatura_sobre_linha?: boolean
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1f2937',
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: '#7c3aed',
    borderBottomStyle: 'solid',
  },
  emitenteBox: {
    flex: 1,
  },
  emitenteNome: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  emitenteInfo: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 2,
  },
  reciboNumero: {
    textAlign: 'right',
  },
  reciboLabel: {
    fontSize: 8,
    color: '#7c3aed',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  reciboValor: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  titulo: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 18,
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  valorPrincipal: {
    backgroundColor: '#f3e8ff',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 8,
    textAlign: 'center',
    marginBottom: 18,
  },
  valorPrincipalLabel: {
    fontSize: 8,
    color: '#7c3aed',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  valorPrincipalValor: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#7c3aed',
    marginTop: 6,
    marginBottom: 10,
  },
  valorExtenso: {
    fontSize: 10,
    fontStyle: 'italic',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9d5ff',
    borderTopStyle: 'solid',
    color: '#4b5563',
    marginTop: 6,
  },
  paragrafo: {
    marginBottom: 10,
    textAlign: 'justify',
  },
  destaque: {
    fontWeight: 'bold',
    color: '#111827',
  },
  table: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'solid',
    borderRadius: 4,
    marginBottom: 18,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
    padding: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    borderBottomStyle: 'solid',
    padding: 6,
  },
  tableRowLast: {
    flexDirection: 'row',
    padding: 6,
    backgroundColor: '#fafafa',
  },
  tableCol: { flex: 1, fontSize: 9 },
  tableColRight: { flex: 1, fontSize: 9, textAlign: 'right' },
  tableColHeader: { flex: 1, fontSize: 8, fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' },
  tableColHeaderRight: { flex: 1, fontSize: 8, fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', textAlign: 'right' },
  rodape: {
    marginTop: 30,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderTopStyle: 'solid',
  },
  assinatura: {
    marginTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  linhaAssinatura: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    borderTopStyle: 'solid',
    paddingTop: 4,
    fontSize: 8,
    textAlign: 'center',
  },
  data: {
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 10,
  },
})

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string): string {
  const s = iso.slice(0, 10)
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function mesAnoExtenso(iso: string): string {
  const s = iso.slice(0, 10)
  const [y, m] = s.split('-')
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${meses[parseInt(m) - 1]}/${y}`
}

export function ReciboDocument({ data }: { data: ReciboData }) {
  const valorRecebido = data.valor_pago || data.valor_total
  const extenso = valorPorExtenso(valorRecebido)

  return (
    <Document title={`Recibo Nº ${data.numero_recibo}`} author={data.emitente_nome}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.emitenteBox}>
            {data.logo_url && (
              <Image src={data.logo_url} style={{ width: 100, height: 30, objectFit: 'contain', marginBottom: 6 }} />
            )}
            <Text style={styles.emitenteNome}>{data.emitente_nome}</Text>
            {data.emitente_cpf_cnpj && <Text style={styles.emitenteInfo}>CPF/CNPJ: {data.emitente_cpf_cnpj}</Text>}
            {data.emitente_endereco && <Text style={styles.emitenteInfo}>{data.emitente_endereco}</Text>}
            {data.emitente_telefone && <Text style={styles.emitenteInfo}>Tel: {data.emitente_telefone}</Text>}
          </View>
          <View style={styles.reciboNumero}>
            <Text style={styles.reciboLabel}>RECIBO Nº</Text>
            <Text style={styles.reciboValor}>{String(data.numero_recibo).padStart(4, '0')}</Text>
            <Text style={styles.emitenteInfo}>Contrato {data.contrato_codigo}</Text>
          </View>
        </View>

        <Text style={styles.titulo}>Recibo de Aluguel</Text>

        {/* Valor em destaque */}
        <View style={styles.valorPrincipal}>
          <Text style={styles.valorPrincipalLabel}>VALOR RECEBIDO</Text>
          <Text style={styles.valorPrincipalValor}>{fmtBRL(valorRecebido)}</Text>
          <Text style={styles.valorExtenso}>{extenso}</Text>
        </View>

        {/* Texto principal */}
        <Text style={styles.paragrafo}>
          Recebi de <Text style={styles.destaque}>{data.inquilino_nome}</Text>
          {data.inquilino_cpf && `, CPF ${data.inquilino_cpf},`}
          {' '}a importância de <Text style={styles.destaque}>{fmtBRL(valorRecebido)}</Text>
          {' '}({extenso.toLowerCase()}), referente ao aluguel do mês de
          {' '}<Text style={styles.destaque}>{mesAnoExtenso(data.mes_referencia)}</Text>
          {data.imovel_titulo && (
            <>
              {' '}do imóvel <Text style={styles.destaque}>{data.imovel_titulo}</Text>
              {data.imovel_endereco && `, localizado em ${data.imovel_endereco}`}
            </>
          )}.
        </Text>

        {/* Discriminação dos valores */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableColHeader}>Descrição</Text>
            <Text style={styles.tableColHeaderRight}>Valor</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCol}>Aluguel</Text>
            <Text style={styles.tableColRight}>{fmtBRL(data.valor_aluguel)}</Text>
          </View>
          {data.valor_seguro > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCol}>Seguro fiança</Text>
              <Text style={styles.tableColRight}>{fmtBRL(data.valor_seguro)}</Text>
            </View>
          )}
          {data.valor_iptu > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCol}>IPTU</Text>
              <Text style={styles.tableColRight}>{fmtBRL(data.valor_iptu)}</Text>
            </View>
          )}
          {data.valor_condominio > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCol}>Condomínio</Text>
              <Text style={styles.tableColRight}>{fmtBRL(data.valor_condominio)}</Text>
            </View>
          )}
          {data.juros_multa > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCol}>Juros / Multa</Text>
              <Text style={styles.tableColRight}>{fmtBRL(data.juros_multa)}</Text>
            </View>
          )}
          {data.desconto > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCol}>Desconto</Text>
              <Text style={styles.tableColRight}>-{fmtBRL(data.desconto)}</Text>
            </View>
          )}
          <View style={styles.tableRowLast}>
            <Text style={[styles.tableCol, { fontWeight: 'bold' }]}>TOTAL</Text>
            <Text style={[styles.tableColRight, { fontWeight: 'bold', color: '#7c3aed' }]}>{fmtBRL(valorRecebido)}</Text>
          </View>
        </View>

        <Text style={styles.paragrafo}>
          Pagamento recebido em <Text style={styles.destaque}>{fmtData(data.data_pagamento)}</Text>.
          Para clareza e validade, dou esta quitação.
        </Text>

        {/* Assinatura + Data */}
        <Assinatura data={data} />

        <Text style={styles.data}>
          {data.cidade}, {fmtData(data.data_pagamento)}
        </Text>
      </Page>
    </Document>
  )
}

function Assinatura({ data }: { data: ReciboData }) {
  const mostrarLinha = data.mostrar_linha_assinatura !== false
  const sobreLinha = data.assinatura_sobre_linha !== false
  const nome = data.assinatura_nome || data.emitente_nome

  return (
    <View style={{ marginTop: 50 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
        <View style={{ flex: 1 }} />
        <View style={{ flex: 2, position: 'relative' }}>
          {/* Imagem da assinatura, posicionada sobre a linha ou logo acima */}
          {data.assinatura_url && (
            <Image
              src={data.assinatura_url}
              style={{
                width: '70%',
                height: 50,
                alignSelf: 'center',
                marginBottom: sobreLinha && mostrarLinha ? -42 : -6,
                objectFit: 'contain',
              }}
            />
          )}

          {/* Linha + nome (opcionais) */}
          {mostrarLinha ? (
            <View style={{
              borderTopWidth: 1,
              borderTopColor: '#1f2937',
              borderTopStyle: 'solid',
              paddingTop: 4,
            }}>
              <Text style={{ fontSize: 8, textAlign: 'center' }}>{nome}</Text>
            </View>
          ) : data.assinatura_url ? (
            <Text style={{ fontSize: 8, textAlign: 'center', marginTop: 4 }}>{nome}</Text>
          ) : null}
        </View>
        <View style={{ flex: 1 }} />
      </View>
    </View>
  )
}
