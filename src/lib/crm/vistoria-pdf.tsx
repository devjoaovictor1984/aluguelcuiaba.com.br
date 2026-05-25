/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image, Link } from '@react-pdf/renderer'
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
  anunciante_razao_social: string | null
  anunciante_cnpj: string | null              // já formatado
  anunciante_creci: string | null             // CRECI pessoa física do corretor
  anunciante_creci_juridico: string | null    // CRECI-J da imobiliária
  anunciante_logo_url: string | null
  anunciante_endereco: string | null          // logradouro, nº, bairro, cidade-UF, CEP
  anunciante_cidade_uf: string | null         // ex: "Cuiabá-MT", usado no fecho do termo
  contrato_codigo: string
  imovel_titulo: string | null
  imovel_endereco: string | null
  inquilino_nome: string
  inquilino_cpf: string | null
  itens: VistoriaPDFItem[]
  // Fotos por escopo (além das vinculadas a item)
  fotos_gerais?: string[]                       // sem cômodo nem item
  fotos_por_comodo?: Record<string, string[]>   // só cômodo
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
  // ── Cabeçalho institucional (fixo no topo de toda página) ──
  cabecalhoInst: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 8,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
  },
  cabecalhoLogo: { width: 70, height: 50, objectFit: 'contain' },
  cabecalhoDados: { textAlign: 'right', fontSize: 8, color: '#374151', lineHeight: 1.35 },
  cabecalhoRazao: { fontSize: 10, fontWeight: 'bold', color: '#111827', marginBottom: 1 },
  // ── Header do documento (título + badge) ──
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
  // ── Texto contratual (introdução + cláusulas) ──
  secaoTitulo: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secaoParagrafo: {
    fontSize: 8.5,
    color: '#374151',
    textAlign: 'justify',
    marginBottom: 3,
    lineHeight: 1.45,
  },
  introBox: {
    backgroundColor: '#faf5ff',
    borderLeftWidth: 3,
    borderLeftColor: roxo,
    borderLeftStyle: 'solid',
    padding: 8,
    marginBottom: 10,
  },
  introTexto: {
    fontSize: 8.5,
    color: '#1f2937',
    textAlign: 'justify',
    lineHeight: 1.45,
  },
  aceiteBox: {
    marginTop: 16,
    padding: 10,
    backgroundColor: fundo,
    borderRadius: 3,
  },
  aceiteTexto: {
    fontSize: 8.5,
    color: '#1f2937',
    textAlign: 'justify',
    fontStyle: 'italic',
    lineHeight: 1.45,
  },
  aceiteLocal: {
    fontSize: 8.5,
    color: '#111827',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 6,
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
    gap: 4,
    marginTop: 6,
  },
  foto: {
    width: 120,
    height: 90,
    borderRadius: 4,
    objectFit: 'cover',
  },
  fotoInquilino: {
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'solid',
  },
  fotoLegenda: {
    fontSize: 6,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 1,
    width: 120,
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

  const tipoLabel = data.tipo === 'entrada' ? 'entrada' : 'saída'
  const nomeInst = data.anunciante_razao_social ?? data.anunciante_nome
  const linhaCreci = [
    data.anunciante_creci_juridico ? `CRECI-J ${data.anunciante_creci_juridico}` : null,
    data.anunciante_creci ? `CRECI ${data.anunciante_creci}` : null,
  ].filter(Boolean).join(' · ')
  const dataExtenso = data.data_vistoria
    ? new Date(data.data_vistoria + 'T00:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : null

  return (
    <Document title={`Vistoria ${data.tipo} - ${data.contrato_codigo}`} author={nomeInst}>
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho institucional fixo */}
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

        {/* Header do documento */}
        <View style={styles.header}>
          <View>
            <Text style={styles.titulo}>
              Termo de Vistoria de {data.tipo === 'entrada' ? 'Entrada' : 'Saída'}
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

        {/* 1. Identificação */}
        <View style={styles.introBox}>
          <Text style={styles.introTexto}>
            Pelo presente instrumento, fica registrada a{' '}
            <Text style={{ fontWeight: 'bold' }}>vistoria de {tipoLabel}</Text>{' '}
            do imóvel objeto do{' '}
            <Text style={{ fontWeight: 'bold' }}>Contrato de Locação {data.contrato_codigo}</Text>
            {data.imovel_endereco ? `, situado em ${data.imovel_endereco}` : ''}, firmado com{' '}
            <Text style={{ fontWeight: 'bold' }}>{data.inquilino_nome}</Text>
            {data.inquilino_cpf ? ` (CPF ${data.inquilino_cpf})` : ''}, doravante LOCATÁRIO, integrando-se ao referido contrato como anexo, nos termos da Lei nº 8.245/1991.
          </Text>
        </View>

        {/* 2. Estado de conservação */}
        <Text style={styles.secaoTitulo}>2. Estado de conservação e declarações do locatário</Text>
        <Text style={styles.secaoParagrafo}>
          <Text style={{ fontWeight: 'bold' }}>2.1.</Text> O LOCATÁRIO declara que recebeu o IMÓVEL no estado de uso, limpeza e funcionamento descrito no checklist abaixo, obrigando-se a conservá-lo, utilizá-lo adequadamente e devolvê-lo, ao final da locação, no mesmo estado, ressalvado o desgaste natural decorrente do uso regular.
        </Text>
        <Text style={styles.secaoParagrafo}>
          <Text style={{ fontWeight: 'bold' }}>2.2.</Text> Eventual divergência relevante não descrita nesta vistoria deverá ser apontada por escrito no prazo de <Text style={{ fontWeight: 'bold' }}>5 (cinco) dias úteis</Text> contados da entrega das chaves, acompanhada de fotos ou vídeos. O silêncio será interpretado como concordância com o estado de conservação aqui registrado.
        </Text>
        <Text style={styles.secaoParagrafo}>
          <Text style={{ fontWeight: 'bold' }}>2.3.</Text> Ficam expressamente ressalvados vícios estruturais, defeitos ocultos, problemas preexistentes, falhas construtivas, infiltrações, trincas, telhado, fundação, rede hidráulica e elétrica embutida não causados pelo LOCATÁRIO, cuja responsabilidade é da LOCADORA, desde que comunicados imediatamente e não agravados por omissão, mau uso ou intervenção indevida.
        </Text>

        {/* 3. Chaves */}
        <Text style={styles.secaoTitulo}>3. Chaves, controles e acessos</Text>
        <Text style={styles.secaoParagrafo}>
          <Text style={{ fontWeight: 'bold' }}>3.1.</Text> O LOCATÁRIO recebe nesta data{' '}
          <Text style={{ fontWeight: 'bold' }}>
            {data.qtd_chaves} chave{data.qtd_chaves === 1 ? '' : 's'}
          </Text>{' '}e{' '}
          <Text style={{ fontWeight: 'bold' }}>
            {data.qtd_controles} controle{data.qtd_controles === 1 ? '' : 's'}
          </Text>
          , obrigando-se a devolvê-los ao final da locação, juntamente com tags, cartões e demais acessos eventualmente entregues.
        </Text>
        <Text style={styles.secaoParagrafo}>
          <Text style={{ fontWeight: 'bold' }}>3.2.</Text> A perda, extravio, dano ou não devolução de chaves, controles ou acessos implicará reposição às expensas do LOCATÁRIO, inclusive substituição de fechadura quando necessário por motivo de segurança.
        </Text>

        {/* 4. Reparos */}
        <Text style={styles.secaoTitulo}>4. Responsabilidades pelos reparos</Text>
        <Text style={styles.secaoParagrafo}>
          <Text style={{ fontWeight: 'bold' }}>4.1.</Text> São de responsabilidade do LOCATÁRIO os reparos decorrentes de mau uso, falta de limpeza, falta de manutenção ordinária, negligência, imprudência ou imperícia, incluindo quebras de vidros, fechaduras, torneiras, registros, louças, portas, controles, tomadas, interruptores, lâmpadas, ralos, sifões, pias, vasos sanitários, entupimentos por uso inadequado e demais itens de uso cotidiano.
        </Text>
        <Text style={styles.secaoParagrafo}>
          <Text style={{ fontWeight: 'bold' }}>4.2.</Text> Danos causados por familiares, visitantes, empregados, prestadores de serviço, animais ou terceiros que ingressem no imóvel por autorização do LOCATÁRIO são de sua inteira responsabilidade.
        </Text>

        {/* 5. Devolução */}
        <Text style={styles.secaoTitulo}>5. Devolução e vistoria final</Text>
        <Text style={styles.secaoParagrafo}>
          <Text style={{ fontWeight: 'bold' }}>5.1.</Text> Ao término da locação, o imóvel deverá ser devolvido limpo, livre de pessoas e bens, sem lixo ou entulho, em condições compatíveis com a vistoria inicial, ressalvado o desgaste natural.
        </Text>
        <Text style={styles.secaoParagrafo}>
          <Text style={{ fontWeight: 'bold' }}>5.2.</Text> A devolução somente será considerada efetiva após vistoria final, quitação integral de aluguel, IPTU, consumos e encargos, reparação ou indenização de danos apurados, baixa das contas de consumo e assinatura do termo de encerramento.
        </Text>

        {/* 6. Assinatura eletrônica */}
        <Text style={styles.secaoTitulo}>6. Assinatura eletrônica</Text>
        <Text style={styles.secaoParagrafo}>
          <Text style={{ fontWeight: 'bold' }}>6.1.</Text> O LOCATÁRIO reconhece a validade jurídica da assinatura eletrônica realizada neste documento, nos termos da <Text style={{ fontWeight: 'bold' }}>MP nº 2.200-2/2001</Text> e da <Text style={{ fontWeight: 'bold' }}>Lei nº 14.063/2020</Text>, ficando registrados data, hora e endereço IP do dispositivo utilizado.
        </Text>
        <Text style={styles.secaoParagrafo}>
          <Text style={{ fontWeight: 'bold' }}>6.2.</Text> A assinatura abaixo importa em concordância integral com o estado descrito e com as observações eventualmente registradas pelo LOCATÁRIO em cada item, ressalvado o prazo de 5 dias úteis para apontamentos complementares (item 2.2).
        </Text>

        {/* 7. Checklist — título da seção */}
        <Text style={styles.secaoTitulo}>7. Checklist do imóvel</Text>

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

        {/* Fotos gerais (escopo do imóvel todo) */}
        {data.fotos_gerais && data.fotos_gerais.length > 0 && (
          <View style={{ marginBottom: 10 }} wrap={false}>
            <Text style={styles.comodoHeader}>Fotos gerais</Text>
            <View style={styles.fotosLinha}>
              {data.fotos_gerais.slice(0, 12).map((url, i) => (
                <View key={i}>
                  <Link src={url}>
                    <Image src={url} style={styles.foto} />
                  </Link>
                  <Text style={styles.fotoLegenda}>toque pra ampliar</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Itens por cômodo */}
        {Object.entries(grupos).map(([comodo, itens]) => (
          <View key={comodo} wrap={false}>
            <Text style={styles.comodoHeader}>{comodo}</Text>
            {data.fotos_por_comodo?.[comodo] && data.fotos_por_comodo[comodo].length > 0 && (
              <View style={[styles.fotosLinha, { marginBottom: 4 }]}>
                {data.fotos_por_comodo[comodo].slice(0, 12).map((url, i) => (
                  <View key={i}>
                    <Link src={url}>
                      <Image src={url} style={styles.foto} />
                    </Link>
                    <Text style={styles.fotoLegenda}>toque pra ampliar</Text>
                  </View>
                ))}
              </View>
            )}
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
                        {todasFotos.slice(0, 8).map((f, i) => (
                          <View key={i}>
                            {/* Link envolve a imagem — clicar abre o original em tela cheia no navegador */}
                            <Link src={f.url}>
                              <Image
                                src={f.url}
                                style={[
                                  styles.foto,
                                  f.origem === 'inquilino' ? styles.fotoInquilino : {},
                                ]}
                              />
                            </Link>
                            <Text style={styles.fotoLegenda}>
                              {f.origem === 'inquilino' ? '(inquilino) ' : ''}toque pra ampliar
                            </Text>
                          </View>
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

        {/* Termo de aceite */}
        <View style={styles.aceiteBox} wrap={false}>
          <Text style={styles.aceiteTexto}>
            E, por estar plenamente ciente do estado de conservação descrito e das obrigações assumidas, o LOCATÁRIO assina o presente Termo de Vistoria, que passa a integrar o Contrato de Locação como anexo, para todos os fins de direito.
          </Text>
          {dataExtenso && (
            <Text style={styles.aceiteLocal}>
              {data.anunciante_cidade_uf ?? 'Cuiabá-MT'}, {dataExtenso}.
            </Text>
          )}
        </View>

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
