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

// Poppins reabilitada — o bug "unsupported number" anterior não vinha
// da fonte e sim de bordas em position:absolute. Mantemos as fontes
// como data URL (base64) pra funcionar em qualquer ambiente.
const fontRegular = tryReadFontAsDataUrl('Poppins-Regular.ttf')
const fontMedium = tryReadFontAsDataUrl('Poppins-Medium.ttf')
const fontBold = tryReadFontAsDataUrl('Poppins-Bold.ttf')

const POPPINS_LOADED = !!(fontRegular && fontBold)
export const FAMILIA = POPPINS_LOADED ? 'Poppins' : 'Helvetica'

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

  /** Tipo de documento — adapta título, partes da capa e resumo.
   *  'locacao' (default) ou 'administracao' (proprietária × administradora). */
  tipo_documento?: 'locacao' | 'administracao'

  /** Linhas customizadas pro bloco RESUMO da capa. Quando presente,
   *  substitui o resumo fixo de aluguel/garantia (usado no de administração). */
  resumo_linhas?: Array<{ label: string; valor: string }>

  /** Quando true, inclui a capa executiva como página 1 do PDF. */
  incluir_capa?: boolean

  /** Resumo financeiro pra capa: aluguel, prazo, datas, garantia. */
  resumo_capa?: {
    aluguel_str: string         // ex: "R$ 2.800,00 / mês"
    prazo_str: string           // ex: "30 meses"
    inicio_str: string          // ex: "01/06/2026"
    termino_str: string         // ex: "30/11/2028"
    garantia_str: string        // ex: "Seguro fiança (TOO Seguros · apólice 186977)"
    seguro_fianca_str?: string  // ex: "R$ 111,11 / mês" — só quando garantia=seguro_fianca
    imovel_endereco: string     // ex: "Rua Tal, 123, apto 502, Araés, Cuiabá-MT"
    imovel_descricao: string    // ex: "Apto 3 quartos, 1 suíte, 1 vaga"
  }

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
  /** Representante da proprietária PJ no contrato de administração (sócio/representante legal que assina). */
  proprietario_representante_nome?: string | null
  proprietario_representante_cpf?: string | null
  proprietario_representante_qualificacao?: string | null
  /** Assinaturas desenhadas (base64) por papel — sobrepostas na linha de cada parte quando assinado pela plataforma. */
  assinaturas_partes?: Array<{ papel: string; imagem: string }>
  /** True quando há administração imobiliária — quem assina é o admin/corretor representando o locador. */
  tem_administracao: boolean
  admin_responsavel_nome: string | null   // nome do corretor (ex: João Victor Vieira)
  admin_responsavel_creci: string | null  // CRECI do corretor

  /** Tipo de atuação do corretor — controla título e bloco de assinatura. */
  tipo_atuacao?: 'administracao' | 'intermediacao' | 'direto'
  /** Se for intermediação, o corretor assina como testemunha/parte. */
  intermediador_assina?: boolean
  /** Finalidade da locação — adapta título do PDF e algumas cláusulas. */
  finalidade?: 'residencial' | 'comercial' | 'misto'

  locatario_nome: string
  locatario_cpf: string | null
  conjuge_nome: string | null
  conjuge_cpf: string | null
  /** Papel do cônjuge: solidario (locatária solidária) | anuente | nao_participa */
  conjuge_papel?: 'solidario' | 'anuente' | 'nao_participa'
  /** Qualificação completa do cônjuge pro corpo (gerada em montar.ts) */
  conjuge_qualificacao?: string | null

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

  // Inventário de bens (imóvel mobiliado) — tabela item a item
  inventario?: Array<{
    descricao: string
    quantidade: number
    marca_modelo: string | null
    estado: string | null
    observacao: string | null
  }>

  // Quadro financeiro de entrada (caução + 1º aluguel + IPTU)
  quadro_entrada: Array<{ descricao: string; base: string; valor: string; obs?: string }>

  // Tabela dos 12 primeiros meses — colunas dinâmicas conforme o que é cobrado separado
  tabela_12_meses: {
    colunas: {
      iptu: boolean        // mostrar coluna IPTU? (só se iptu_mensal > 0 e NÃO incluso)
      condominio: boolean  // idem condomínio
      seguro: boolean      // idem seguro fiança mensal
    }
    linhas: Array<{
      parcela: number
      periodo: string
      vencimento: string
      aluguel: string
      iptu: string | null         // null = sem coluna
      condominio: string | null
      seguro: string | null
      total: string
    }>
  }

  // Termo de entrega de chaves (página separada)
  termo_chaves: {
    endereco_imovel: string
    data_entrega: string  // dd/mm/yyyy
    qtd_chaves: number
    qtd_controles: number
    qtd_tags: number
    /** Quem recebe a posse: locatário(s) + co-locatários + ocupantes que moram.
     *  Responsável pelo seguro que não mora NÃO entra aqui. */
    recebedores: Array<{ nome: string; cpf: string | null }>
  } | null
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

/**
 * Formata a cláusula com numeração jurídica:
 *  - Título: "CLÁUSULA Nª — TÍTULO EM MAIÚSCULA"
 *  - Parágrafos (que começam com "Parágrafo primeiro/segundo/único.") viram
 *    "N.1.", "N.2.", … mantendo o caput sem número.
 *  Incisos (I., II., …) dentro dos parágrafos não são alterados.
 */
function formatarClausulaNumerada(num: number, titulo: string, corpo: string): { titulo: string; corpo: string } {
  const tituloFmt = `CLÁUSULA ${num}ª — ${titulo.toUpperCase()}`
  const blocos = corpo.split(/\n\n+/)
  let p = 0
  const corpoFmt = blocos.map(bloco => {
    const t = bloco.trim()
    if (!t) return ''
    // Incisos / itens de lista NÃO recebem numeração de parágrafo:
    //   romanos (I. II. III.), letras (a) b)), números (1. 2)) no início
    if (/^([IVXLCDM]{1,5}\.|[a-zA-Z]\)|\d+[.)])\s/.test(t)) return t
    // Remove prefixo redundante "Parágrafo primeiro/segundo/único." se houver
    const semPrefixo = t.replace(/^Par[áa]grafo\s+[^.]+\.\s*/i, '')
    // Numera todos os parágrafos sequencialmente, incluindo o caput (N.1)
    p++
    return `${num}.${p}. ${semPrefixo}`
  }).filter(Boolean).join('\n\n')
  return { titulo: tituloFmt, corpo: corpoFmt }
}

// Cores do tema (Poppins + violeta IMOBILIATTO)
const ROXO = '#581c87'
const ROXO_CLARO = '#7c3aed'
const CINZA = '#6b7280'
const CINZA_CLARO = '#9ca3af'
const TEXTO = '#1f2937'
const TEXTO_FORTE = '#111827'

export function ContratoDocument({ data }: { data: ContratoPDFData }) {
  const nomeInst = data.anunciante_razao_social ?? data.anunciante_nome
  const dataExtenso = fmtDataExtenso(data.data_assinatura)
  const cidadeUf = data.anunciante_cidade_uf ?? 'Cuiabá-MT'

  // Subtítulo do contrato muda conforme tipo de atuação:
  // - administracao: "com Administração Imobiliária" (default)
  // - intermediacao: "(intermediado por X)"
  // - direto:        "Direta entre Locador e Locatário"
  const isAdmin = data.tipo_documento === 'administracao'
  const atuacao = data.tipo_atuacao ?? (data.tem_administracao ? 'administracao' : 'administracao')

  // Assinaturas desenhadas (plataforma) — casadas com o bloco pela palavra-chave do papel.
  const assinaturasPartes = data.assinaturas_partes ?? []
  const sigDe = (...kws: string[]): string | null =>
    assinaturasPartes.find(a => kws.some(kw => (a.papel ?? '').toLowerCase().includes(kw)))?.imagem ?? null
  const sigsTestemunha = assinaturasPartes.filter(a => (a.papel ?? '').toLowerCase().includes('testemunh'))
  const ASSIN_IMG = { width: 150, height: 40, objectFit: 'contain' as const, marginBottom: 1 }
  const subtituloContrato = isAdmin
    ? 'com Exclusividade'
    : atuacao === 'administracao' ? 'com Administração Imobiliária' :
      atuacao === 'intermediacao' ? `Intermediada por ${nomeInst}` :
      'Direta entre Locador e Locatário'

  // Título principal adapta pela finalidade do contrato
  const finalidade = data.finalidade ?? 'residencial'
  const tituloFinalidade = isAdmin
    ? 'Contrato de Administração de Imóvel'
    : finalidade === 'comercial' ? 'Contrato de Locação Comercial' :
      finalidade === 'misto'     ? 'Contrato de Locação Residencial e Comercial' :
                                   'Contrato de Locação Residencial'

  // Visual elegante mas sem usar position:absolute + border (que quebrava
  // o render). Cabeçalho aparece só na primeira página; layout linear.
  return (
    <Document
      title={`Contrato ${data.codigo}`}
      author={nomeInst}
      subject={`${tituloFinalidade} — ${data.locatario_nome}`}
    >
      {/* ════════ Capa executiva (página 1, opcional) ════════ */}
      {data.incluir_capa !== false && (
        <Page
          size="A4"
          style={{
            paddingTop: 56, paddingBottom: 56, paddingLeft: 56, paddingRight: 56,
            fontSize: 10, fontFamily: FAMILIA, color: TEXTO, lineHeight: 1.5,
          }}
        >
          {/* Cabeçalho institucional */}
          <View style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {data.anunciante_logo_url && (
                <Image src={data.anunciante_logo_url} style={{ width: 44, height: 44, objectFit: 'contain' }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontFamily: FAMILIA, fontWeight: 'bold', color: TEXTO_FORTE }}>
                  {nomeInst}
                  {data.anunciante_creci_juridico ? ` — CRECI-J ${data.anunciante_creci_juridico}` : ''}
                </Text>
                {data.anunciante_creci && (
                  <Text style={{ fontSize: 8, color: CINZA }}>
                    {data.anunciante_nome} — Corretor de Imóveis | CRECI {data.anunciante_creci}
                  </Text>
                )}
                {data.anunciante_endereco && (
                  <Text style={{ fontSize: 8, color: CINZA }}>{data.anunciante_endereco}</Text>
                )}
                {data.anunciante_cnpj && (
                  <Text style={{ fontSize: 8, color: CINZA }}>CNPJ {data.anunciante_cnpj}</Text>
                )}
              </View>
            </View>
            <View style={{ height: 1.5, backgroundColor: ROXO_CLARO, marginTop: 8 }} />
          </View>

          {/* Título grande */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{
              fontSize: 9, fontFamily: FAMILIA, fontWeight: 'bold', color: ROXO_CLARO,
              textAlign: 'center', letterSpacing: 1.6, marginBottom: 4,
            }}>
              INSTRUMENTO PARTICULAR
            </Text>
            <Text style={{
              fontSize: 16, fontFamily: FAMILIA, fontWeight: 'bold', color: TEXTO_FORTE,
              textAlign: 'center', lineHeight: 1.2, marginBottom: 2,
            }}>
              {tituloFinalidade}{'\n'}{subtituloContrato}
            </Text>
            {data.resumo_capa?.garantia_str && (
              <Text style={{
                fontSize: 9.5, fontFamily: FAMILIA, color: CINZA,
                textAlign: 'center', marginTop: 3,
              }}>
                Garantia: {data.resumo_capa.garantia_str}
              </Text>
            )}
            <Text style={{
              fontSize: 10, fontFamily: FAMILIA, fontWeight: 'bold', color: CINZA_CLARO,
              textAlign: 'center', letterSpacing: 1.2, marginTop: 8,
            }}>
              Nº {data.codigo}
            </Text>
          </View>

          {/* Partes */}
          <View style={{ marginBottom: 8 }}>
            <Text style={{
              fontSize: 9, fontFamily: FAMILIA, fontWeight: 'bold', color: ROXO,
              letterSpacing: 1, marginBottom: 8,
            }}>
              PARTES
            </Text>
            <View style={{ height: 0.6, backgroundColor: '#e5e7eb', marginBottom: 8 }} />
            <PartesCapa
              tipoAtuacao={atuacao}
              data={data}
            />
          </View>

          {/* Imóvel */}
          {data.resumo_capa?.imovel_endereco && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{
                fontSize: 9, fontFamily: FAMILIA, fontWeight: 'bold', color: ROXO,
                letterSpacing: 1, marginBottom: 8,
              }}>
                IMÓVEL
              </Text>
              <View style={{ height: 0.6, backgroundColor: '#e5e7eb', marginBottom: 8 }} />
              <Text style={{ fontSize: 10, color: TEXTO, lineHeight: 1.55 }}>
                {data.resumo_capa.imovel_endereco}
              </Text>
              {data.resumo_capa.imovel_descricao && (
                <Text style={{ fontSize: 9, color: CINZA, marginTop: 3 }}>
                  {data.resumo_capa.imovel_descricao}
                </Text>
              )}
            </View>
          )}

          {/* Resumo */}
          {data.resumo_capa && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{
                fontSize: 9, fontFamily: FAMILIA, fontWeight: 'bold', color: ROXO,
                letterSpacing: 1, marginBottom: 8,
              }}>
                RESUMO
              </Text>
              <View style={{ height: 0.6, backgroundColor: '#e5e7eb', marginBottom: 8 }} />
              {data.resumo_linhas && data.resumo_linhas.length > 0 ? (
                data.resumo_linhas.map((l, i) => (
                  <ResumoCapaLinha key={i} label={l.label} valor={l.valor} />
                ))
              ) : (
                <>
                  <ResumoCapaLinha label="Aluguel"  valor={data.resumo_capa.aluguel_str} />
                  <ResumoCapaLinha label="Prazo"    valor={data.resumo_capa.prazo_str} />
                  <ResumoCapaLinha label="Início"   valor={data.resumo_capa.inicio_str} />
                  <ResumoCapaLinha label="Término"  valor={data.resumo_capa.termino_str} />
                  <ResumoCapaLinha label="Garantia" valor={data.resumo_capa.garantia_str} />
                  {data.resumo_capa.seguro_fianca_str && (
                    <ResumoCapaLinha label="Seguro fiança" valor={data.resumo_capa.seguro_fianca_str} />
                  )}
                </>
              )}
            </View>
          )}

          <Text style={{
            fontSize: 10, fontFamily: FAMILIA, fontWeight: 'bold', color: TEXTO_FORTE,
            textAlign: 'center', marginTop: 10,
          }}>
            {cidadeUf}, {dataExtenso}.
          </Text>
        </Page>
      )}

      <Page
        size="A4"
        style={{
          paddingTop: 56,
          paddingBottom: 56,
          paddingLeft: 56,
          paddingRight: 56,
          fontSize: 10,
          fontFamily: FAMILIA,
          color: TEXTO,
          lineHeight: 1.55,
        }}
      >
        {/* Rodapé fixo desativado novamente — combinação Text fixed +
           position absolute reincide no bug "unsupported number" em
           renderText. Mantemos rodapé estático só no final da página. */}

        {/* ── Cabeçalho institucional (só quando NÃO há capa) ──
           A capa já tem seu próprio cabeçalho institucional. Repetir aqui
           dobra o conteúdo e empurra o sumário (causando folha quase em
           branco entre capa e sumário). Só renderiza quando incluir_capa=false. */}
        {data.incluir_capa === false && (
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {data.anunciante_logo_url && (
                <Image
                  src={data.anunciante_logo_url}
                  style={{ width: 56, height: 56, objectFit: 'contain' }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontFamily: FAMILIA, fontWeight: 'bold', color: TEXTO_FORTE }}>
                  {nomeInst}
                  {data.anunciante_creci_juridico ? ` — CRECI-J ${data.anunciante_creci_juridico}` : ''}
                </Text>
                {data.anunciante_creci && (
                  <Text style={{ fontSize: 8, color: CINZA }}>
                    {data.anunciante_nome} — Corretor de Imóveis | CRECI {data.anunciante_creci}
                  </Text>
                )}
                {data.anunciante_endereco && (
                  <Text style={{ fontSize: 8, color: CINZA }}>{data.anunciante_endereco}</Text>
                )}
                {data.anunciante_cnpj && (
                  <Text style={{ fontSize: 8, color: CINZA }}>CNPJ {data.anunciante_cnpj}</Text>
                )}
              </View>
            </View>
            <View style={{ height: 1.5, backgroundColor: ROXO_CLARO, marginTop: 8 }} />
          </View>
        )}

        {/* Paginação removida temporariamente — `fixed` + `render` estava
           causando bug "unsupported number" em algumas combinações de
           conteúdo. Rodapé só no final do documento (no bloco final). */}

        {/* ── Título — só quando NÃO há capa (senão é redundante com a capa) ── */}
        {data.incluir_capa === false && (
          <>
            <View style={{ marginBottom: 22 }}>
              <Text style={{
                fontSize: 8,
                fontFamily: FAMILIA,
                fontWeight: 'bold',
                color: ROXO_CLARO,
                textAlign: 'center',
                letterSpacing: 1.4,
                marginBottom: 8,
              }}>
                INSTRUMENTO PARTICULAR
              </Text>
              <Text style={{
                fontSize: 17,
                fontFamily: FAMILIA,
                fontWeight: 'bold',
                color: TEXTO_FORTE,
                textAlign: 'center',
                lineHeight: 1.25,
                marginBottom: 8,
              }}>
                {tituloFinalidade}{'\n'}{subtituloContrato}
              </Text>
              <Text style={{ fontSize: 10, color: CINZA, textAlign: 'center' }}>
                {data.locatario_nome}
              </Text>
              <Text style={{
                fontSize: 8,
                fontFamily: FAMILIA,
                fontWeight: 'bold',
                color: CINZA_CLARO,
                textAlign: 'center',
                letterSpacing: 0.6,
                marginTop: 6,
              }}>
                Nº {data.codigo}
              </Text>
            </View>
            <View style={{ height: 0.8, backgroundColor: '#e5e7eb', marginBottom: 22 }} />
          </>
        )}

        {/* ── Sumário (índice das cláusulas) ──
           Sem wrap={false}: o react-pdf, quando decide que o bloco "não cabe",
           empurra pra próxima página deixando a anterior visualmente em branco
           (só com o cabeçalho). O sumário é pequeno e cabe naturalmente; se
           algum dia crescer demais, fica melhor quebrar entre páginas do que
           gerar uma folha em branco. */}
        {data.clausulas.length > 0 && (
          <View style={{ marginBottom: 22 }}>
            <Text style={{
              fontSize: 11, fontFamily: FAMILIA, fontWeight: 'bold', color: TEXTO_FORTE,
              marginBottom: 8, letterSpacing: 0.3,
            }}>
              SUMÁRIO
            </Text>
            {data.clausulas.map((c, idx) => (
              <View key={idx} style={{ flexDirection: 'row', paddingVertical: 1.5 }}>
                <Text style={{ width: 60, fontSize: 9, color: COR.acento, fontFamily: FAMILIA, fontWeight: 'bold' }}>
                  Cláusula {idx + 1}ª
                </Text>
                <Text style={{ flex: 1, fontSize: 9, color: TEXTO, fontFamily: FAMILIA }}>
                  {c.titulo}
                </Text>
              </View>
            ))}
            <Text style={{ fontSize: 7.5, color: CINZA_CLARO, marginTop: 6 }}>
              Use o painel de marcadores do leitor de PDF pra navegar direto a cada cláusula.
            </Text>
          </View>
        )}

        {/* Cláusulas começam em página própria (após capa + sumário) */}
        {data.clausulas.length > 0 && <View break />}

        {/* ── Cláusulas ──
           Título "CLÁUSULA Nª — TÍTULO" + parágrafos numerados N.1, N.2…
           bookmark = entrada navegável no painel de marcadores do PDF.
           Sem wrap={false} no wrapper: cláusulas longas não sobrepõem. */}
        {data.clausulas.map((c, idx) => {
          const num = idx + 1
          const fmt = formatarClausulaNumerada(num, c.titulo, c.corpo)
          // bookmark existe no runtime do react-pdf v4 mas o @types não expõe
          const bookmarkProp = { bookmark: { title: `${num}. ${c.titulo}`, fit: true } } as Record<string, unknown>
          return (
            <View key={idx} style={{ marginBottom: 14 }} {...bookmarkProp}>
              <View wrap={false} minPresenceAhead={30}>
                <Text style={{
                  fontSize: 10.5,
                  fontFamily: FAMILIA,
                  fontWeight: 'bold',
                  color: TEXTO_FORTE,
                  marginBottom: 5,
                  letterSpacing: 0.2,
                }}>
                  {fmt.titulo}
                </Text>
              </View>
              <Text style={{
                fontSize: 10,
                fontFamily: FAMILIA,
                color: TEXTO,
                textAlign: 'justify',
                lineHeight: 1.6,
              }}>
                {fmt.corpo}
              </Text>
            </View>
          )
        })}

        {/* ── Inventário de bens (imóvel mobiliado) ── */}
        {data.inventario && data.inventario.length > 0 && (
          <View break style={{ marginTop: 0 }}>
            <Text style={{ fontSize: 11.5, fontFamily: FAMILIA, fontWeight: 'bold', color: TEXTO_FORTE, marginBottom: 4 }}>
              Inventário de bens do imóvel
            </Text>
            <Text style={{ fontSize: 8, color: CINZA_CLARO, marginBottom: 8 }}>
              Os bens abaixo integram a locação e serão conferidos item a item na vistoria final.
            </Text>
            <View>
              <View style={{ flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 5, paddingHorizontal: 6 }}>
                <Text style={{ width: 24, fontSize: 8, fontWeight: 'bold', color: CINZA, textAlign: 'center' }}>#</Text>
                <Text style={{ flex: 4, fontSize: 8, fontWeight: 'bold', color: CINZA }}>ITEM</Text>
                <Text style={{ width: 30, fontSize: 8, fontWeight: 'bold', color: CINZA, textAlign: 'center' }}>QTD</Text>
                <Text style={{ flex: 3, fontSize: 8, fontWeight: 'bold', color: CINZA }}>MARCA/MODELO</Text>
                <Text style={{ flex: 2, fontSize: 8, fontWeight: 'bold', color: CINZA }}>ESTADO</Text>
              </View>
              {data.inventario.map((it, i) => (
                <View key={i} style={{ flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, backgroundColor: i % 2 === 1 ? '#fafafa' : undefined }}>
                  <Text style={{ width: 24, fontSize: 9, color: CINZA, textAlign: 'center' }}>{i + 1}</Text>
                  <Text style={{ flex: 4, fontSize: 9, color: TEXTO }}>
                    {it.descricao}{it.observacao ? ` (${it.observacao})` : ''}
                  </Text>
                  <Text style={{ width: 30, fontSize: 9, color: TEXTO, textAlign: 'center' }}>{it.quantidade}</Text>
                  <Text style={{ flex: 3, fontSize: 9, color: CINZA }}>{it.marca_modelo ?? '—'}</Text>
                  <Text style={{ flex: 2, fontSize: 9, color: CINZA }}>{it.estado ?? '—'}</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 8, color: CINZA_CLARO, marginTop: 5 }}>
              Os LOCATÁRIOS declaram receber os bens no estado descrito e obrigam-se a devolvê-los nas mesmas condições, ressalvado o desgaste natural.
            </Text>
          </View>
        )}

        {/* ── Quadro financeiro de entrada ──
           `break` força nova página antes deste bloco. Resolve o bug em que
           múltiplos `wrap={false}` próximos (cláusulas + quadro + tabela)
           geram sobreposição de coordenadas no react-pdf. */}
        {data.quadro_entrada.length > 0 && (
          <View break style={{ marginTop: 0 }}>
            <Text style={{
              fontSize: 11.5,
              fontFamily: FAMILIA,
              fontWeight: 'bold',
              color: TEXTO_FORTE,
              marginBottom: 8,
            }}>
              Quadro financeiro de entrada
            </Text>
            <View>
              {/* cabeçalho */}
              <View style={{ flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 5, paddingHorizontal: 6 }}>
                <Text style={{ flex: 3, fontSize: 8, fontWeight: 'bold', color: CINZA }}>DESCRIÇÃO</Text>
                <Text style={{ flex: 2, fontSize: 8, fontWeight: 'bold', color: CINZA }}>BASE</Text>
                <Text style={{ flex: 2, fontSize: 8, fontWeight: 'bold', color: CINZA, textAlign: 'right' }}>VALOR</Text>
              </View>
              {data.quadro_entrada.map((r, i) => (
                <View key={i} style={{
                  flexDirection: 'row',
                  paddingVertical: 5,
                  paddingHorizontal: 6,
                  backgroundColor: i === data.quadro_entrada.length - 1 ? '#faf5ff' : undefined,
                }}>
                  <Text style={{
                    flex: 3,
                    fontSize: 9.5,
                    fontWeight: i === data.quadro_entrada.length - 1 ? 'bold' : 'normal',
                    color: TEXTO,
                  }}>
                    {r.descricao}
                  </Text>
                  <Text style={{ flex: 2, fontSize: 9, color: CINZA }}>{r.base}</Text>
                  <Text style={{
                    flex: 2,
                    fontSize: 9.5,
                    fontWeight: i === data.quadro_entrada.length - 1 ? 'bold' : 'normal',
                    color: TEXTO_FORTE,
                    textAlign: 'right',
                  }}>
                    {r.valor}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 8, color: CINZA_CLARO, marginTop: 5 }}>
              Valores devidos no ato da assinatura e antes da entrega das chaves.
            </Text>
          </View>
        )}

        {/* ── Tabela dos 12 primeiros meses ── */}
        {data.tabela_12_meses.linhas.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={{
              fontSize: 11.5,
              fontFamily: FAMILIA,
              fontWeight: 'bold',
              color: TEXTO_FORTE,
              marginBottom: 8,
            }}>
              Tabela dos 12 primeiros meses
            </Text>
            <View>
              <View style={{ flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 5, paddingHorizontal: 6 }}>
                <Text style={{ width: 30, fontSize: 8, fontWeight: 'bold', color: CINZA, textAlign: 'center' }}>#</Text>
                <Text style={{ flex: 3, fontSize: 8, fontWeight: 'bold', color: CINZA }}>PERÍODO</Text>
                <Text style={{ flex: 2, fontSize: 8, fontWeight: 'bold', color: CINZA }}>VENCIMENTO</Text>
                <Text style={{ flex: 2, fontSize: 8, fontWeight: 'bold', color: CINZA, textAlign: 'right' }}>ALUGUEL</Text>
                {data.tabela_12_meses.colunas.iptu && (
                  <Text style={{ flex: 2, fontSize: 8, fontWeight: 'bold', color: CINZA, textAlign: 'right' }}>IPTU</Text>
                )}
                {data.tabela_12_meses.colunas.condominio && (
                  <Text style={{ flex: 2, fontSize: 8, fontWeight: 'bold', color: CINZA, textAlign: 'right' }}>CONDOM.</Text>
                )}
                {data.tabela_12_meses.colunas.seguro && (
                  <Text style={{ flex: 2, fontSize: 8, fontWeight: 'bold', color: CINZA, textAlign: 'right' }}>SEG. FIANÇA</Text>
                )}
                <Text style={{ flex: 2, fontSize: 8, fontWeight: 'bold', color: CINZA, textAlign: 'right' }}>TOTAL</Text>
              </View>
              {data.tabela_12_meses.linhas.map((p, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    paddingVertical: 4,
                    paddingHorizontal: 6,
                    backgroundColor: i % 2 === 1 ? '#fafafa' : undefined,
                  }}
                >
                  <Text style={{ width: 30, fontSize: 9, color: CINZA, textAlign: 'center' }}>{p.parcela}</Text>
                  <Text style={{ flex: 3, fontSize: 9, color: TEXTO }}>{p.periodo}</Text>
                  <Text style={{ flex: 2, fontSize: 9, color: TEXTO }}>{p.vencimento}</Text>
                  <Text style={{ flex: 2, fontSize: 9, color: TEXTO, textAlign: 'right' }}>{p.aluguel}</Text>
                  {data.tabela_12_meses.colunas.iptu && (
                    <Text style={{ flex: 2, fontSize: 9, color: TEXTO, textAlign: 'right' }}>{p.iptu ?? ''}</Text>
                  )}
                  {data.tabela_12_meses.colunas.condominio && (
                    <Text style={{ flex: 2, fontSize: 9, color: TEXTO, textAlign: 'right' }}>{p.condominio ?? ''}</Text>
                  )}
                  {data.tabela_12_meses.colunas.seguro && (
                    <Text style={{ flex: 2, fontSize: 9, color: TEXTO, textAlign: 'right' }}>{p.seguro ?? ''}</Text>
                  )}
                  <Text style={{ flex: 2, fontSize: 9, color: TEXTO_FORTE, fontWeight: 'bold', textAlign: 'right' }}>{p.total}</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 8, color: CINZA_CLARO, marginTop: 5 }}>
              Após esse período, o aluguel será reajustado anualmente conforme cláusula de reajuste.
            </Text>
          </View>
        )}

        {/* ── Cláusulas da seguradora ── */}
        {data.clausulas_seguradora_texto && (
          <View style={{ marginTop: 22 }}>
            <View style={{ height: 0.8, backgroundColor: '#e5e7eb', marginBottom: 12 }} />
            <Text style={{
              fontSize: 13,
              fontFamily: FAMILIA,
              fontWeight: 'bold',
              color: TEXTO_FORTE,
              textAlign: 'center',
              letterSpacing: 0.5,
              marginBottom: 12,
            }}>
              CLÁUSULAS DA SEGURADORA
            </Text>
            <Text style={{
              fontSize: 10,
              fontFamily: FAMILIA,
              color: TEXTO,
              textAlign: 'justify',
              lineHeight: 1.6,
            }}>
              {data.clausulas_seguradora_texto}
            </Text>
          </View>
        )}

        {/* ── Folha de assinatura ──
           `break` garante página dedicada pra assinatura (evita estouro
           visual quando a seguradora ocupa muito espaço). */}
        <View break style={{ marginTop: 0 }}>
          <View style={{ height: 0.8, backgroundColor: '#e5e7eb', marginBottom: 16 }} />

          <Text style={{
            fontSize: 10,
            fontFamily: FAMILIA,
            color: TEXTO,
            textAlign: 'justify',
            lineHeight: 1.6,
            marginBottom: 14,
          }}>
            E, por estarem justos e contratados, plenamente cientes da seriedade das obrigações
            assumidas, assinam o presente instrumento digitalmente, em vias de igual teor,
            juntamente com 02 (duas) testemunhas.
          </Text>

          <Text style={{
            fontSize: 10.5,
            fontFamily: FAMILIA,
            fontWeight: 'bold',
            color: TEXTO_FORTE,
            textAlign: 'center',
            marginVertical: 18,
          }}>
            {cidadeUf}, {dataExtenso}.
          </Text>

          {/* ═══ Contrato de administração: ADMINISTRADORA × PROPRIETÁRIA ═══ */}
          {isAdmin ? (
            <>
              <View style={{ marginBottom: 22 }}>
                <Text style={blocoPapel}>ADMINISTRADORA</Text>
                <Text style={blocoNome}>{data.admin_responsavel_nome ?? nomeInst}</Text>
                {data.admin_responsavel_creci && (
                  <Text style={blocoSecundario}>Corretor(a) responsável — CRECI {data.admin_responsavel_creci}</Text>
                )}
                <Text style={blocoSecundario}>
                  {nomeInst}{data.anunciante_cnpj ? ` — CNPJ ${data.anunciante_cnpj}` : ''}
                </Text>
                {sigDe('administrador') && <Image src={sigDe('administrador')!} style={ASSIN_IMG} />}
                <View style={linhaAssinatura} />
              </View>
              <View style={{ marginBottom: 22 }}>
                <Text style={blocoPapel}>PROPRIETÁRIA(O)</Text>
                <Text style={blocoNome}>{data.locador_nome}</Text>
                {data.locador_cpf && <Text style={blocoSecundario}>CPF/CNPJ {data.locador_cpf}</Text>}
                {data.proprietario_representante_nome && (
                  <Text style={blocoSecundario}>
                    Representada por {data.proprietario_representante_nome}
                    {data.proprietario_representante_cpf ? ` — CPF ${data.proprietario_representante_cpf}` : ''}
                    {` (${data.proprietario_representante_qualificacao?.trim() || 'representante legal'})`}
                  </Text>
                )}
                {sigDe('representante', 'propriet') && <Image src={sigDe('representante', 'propriet')!} style={ASSIN_IMG} />}
                <View style={linhaAssinatura} />
              </View>
            </>
          ) : (
          <>
          {/* Locador / Administradora / Intermediador (conforme tipo de atuação) */}
          {atuacao === 'administracao' && data.tem_administracao ? (
            <View style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>LOCADOR / ADMINISTRADORA</Text>
              <Text style={blocoNome}>{data.admin_responsavel_nome ?? data.locador_nome}</Text>
              {data.admin_responsavel_creci && (
                <Text style={blocoSecundario}>CRECI {data.admin_responsavel_creci}</Text>
              )}
              <Text style={blocoSecundario}>
                Representando: {data.locador_nome}
                {data.locador_cpf ? ` — CPF ${data.locador_cpf}` : ''}
              </Text>
              {sigDe('administrador', 'locador') && <Image src={sigDe('administrador', 'locador')!} style={ASSIN_IMG} />}
              <View style={linhaAssinatura} />
            </View>
          ) : (
            <View style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>LOCADOR</Text>
              <Text style={blocoNome}>{data.locador_nome}</Text>
              {data.locador_cpf && <Text style={blocoSecundario}>CPF {data.locador_cpf}</Text>}
              {sigDe('locador') && <Image src={sigDe('locador')!} style={ASSIN_IMG} />}
              <View style={linhaAssinatura} />
            </View>
          )}

          {/* Locatário */}
          <View style={{ marginBottom: 22 }}>
            <Text style={blocoPapel}>LOCATÁRIO</Text>
            <Text style={blocoNome}>{data.locatario_nome}</Text>
            {data.locatario_cpf && <Text style={blocoSecundario}>CPF {data.locatario_cpf}</Text>}
            {sigDe('locatári') && <Image src={sigDe('locatári')!} style={ASSIN_IMG} />}
            <View style={linhaAssinatura} />
          </View>

          {/* Intermediador (só se atuação for intermediação E corretor optou por assinar) */}
          {atuacao === 'intermediacao' && data.intermediador_assina && data.admin_responsavel_nome && (
            <View style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>INTERMEDIADOR(A)</Text>
              <Text style={blocoNome}>{data.admin_responsavel_nome}</Text>
              {data.admin_responsavel_creci && (
                <Text style={blocoSecundario}>CRECI {data.admin_responsavel_creci}</Text>
              )}
              <Text style={blocoSecundario}>{nomeInst}</Text>
              {sigDe('intermediador') && <Image src={sigDe('intermediador')!} style={ASSIN_IMG} />}
              <View style={linhaAssinatura} />
            </View>
          )}

          {/* Cônjuge — label conforme papel; 'nao_participa' não assina */}
          {data.conjuge_nome && (data.conjuge_papel ?? 'solidario') !== 'nao_participa' && (
            <View style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>
                {(data.conjuge_papel ?? 'solidario') === 'solidario'
                  ? 'LOCATÁRIA(O) SOLIDÁRIA(O) / CÔNJUGE DO LOCATÁRIO'
                  : 'CÔNJUGE ANUENTE / OCUPANTE AUTORIZADA'}
              </Text>
              <Text style={blocoNome}>{data.conjuge_nome}</Text>
              {data.conjuge_cpf && <Text style={blocoSecundario}>CPF {data.conjuge_cpf}</Text>}
              {sigDe('cônjuge', 'conjuge', 'solidári') && <Image src={sigDe('cônjuge', 'conjuge', 'solidári')!} style={ASSIN_IMG} />}
              <View style={linhaAssinatura} />
            </View>
          )}

          {/* Moradores adicionais */}
          {data.moradores_adicionais.map((m, idx) => (
            <View key={idx} style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>{m.papel.toUpperCase()}</Text>
              <Text style={blocoNome}>{m.nome}</Text>
              {m.cpf && <Text style={blocoSecundario}>CPF {m.cpf}</Text>}
              <View style={linhaAssinatura} />
            </View>
          ))}

          {/* Fiador */}
          {data.fiador_nome && (
            <View style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>FIADOR</Text>
              <Text style={blocoNome}>{data.fiador_nome}</Text>
              {data.fiador_cpf && <Text style={blocoSecundario}>CPF {data.fiador_cpf}</Text>}
              {sigDe('fiador') && <Image src={sigDe('fiador')!} style={ASSIN_IMG} />}
              <View style={linhaAssinatura} />
            </View>
          )}
          </>
          )}

          {/* Testemunhas */}
          {(data.testemunhas.length > 0 ? data.testemunhas : [null, null]).map((t, idx) => (
            <View key={idx} style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>TESTEMUNHA {idx + 1}</Text>
              {t ? (
                <>
                  <Text style={blocoNome}>{t.nome}</Text>
                  {t.cpf && <Text style={blocoSecundario}>CPF {t.cpf}</Text>}
                  {t.rg && <Text style={blocoSecundario}>RG {t.rg}</Text>}
                </>
              ) : (
                <>
                  <Text style={blocoSecundario}>Nome: _____________________________________</Text>
                  <Text style={blocoSecundario}>CPF: ______________________________________</Text>
                </>
              )}
              {sigsTestemunha[idx] && <Image src={sigsTestemunha[idx].imagem} style={ASSIN_IMG} />}
              <View style={linhaAssinatura} />
            </View>
          ))}
        </View>
      </Page>

      {/* ════════ Página separada: Termo de Entrega de Chaves ════════ */}
      {data.termo_chaves && (
        <Page
          size="A4"
          style={{
            paddingTop: 56,
            paddingBottom: 56,
            paddingLeft: 56,
            paddingRight: 56,
            fontSize: 10,
            fontFamily: FAMILIA,
            color: TEXTO,
            lineHeight: 1.55,
          }}
        >
          {/* Cabeçalho institucional (só 1ª página do termo, sem fixed) */}
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {data.anunciante_logo_url && (
                <Image
                  src={data.anunciante_logo_url}
                  style={{ width: 56, height: 56, objectFit: 'contain' }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontFamily: FAMILIA, fontWeight: 'bold', color: TEXTO_FORTE }}>
                  {nomeInst}
                  {data.anunciante_creci_juridico ? ` — CRECI-J ${data.anunciante_creci_juridico}` : ''}
                </Text>
                {data.anunciante_creci && (
                  <Text style={{ fontSize: 8, color: CINZA }}>
                    {data.anunciante_nome} — Corretor de Imóveis | CRECI {data.anunciante_creci}
                  </Text>
                )}
                {data.anunciante_endereco && (
                  <Text style={{ fontSize: 8, color: CINZA }}>{data.anunciante_endereco}</Text>
                )}
                {data.anunciante_cnpj && (
                  <Text style={{ fontSize: 8, color: CINZA }}>CNPJ {data.anunciante_cnpj}</Text>
                )}
              </View>
            </View>
            <View style={{ height: 1.5, backgroundColor: ROXO_CLARO, marginTop: 8 }} />
          </View>

          <View style={{ marginTop: 24, marginBottom: 22 }}>
            <Text style={{
              fontSize: 8,
              fontFamily: FAMILIA,
              fontWeight: 'bold',
              color: ROXO_CLARO,
              textAlign: 'center',
              letterSpacing: 1.4,
              marginBottom: 8,
            }}>
              ANEXO AO CONTRATO {data.codigo}
            </Text>
            <Text style={{
              fontSize: 17,
              fontFamily: FAMILIA,
              fontWeight: 'bold',
              color: TEXTO_FORTE,
              textAlign: 'center',
              letterSpacing: 0.3,
            }}>
              Termo de Entrega de Chaves
            </Text>
          </View>

          <View style={{ height: 0.8, backgroundColor: '#e5e7eb', marginBottom: 18 }} />

          <Text style={{ fontSize: 10, textAlign: 'justify', marginBottom: 12, lineHeight: 1.65 }}>
            Pelo presente Termo, o LOCADOR/ADMINISTRADORA entrega ao LOCATÁRIO, nesta data, as chaves,
            controles, tags e demais meios de ingresso referentes ao imóvel situado em{' '}
            <Text style={{ fontWeight: 'bold' }}>{data.termo_chaves.endereco_imovel}</Text>.
          </Text>

          <Text style={{ fontSize: 10, textAlign: 'justify', marginBottom: 14, lineHeight: 1.65 }}>
            O LOCATÁRIO declara que recebe a posse direta do imóvel em{' '}
            <Text style={{ fontWeight: 'bold' }}>{data.termo_chaves.data_entrega}</Text>, para uso
            exclusivamente residencial, assumindo, a partir desta data, responsabilidade pela guarda,
            conservação, limpeza, pagamento de aluguel, encargos, consumos, tributos, seguros, multas
            e demais obrigações previstas no contrato de locação.
          </Text>

          <Text style={{
            fontSize: 11,
            fontFamily: FAMILIA,
            fontWeight: 'bold',
            color: TEXTO_FORTE,
            marginTop: 10,
            marginBottom: 6,
          }}>
            Itens entregues:
          </Text>

          <View style={{ backgroundColor: '#faf5ff', padding: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 10, marginBottom: 4 }}>
              I. <Text style={{ fontWeight: 'bold' }}>
                {data.termo_chaves.qtd_chaves > 0 ? data.termo_chaves.qtd_chaves : '_____'}
              </Text>{' '}
              chave{data.termo_chaves.qtd_chaves === 1 ? '' : 's'} da porta principal e/ou portão
            </Text>
            <Text style={{ fontSize: 10, marginBottom: 4 }}>
              II. <Text style={{ fontWeight: 'bold' }}>
                {data.termo_chaves.qtd_controles > 0 ? data.termo_chaves.qtd_controles : '_____'}
              </Text>{' '}
              controle{data.termo_chaves.qtd_controles === 1 ? '' : 's'} remoto(s)
            </Text>
            <Text style={{ fontSize: 10 }}>
              III. <Text style={{ fontWeight: 'bold' }}>
                {data.termo_chaves.qtd_tags > 0 ? data.termo_chaves.qtd_tags : '_____'}
              </Text>{' '}
              tag{data.termo_chaves.qtd_tags === 1 ? '' : 's'} / cartão(ões) de acesso
            </Text>
          </View>

          <Text style={{ fontSize: 10, textAlign: 'justify', marginBottom: 24, lineHeight: 1.65 }}>
            O LOCATÁRIO declara ciência de que a devolução do imóvel somente será considerada válida
            mediante entrega formal de todas as chaves, controles, tags e acessos, realização de
            vistoria final e quitação das obrigações pendentes, conforme cláusulas contratuais.
          </Text>

          <Text style={{
            fontSize: 10.5,
            fontFamily: FAMILIA,
            fontWeight: 'bold',
            color: TEXTO_FORTE,
            textAlign: 'center',
            marginVertical: 22,
          }}>
            {cidadeUf}, {dataExtenso}.
          </Text>

          {/* Assinaturas do termo */}
          {data.tem_administracao ? (
            <View style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>LOCADOR / ADMINISTRADORA</Text>
              <Text style={blocoNome}>{data.admin_responsavel_nome ?? data.locador_nome}</Text>
              {data.admin_responsavel_creci && (
                <Text style={blocoSecundario}>CRECI {data.admin_responsavel_creci}</Text>
              )}
              <View style={linhaAssinatura} />
            </View>
          ) : (
            <View style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>LOCADOR</Text>
              <Text style={blocoNome}>{data.locador_nome}</Text>
              <View style={linhaAssinatura} />
            </View>
          )}

          {/* Recebedores das chaves: todos os locatários/moradores que tomam posse.
             Fallback pro locatário principal se a lista vier vazia. */}
          {(data.termo_chaves.recebedores.length > 0
            ? data.termo_chaves.recebedores
            : [{ nome: data.locatario_nome, cpf: data.locatario_cpf }]
          ).map((r, idx, arr) => (
            <View key={idx} style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>
                {arr.length > 1 ? `LOCATÁRIO ${idx + 1} (RECEBI AS CHAVES)` : 'LOCATÁRIO (RECEBI AS CHAVES)'}
              </Text>
              <Text style={blocoNome}>{r.nome}</Text>
              {r.cpf && <Text style={blocoSecundario}>CPF {r.cpf}</Text>}
              <View style={linhaAssinatura} />
            </View>
          ))}
        </Page>
      )}
    </Document>
  )
}

// ── Estilos compartilhados na folha de assinatura ──
const blocoPapel = {
  fontSize: 7.5,
  fontFamily: FAMILIA,
  fontWeight: 'bold' as const,
  color: ROXO,
  letterSpacing: 0.8,
  marginBottom: 3,
}
const blocoNome = {
  fontSize: 10.5,
  fontFamily: FAMILIA,
  fontWeight: 'bold' as const,
  color: TEXTO_FORTE,
  marginBottom: 1,
}
const blocoSecundario = {
  fontSize: 9,
  fontFamily: FAMILIA,
  color: CINZA,
}
const linhaAssinatura = {
  height: 0.6,
  backgroundColor: '#d1d5db',
  marginTop: 14,
}

// ── Helpers da capa executiva ──

function ResumoCapaLinha({ label, valor }: { label: string; valor: string }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 3 }}>
      <Text style={{ width: 90, fontSize: 9, color: '#6b7280', fontFamily: FAMILIA }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 10, color: '#111827', fontFamily: FAMILIA, fontWeight: 'bold' }}>
        {valor || '—'}
      </Text>
    </View>
  )
}

function PartesCapa({
  tipoAtuacao, data,
}: {
  tipoAtuacao: 'administracao' | 'intermediacao' | 'direto'
  data: ContratoPDFData
}) {
  const linhas: Array<{ papel: string; nome: string; cpf: string | null }> = []

  // Contrato de administração: ADMINISTRADORA × PROPRIETÁRIA (sem locatário/fiador)
  if (data.tipo_documento === 'administracao') {
    linhas.push({
      papel: 'Administradora',
      nome: `${data.anunciante_razao_social ?? data.anunciante_nome}${data.admin_responsavel_nome ? ` — rep. ${data.admin_responsavel_nome}` : ''}`,
      cpf: data.anunciante_cnpj,
    })
    linhas.push({
      papel: 'Proprietária(o)',
      nome: data.proprietario_representante_nome
        ? `${data.locador_nome} — rep. ${data.proprietario_representante_nome}`
        : data.locador_nome,
      cpf: data.proprietario_representante_cpf ?? data.locador_cpf,
    })
    return (
      <View>
        {linhas.map((l, i) => (
          <View key={i} style={{ flexDirection: 'row', paddingVertical: 3 }}>
            <Text style={{ width: 100, fontSize: 9, color: '#6b7280', fontFamily: FAMILIA }}>{l.papel}</Text>
            <Text style={{ flex: 1, fontSize: 10, color: '#111827', fontFamily: FAMILIA, fontWeight: 'bold' }}>{l.nome}</Text>
            {l.cpf && (
              <Text style={{ width: 110, fontSize: 9, color: '#6b7280', fontFamily: FAMILIA, textAlign: 'right' }}>{l.cpf}</Text>
            )}
          </View>
        ))}
      </View>
    )
  }

  // Administradora / Intermediador (só se aplicável)
  if (tipoAtuacao === 'administracao' && data.tem_administracao && data.admin_responsavel_nome) {
    linhas.push({
      papel: 'Administradora',
      nome: `${data.anunciante_razao_social ?? data.anunciante_nome} — rep. ${data.admin_responsavel_nome}`,
      cpf: data.anunciante_cnpj,
    })
  } else if (tipoAtuacao === 'intermediacao' && data.intermediador_assina && data.admin_responsavel_nome) {
    linhas.push({
      papel: 'Intermediador(a)',
      nome: `${data.anunciante_razao_social ?? data.anunciante_nome} — rep. ${data.admin_responsavel_nome}`,
      cpf: data.anunciante_cnpj,
    })
  }

  linhas.push({ papel: 'Locador', nome: data.locador_nome, cpf: data.locador_cpf })
  linhas.push({ papel: 'Locatário', nome: data.locatario_nome, cpf: data.locatario_cpf })

  if (data.conjuge_nome && (data.conjuge_papel ?? 'solidario') !== 'nao_participa') {
    linhas.push({
      papel: (data.conjuge_papel ?? 'solidario') === 'solidario' ? 'Locatária solidária' : 'Cônjuge anuente',
      nome: data.conjuge_nome,
      cpf: data.conjuge_cpf,
    })
  }
  for (const m of data.moradores_adicionais) {
    linhas.push({ papel: m.papel, nome: m.nome, cpf: m.cpf })
  }
  if (data.fiador_nome) {
    linhas.push({ papel: 'Fiador', nome: data.fiador_nome, cpf: data.fiador_cpf })
  }

  return (
    <View>
      {linhas.map((l, i) => (
        <View key={i} style={{ flexDirection: 'row', paddingVertical: 3 }}>
          <Text style={{ width: 100, fontSize: 9, color: '#6b7280', fontFamily: FAMILIA }}>
            {l.papel}
          </Text>
          <Text style={{ flex: 1, fontSize: 10, color: '#111827', fontFamily: FAMILIA, fontWeight: 'bold' }}>
            {l.nome}
          </Text>
          {l.cpf && (
            <Text style={{ width: 110, fontSize: 9, color: '#6b7280', fontFamily: FAMILIA, textAlign: 'right' }}>
              {l.cpf}
            </Text>
          )}
        </View>
      ))}
    </View>
  )
}
