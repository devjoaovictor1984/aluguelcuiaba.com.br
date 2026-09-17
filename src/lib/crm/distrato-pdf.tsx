/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
// Importar daqui também dispara o registro da fonte Poppins (side-effect no
// topo de contrato-pdf.tsx). Mesma família do contrato e do aditivo, pra
// manter a identidade. Os estilos ficam locais, como em aditivo-pdf.tsx e
// termo-entrega-pdf.tsx — cada documento é dono do próprio layout.
import { FAMILIA } from './contrato-pdf'
import { clausulasPadraoDistrato, FECHAMENTO_PADRAO_DISTRATO, type ClausulaDistrato } from './distrato-clausulas'

const COR = {
  texto: '#1f2937',
  textoForte: '#111827',
  cinza: '#6b7280',
  borda: '#e5e7eb',
  bordaForte: '#d1d5db',
  roxoClaro: '#7c3aed',
  fundoAcerto: '#faf5ff',
}

export interface DistratoPDFData {
  // Emitente (administradora / corretor)
  anunciante_nome: string
  anunciante_razao_social: string | null
  anunciante_cnpj: string | null
  anunciante_creci: string | null
  anunciante_creci_juridico: string | null
  anunciante_logo_url: string | null
  anunciante_endereco: string | null
  anunciante_cidade_uf: string | null

  // Contrato distratado
  contrato_codigo: string
  /** "nº X, firmado em dd/mm/aaaa" ou o que o corretor escreveu. null = sem número. */
  contrato_referencia: string | null
  imovel_endereco: string
  finalidade?: 'residencial' | 'comercial' | 'misto'

  // Partes
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
  /** Assinaturas desenhadas na plataforma (base64), achadas pelo nome de quem assina a linha. */
  assinaturas?: Array<{ nome: string; imagem: string }>

  // O distrato
  data_distrato: string           // YYYY-MM-DD
  data_desocupacao: string | null // YYYY-MM-DD
  motivo: string
  titulo: string | null
  objeto: string

  // Acerto de contas — viram a cláusula 2ª
  multa_valor: number | null
  multa_dispensada: boolean
  debitos_valor: number | null
  caucao_devolver: number | null
  acerto_observacao: string | null
  quitacao_reciproca: boolean

  /** Cláusulas da 3ª em diante. null = padrão (distrato-clausulas.ts). */
  clausulas?: ClausulaDistrato[] | null
  /** Parágrafo antes da data. null = padrão. */
  fechamento?: string | null
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
  // Quadro do acerto: os números que as partes conferem antes de assinar
  // ficam num bloco só, em vez de diluídos no meio do texto corrido.
  quadro: {
    marginTop: 8, marginBottom: 4, paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10,
    backgroundColor: COR.fundoAcerto, borderRadius: 4,
  },
  quadroLinha: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    marginBottom: 3,
  },
  quadroRotulo: { fontSize: 9.5, color: COR.texto, fontFamily: FAMILIA, flex: 1 },
  quadroValor: { fontSize: 10, fontFamily: FAMILIA, fontWeight: 'bold', color: COR.textoForte },
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

function fmtDataCurta(iso: string | null): string | null {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function fmtBRL(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

/** Numera os parágrafos de um corpo como N.1, N.2… (pula linhas que já são incisos). */
function numerarCorpo(num: number, corpo: string): string[] {
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

/**
 * Assinatura desenhada de quem assina uma linha. Pelo NOME, não pelo papel:
 * o papel do signatário é texto livre no painel, o nome é o mesmo que o PDF
 * imprime embaixo da linha (as sugestões do painel saem daqui).
 */
function assinaturaDe(lista: Array<{ nome: string; imagem: string }> | undefined, nome: string | null | undefined): string | null {
  const alvo = (nome ?? '').trim().toLowerCase()
  if (!alvo || !lista) return null
  return lista.find(a => a.nome.trim().toLowerCase() === alvo)?.imagem ?? null
}

function LinhaAssinatura({ imagem }: { imagem: string | null }) {
  return (
    <>
      {imagem && <Image src={imagem} style={{ height: 34, width: 150, objectFit: 'contain', marginBottom: -2 }} />}
      <View style={styles.assinaturaLinha} />
    </>
  )
}

/**
 * Cláusula 2ª — o acerto de contas, montado dos campos do distrato.
 *
 * É a cláusula que as partes leem com atenção, então cada número aparece
 * duas vezes: em texto corrido (que é o que vale juridicamente) e no
 * quadro, que é onde o olho procura. Item sem valor não é impresso — uma
 * linha "Débitos: R$ 0,00" sugere conferência que ninguém fez.
 */
function ClausulaAcerto({ data }: { data: DistratoPDFData }) {
  const desocupacao = fmtDataCurta(data.data_desocupacao)
  const itens: string[] = []

  if (desocupacao) {
    itens.push(`O imóvel será considerado desocupado e entregue ao LOCADOR em ${desocupacao}, data a partir da qual cessam os aluguéis e encargos a cargo do LOCATÁRIO.`)
  }

  if (data.multa_dispensada) {
    itens.push(
      'As partes dispensam expressamente a multa por rescisão antecipada prevista no contrato de locação' +
      (data.multa_valor && data.multa_valor > 0 ? `, no valor de ${fmtBRL(data.multa_valor)}, que fica integralmente perdoada` : '') +
      ', nada podendo ser exigido a esse título.',
    )
  } else if (data.multa_valor && data.multa_valor > 0) {
    itens.push(`A título de multa por rescisão antecipada, o LOCATÁRIO pagará ao LOCADOR a quantia de ${fmtBRL(data.multa_valor)}, calculada proporcionalmente ao período restante do contrato, na forma do art. 4º da Lei nº 8.245/1991.`)
  }

  if (data.debitos_valor && data.debitos_valor > 0) {
    itens.push(`O LOCATÁRIO reconhece débitos em aberto no valor de ${fmtBRL(data.debitos_valor)}, referentes a aluguéis, encargos e despesas até a data da desocupação, que serão quitados na forma ajustada entre as partes.`)
  }

  if (data.caucao_devolver && data.caucao_devolver > 0) {
    itens.push(`O LOCADOR devolverá ao LOCATÁRIO a quantia de ${fmtBRL(data.caucao_devolver)}, correspondente ao saldo da caução prestada, já deduzidos os valores porventura devidos.`)
  }

  if (data.acerto_observacao?.trim()) {
    itens.push(data.acerto_observacao.trim())
  }

  if (!data.quitacao_reciproca) {
    itens.push('As partes NÃO se dão quitação recíproca neste ato quanto aos pontos ressalvados acima, que permanecem pendentes de apuração e acerto.')
  }

  if (itens.length === 0) {
    itens.push('Não há valores pendentes entre as partes em razão da locação ora distratada.')
  }

  const linhasQuadro: Array<{ rotulo: string; valor: string }> = []
  if (desocupacao) linhasQuadro.push({ rotulo: 'Desocupação do imóvel', valor: desocupacao })
  if (data.multa_dispensada) {
    linhasQuadro.push({ rotulo: 'Multa por rescisão antecipada', valor: 'Dispensada' })
  } else if (data.multa_valor && data.multa_valor > 0) {
    linhasQuadro.push({ rotulo: 'Multa por rescisão antecipada', valor: fmtBRL(data.multa_valor) })
  }
  if (data.debitos_valor && data.debitos_valor > 0) {
    linhasQuadro.push({ rotulo: 'Débitos em aberto', valor: fmtBRL(data.debitos_valor) })
  }
  if (data.caucao_devolver && data.caucao_devolver > 0) {
    linhasQuadro.push({ rotulo: 'Caução a devolver ao locatário', valor: fmtBRL(data.caucao_devolver) })
  }

  return (
    <View style={styles.clausulaWrap}>
      <Text style={styles.clausulaTitulo}>CLÁUSULA 2ª — DO ACERTO DE CONTAS</Text>
      {itens.map((t, i) => (
        <Text key={i} style={styles.clausulaCorpo}>{`2.${i + 1}. ${t}`}</Text>
      ))}
      {linhasQuadro.length > 0 && (
        <View style={styles.quadro} wrap={false}>
          {linhasQuadro.map((l, i) => (
            <View key={i} style={styles.quadroLinha}>
              <Text style={styles.quadroRotulo}>{l.rotulo}</Text>
              <Text style={styles.quadroValor}>{l.valor}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

export function DistratoDocument({ data }: { data: DistratoPDFData }) {
  const nomeInst = data.anunciante_razao_social ?? data.anunciante_nome
  const cidadeUf = data.anunciante_cidade_uf ?? 'Cuiabá-MT'
  const dataExtenso = fmtDataExtenso(data.data_distrato)

  const finalidade = data.finalidade ?? 'residencial'
  const tipoContrato =
    finalidade === 'comercial' ? 'Locação Comercial' :
    finalidade === 'misto'     ? 'Locação Residencial e Comercial' :
                                 'Locação Residencial'

  const objetoParagrafos = numerarCorpo(1, data.objeto)
  // A 3ª em diante são as editáveis; a 1ª é o objeto e a 2ª o acerto.
  const clausulasDoc = data.clausulas?.length ? data.clausulas : clausulasPadraoDistrato(cidadeUf)
  const fechamentoDoc = data.fechamento?.trim() || FECHAMENTO_PADRAO_DISTRATO

  const locadorQuali = `${data.locador_nome}${data.locador_cpf ? `, inscrito(a) no CPF/CNPJ sob nº ${data.locador_cpf}` : ''}`
  const locatarioQuali = `${data.locatario_nome}${data.locatario_cpf ? `, inscrito(a) no CPF/CNPJ sob nº ${data.locatario_cpf}` : ''}`

  return (
    <Document
      title={`Distrato — Contrato ${data.contrato_codigo}`}
      author={nomeInst}
      subject={`Distrato do contrato de locação ${data.contrato_codigo}`}
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
          Distrato de Contrato de {tipoContrato}
        </Text>
        {data.contrato_referencia && (
          <Text style={styles.subtitulo}>Contrato originário {data.contrato_referencia}</Text>
        )}
        {data.titulo?.trim() && <Text style={styles.subtitulo}>{data.titulo.trim()}</Text>}

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
          <Text style={styles.parteNome}>DISTRATO</Text> do Contrato de Locação
          {data.contrato_referencia ? ` ${data.contrato_referencia}` : ' celebrado entre as partes'}, que tem
          por objeto o imóvel situado à {data.imovel_endereco || '[ENDEREÇO DO IMÓVEL]'}, pondo fim à locação
          mediante as cláusulas e condições a seguir, com fundamento na Lei nº 8.245/1991 (Lei do Inquilinato)
          e no Código Civil Brasileiro.
        </Text>

        {/* Cláusula 1ª — o que está sendo distratado */}
        <View style={styles.clausulaWrap}>
          <Text style={styles.clausulaTitulo}>CLÁUSULA 1ª — DA RESCISÃO</Text>
          {objetoParagrafos.map((par, i) => (
            <Text key={i} style={styles.clausulaCorpo}>{par}</Text>
          ))}
        </View>

        {/* Cláusula 2ª — acerto de contas, dos campos do distrato */}
        <ClausulaAcerto data={data} />

        {/* Cláusulas 3ª em diante — editáveis, padrão em distrato-clausulas.ts */}
        {clausulasDoc.map((c, i) => {
          const numero = i + 3
          return (
            <View key={i} style={styles.clausulaWrap}>
              <Text style={styles.clausulaTitulo}>
                CLÁUSULA {numero}ª{c.titulo ? ` — ${c.titulo.toUpperCase()}` : ''}
              </Text>
              {numerarCorpo(numero, c.texto).map((par, j) => (
                <Text key={j} style={styles.clausulaCorpo}>{par}</Text>
              ))}
            </View>
          )
        })}

        <Text style={[styles.clausulaCorpo, { marginTop: 14 }]}>{fechamentoDoc}</Text>

        {/* Data */}
        <Text style={styles.data}>{cidadeUf}, {dataExtenso}.</Text>

        {/* Assinaturas */}
        <View wrap={false}>
          {/* Locador / administradora */}
          <View style={styles.assinaturaBloco}>
            <LinhaAssinatura imagem={assinaturaDe(
              data.assinaturas,
              data.tem_administracao && data.admin_responsavel_nome ? data.admin_responsavel_nome : data.locador_nome,
            )} />
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
            <LinhaAssinatura imagem={assinaturaDe(data.assinaturas, data.locatario_nome)} />
            <Text style={styles.assinaturaPapel}>Locatário(a)</Text>
            <Text style={styles.assinaturaNome}>{data.locatario_nome}</Text>
            {data.locatario_cpf && <Text style={styles.assinaturaCpf}>CPF {data.locatario_cpf}</Text>}
          </View>

          {/* Cônjuge solidário / anuente */}
          {data.conjuge_nome && data.conjuge_papel !== 'nao_participa' && (
            <View style={styles.assinaturaBloco}>
              <LinhaAssinatura imagem={assinaturaDe(data.assinaturas, data.conjuge_nome)} />
              <Text style={styles.assinaturaPapel}>
                {data.conjuge_papel === 'solidario' ? 'Locatário(a) solidário(a) / cônjuge' : 'Cônjuge anuente'}
              </Text>
              <Text style={styles.assinaturaNome}>{data.conjuge_nome}</Text>
              {data.conjuge_cpf && <Text style={styles.assinaturaCpf}>CPF {data.conjuge_cpf}</Text>}
            </View>
          )}

          {/* Fiador — assina a exoneração da garantia */}
          {data.fiador_nome && (
            <View style={styles.assinaturaBloco}>
              <LinhaAssinatura imagem={assinaturaDe(data.assinaturas, data.fiador_nome)} />
              <Text style={styles.assinaturaPapel}>Fiador(a)</Text>
              <Text style={styles.assinaturaNome}>{data.fiador_nome}</Text>
              {data.fiador_cpf && <Text style={styles.assinaturaCpf}>CPF {data.fiador_cpf}</Text>}
            </View>
          )}

          {/* Testemunhas */}
          <Text style={styles.testemunhaTit}>Testemunhas</Text>
          {(data.testemunhas.length > 0 ? data.testemunhas : [null, null]).map((t, i) => (
            <View key={i} style={styles.assinaturaBloco}>
              <LinhaAssinatura imagem={t ? assinaturaDe(data.assinaturas, t.nome) : null} />
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
