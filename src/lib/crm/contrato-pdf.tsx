/* eslint-disable jsx-a11y/alt-text */
import fs from 'fs'
import path from 'path'
import type React from 'react'
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
  modificada?: boolean  // realçada quando o modo modificações está ligado
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
    observacao?: string         // linha livre extra na capa (override do corretor)
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
  assinaturas_partes?: Array<{ papel: string; nome: string; imagem: string }>
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
  /** Quantos campos saem como [PENDENTE] (motor v2). > 0 = minuta de conferência. */
  aviso_pendencias?: number
  /**
   * Diagramação. 'v2': parágrafo a parágrafo (órfãs/viúvas), título preso ao
   * texto, assinatura e linha de tabela indivisíveis, capa corrigida.
   * 'legado' (ou ausente): exatamente o layout anterior — é o que vale pra
   * contrato cujo processo de assinatura começou antes do v2.
   */
  layout?: 'legado' | 'v2'
  /** Contrato de administração: há exclusividade? Muda o subtítulo da capa. */
  exclusividade?: boolean

  // Modo modificações — quadro de destaque + realce das cláusulas alteradas
  mostrar_modificacoes?: boolean
  modificacoes_texto?: string | null

  // Inventário de bens (imóvel mobiliado) — tabela item a item
  inventario?: Array<{
    descricao: string
    quantidade: number
    marca_modelo: string | null
    estado: string | null
    observacao: string | null
    /** Signed URL da foto do bem (v101). null = item sem foto. */
    foto_url?: string | null
  }>
  /** Declaração abaixo do inventário. Ausente = texto legado. */
  inventario_declaracao?: string

  // Quadro financeiro de entrada (caução + 1º aluguel + IPTU)
  quadro_entrada: Array<{ descricao: string; base: string; valor: string; obs?: string }>

  // Tabela dos 12 primeiros meses — colunas dinâmicas conforme o que é cobrado separado
  tabela_12_meses: {
    colunas: {
      iptu: boolean        // mostrar coluna IPTU? (só se iptu_mensal > 0 e NÃO incluso)
      condominio: boolean  // idem condomínio
      seguro: boolean      // idem seguro fiança mensal
    }
    antecipado?: boolean        // pagamento à vista: tabela vira "quitado antecipadamente"
    total_antecipado?: string   // soma dos 12 meses (só usado no modo antecipado)
    linhas: Array<{
      parcela: number
      competencia?: string      // ex.: "Julho/2026" (modo antecipado)
      periodo: string
      vencimento: string
      aluguel: string
      iptu: string | null         // null = sem coluna
      condominio: string | null
      seguro: string | null
      total: string
    }>
    /** Texto abaixo da tabela. Ausente = texto legado (reajuste anual). */
    observacao?: string
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
    recebedores: Array<{ nome: string; cpf: string | null; papel?: string; usuario_autorizado?: boolean; ciencia?: boolean }>
    /** Data de início ainda não chegou e as chaves não foram entregues:
     *  o termo não pode afirmar a entrega como fato consumado. */
    entrega_futura?: boolean
    /** Textos editáveis do termo (capa_overrides). Ausente = texto padrão do layout. */
    titulo?: string
    /** Substitui os parágrafos de entrega e de posse. */
    texto_entrega?: string
    observacoes?: string
    devolucao?: string
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
/**
 * Quebra o texto nos marcadores de pendência do motor v2 e devolve os
 * trechos pendentes como Text vermelho em negrito: "[PENDENTE: CPF DO
 * LOCADOR]". Texto sem marcador sai como string, igual a antes.
 */
// A pontuação colada depois do marcador vai no MESMO trecho e no MESMO
// estilo dele. Qualquer troca de estilo no meio de uma "palavra" ("]," com
// o colchete vermelho e a vírgula preta) vira ponto de quebra pro
// react-pdf, que parte ali com um hífen solto no fim da linha.
const RE_PENDENTE = /\uE000([^\uE001]*)\uE001([.,;:)]*)/
export function textoComPendencias(texto: string): React.ReactNode {
  if (!texto.includes('\uE000')) return texto
  const partes = texto.split(RE_PENDENTE)
  const nos: React.ReactNode[] = []
  for (let i = 0; i < partes.length; i += 3) {
    if (partes[i]) nos.push(partes[i])
    if (i + 1 < partes.length) {
      const pontuacao = partes[i + 2]
      nos.push(
        <Text key={i} style={{ color: '#dc2626', fontWeight: 'bold' }}>
          {`[${partes[i + 1]}]${pontuacao ?? ''}`}
        </Text>,
      )
    }
  }
  return nos
}

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

// Rótulo do documento conforme o número: CNPJ tem 14 dígitos (formatado com "/"),
// CPF tem 11. Usado nos blocos de assinatura/qualificação onde a parte pode ser PJ.
function docLabel(valor: string | null | undefined): string {
  if (!valor) return 'CPF'
  const digitos = valor.replace(/\D/g, '')
  return (digitos.length === 14 || valor.includes('/')) ? 'CNPJ' : 'CPF'
}

export function ContratoDocument({ data }: { data: ContratoPDFData }) {
  const nomeInst = data.anunciante_razao_social ?? data.anunciante_nome
  // A coluna da foto só existe se houver alguma: inventário sem foto
  // nenhuma não deve ganhar uma faixa vazia atravessando a tabela.
  const temFotoNoInventario = (data.inventario ?? []).some(it => !!it.foto_url)
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
  // Casa pela ORDEM das palavras-chave, não pela ordem dos signatários: em
  // contrato com administração quem assina o bloco é a administradora, e um
  // "Locador(a)" avulso na lista não pode roubar o lugar dela.
  const sigDe = (...kws: string[]): string | null => {
    for (const kw of kws) {
      const achou = assinaturasPartes.find(a => (a.papel ?? '').toLowerCase().includes(kw))
      if (achou) return achou.imagem
    }
    return null
  }
  const sigsTestemunha = assinaturasPartes.filter(a => (a.papel ?? '').toLowerCase().includes('testemunh'))
  // Pro termo de chaves, onde os recebedores são vários: casa pelo nome.
  const sigDeNome = (nome: string | null | undefined): string | null => {
    const alvo = (nome ?? '').trim().toLowerCase()
    if (!alvo) return null
    return assinaturasPartes.find(a => (a.nome ?? '').trim().toLowerCase() === alvo)?.imagem ?? null
  }
  const ASSIN_IMG = { width: 150, height: 40, objectFit: 'contain' as const, marginBottom: 1 }
  const v2 = data.layout === 'v2'
  // v2: bloco que não pode ser partido entre páginas (assinatura, linha de tabela).
  const inteiro = v2 ? { wrap: false } : {}
  const subtituloContrato = isAdmin
    ? (v2 && data.exclusividade === false ? 'sem Exclusividade' : 'com Exclusividade')
    : atuacao === 'administracao' ? 'com Administração Imobiliária' :
      atuacao === 'intermediacao' ? `Intermediada por ${nomeInst}` :
      'Direta entre Locador e Locatário'

  // Título principal adapta pela finalidade do contrato
  const finalidade = data.finalidade ?? 'residencial'
  // Frase de uso no Termo de Entrega de Chaves — segue a finalidade do contrato
  const usoFinalidadeTermo =
    finalidade === 'comercial' ? 'exclusivamente comercial (não residencial)'
    : finalidade === 'misto' ? 'misto (residencial e comercial)'
    : 'exclusivamente residencial'
  // Quadro de modificações abre a página de cláusulas quando presente; senão
  // o break vai na 1ª cláusula. Evita o `<View break />` vazio (gerava folha em branco).
  const temQuadroMods = !!(data.mostrar_modificacoes && data.modificacoes_texto)
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
            {/* v2: a garantia já está no quadro-resumo; não repete sob o título. */}
            {!v2 && data.resumo_capa?.garantia_str && (
              <Text style={{
                fontSize: 9.5, fontFamily: FAMILIA, color: CINZA,
                textAlign: 'center', marginTop: 3,
              }}>
                Garantia: {data.resumo_capa.garantia_str}
              </Text>
            )}
            {/* Minuta: a capa avisa antes de qualquer leitura. */}
            {v2 && (data.aviso_pendencias ?? 0) > 0 && (
              <Text style={{
                fontSize: 8.5, fontFamily: FAMILIA, fontWeight: 'bold', color: '#b91c1c',
                textAlign: 'center', letterSpacing: 1, marginTop: 6,
              }}>
                MINUTA PARA CONFERÊNCIA — NÃO ASSINAR
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
            <View wrap={v2 ? false : undefined} style={v2
              ? { marginBottom: 10, backgroundColor: '#faf5ff', borderRadius: 4, paddingVertical: 10, paddingHorizontal: 12 }
              : { marginBottom: 8 }}>
              <Text style={{
                fontSize: 9, fontFamily: FAMILIA, fontWeight: 'bold', color: ROXO,
                letterSpacing: 1, marginBottom: v2 ? 6 : 8,
              }}>
                {v2 ? 'QUADRO-RESUMO' : 'RESUMO'}
              </Text>
              {!v2 && <View style={{ height: 0.6, backgroundColor: '#e5e7eb', marginBottom: 8 }} />}
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

          {/* Observação livre da capa (override do corretor) */}
          {data.resumo_capa?.observacao && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{
                fontSize: 9, fontFamily: FAMILIA, fontWeight: 'bold', color: ROXO,
                letterSpacing: 1, marginBottom: 6,
              }}>
                OBSERVAÇÃO
              </Text>
              <View style={{ height: 0.6, backgroundColor: '#e5e7eb', marginBottom: 6 }} />
              <Text style={{ fontSize: 9.5, color: TEXTO, lineHeight: 1.5, textAlign: 'justify' }}>
                {data.resumo_capa.observacao}
              </Text>
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
                {/* v2: coluna mais larga — "Cláusula 24ª" encostava no título */}
                <Text style={{ width: v2 ? 70 : 60, fontSize: 9, color: COR.acento, fontFamily: FAMILIA, fontWeight: 'bold' }}>
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

        {/* ── Minuta: há campo pendente no texto (motor v2) ── */}
        {(data.aviso_pendencias ?? 0) > 0 && (
          <View style={{
            marginBottom: 18,
            backgroundColor: '#fef2f2',
            borderWidth: 1,
            borderColor: '#fca5a5',
            borderRadius: 4,
            padding: 10,
          }} wrap={false}>
            <Text style={{
              fontSize: 8.5, fontFamily: FAMILIA, fontWeight: 'bold',
              color: '#b91c1c', letterSpacing: 0.5, marginBottom: 3,
            }}>
              MINUTA PARA CONFERÊNCIA — DOCUMENTO NÃO FINALIZADO
            </Text>
            <Text style={{ fontSize: 8.5, fontFamily: FAMILIA, color: '#7f1d1d', lineHeight: 1.4 }}>
              {data.aviso_pendencias === 1
                ? 'Há 1 campo sem informação no cadastro, marcado em vermelho no texto.'
                : `Há ${data.aviso_pendencias} campos sem informação no cadastro, marcados em vermelho no texto.`}
              {' '}Complete os cadastros antes de enviar este contrato para assinatura.
            </Text>
          </View>
        )}

        {/* ── Quadro de modificações/considerações (modo revisão) ──
           Flui logo após o sumário. Só aparece no modo modificações
           (link de revisão sempre liga). */}
        {temQuadroMods && (
          <View style={{
            marginBottom: 18,
            backgroundColor: '#fffbeb',
            borderWidth: 1,
            borderColor: '#fcd34d',
            borderRadius: 4,
            padding: 10,
          }} wrap={false}>
            <Text style={{
              fontSize: 8, fontFamily: FAMILIA, fontWeight: 'bold',
              color: '#b45309', letterSpacing: 0.5, marginBottom: 4,
            }}>
              ⚠ MODIFICAÇÕES E CONSIDERAÇÕES — PARA SUA CIÊNCIA
            </Text>
            <Text style={{
              fontSize: 9.5, fontFamily: FAMILIA, color: '#78350f',
              textAlign: 'justify', lineHeight: 1.5,
            }}>
              {data.modificacoes_texto}
            </Text>
            <Text style={{ fontSize: 7, color: '#b45309', marginTop: 5 }}>
              As cláusulas alteradas estão destacadas em amarelo. Este aviso não consta na via final assinada.
            </Text>
          </View>
        )}

        {/* ── Cláusulas ──
           Título "CLÁUSULA Nª — TÍTULO" + parágrafos numerados N.1, N.2…
           bookmark = entrada navegável no painel de marcadores do PDF.
           Sem wrap={false} no wrapper: cláusulas longas não sobrepõem. */}
        {data.clausulas.map((c, idx) => {
          const num = idx + 1
          const fmt = formatarClausulaNumerada(num, c.titulo, c.corpo)
          // bookmark existe no runtime do react-pdf v4 mas o @types não expõe
          const bookmarkProp = { bookmark: { title: `${num}. ${c.titulo}`, fit: true } } as Record<string, unknown>
          // Realce só quando o modo modificações está ligado e a cláusula foi marcada.
          const realce = !!data.mostrar_modificacoes && !!c.modificada
          return (
            <View
              key={idx}
              style={realce ? {
                marginBottom: 14,
                backgroundColor: '#fffbeb',
                borderLeftWidth: 3,
                borderLeftColor: '#f59e0b',
                borderRadius: 2,
                paddingVertical: 6,
                paddingHorizontal: 8,
              } : { marginBottom: 14 }}
              {...bookmarkProp}
            >
              {v2 ? (() => {
                // Um Text por parágrafo: a quebra de página cai entre
                // parágrafos sempre que dá, e dentro de um parágrafo longo
                // nunca deixa 1 linha sozinha no pé (órfã) nem no topo (viúva).
                // "N.4. Parágrafo. A remuneração…": o texto gerado por alguns
                // placeholders traz um "Parágrafo." sem ordinal que a
                // numeração não reconhece. No v2 ele sai.
                const pars = fmt.corpo.split('\n\n').map(par => par.replace(/^(\d+\.\d+\.\s)Par[áa]grafo\.\s*/, '$1'))
                const paragrafo = (par: string, pi: number) => (
                  <Text
                    key={pi}
                    orphans={2}
                    widows={2}
                    style={{
                      fontSize: 10,
                      fontFamily: FAMILIA,
                      color: TEXTO,
                      textAlign: 'justify',
                      lineHeight: 1.5,
                      marginBottom: pi < pars.length - 1 ? 7 : 0,
                    }}
                  >
                    {textoComPendencias(par)}
                  </Text>
                )
                const titulo = <TituloClausula texto={fmt.titulo} realce={realce} />
                // Título preso ao 1º parágrafo num bloco indivisível: nunca
                // fica sozinho no pé da página. Só quando o parágrafo é
                // curto (~10 linhas) — bloco indivisível maior que o espaço
                // de uma página o react-pdf não consegue posicionar.
                const curto = pars[0].length <= 900
                return (
                  <>
                    {curto
                      ? <View wrap={false}>{titulo}{paragrafo(pars[0], 0)}</View>
                      : <>{titulo}{paragrafo(pars[0], 0)}</>}
                    {pars.slice(1).map((par, i) => paragrafo(par, i + 1))}
                  </>
                )
              })() : (
              <>
              <View wrap={false} minPresenceAhead={30} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 }}>
                <Text style={{
                  flex: 1,
                  fontSize: 10.5,
                  fontFamily: FAMILIA,
                  fontWeight: 'bold',
                  color: TEXTO_FORTE,
                  letterSpacing: 0.2,
                }}>
                  {fmt.titulo}
                </Text>
                {realce && (
                  <Text style={{
                    fontSize: 6.5, fontFamily: FAMILIA, fontWeight: 'bold',
                    color: '#92400e', backgroundColor: '#fde68a',
                    paddingVertical: 1.5, paddingHorizontal: 4, borderRadius: 2,
                    letterSpacing: 0.5, marginLeft: 6,
                  }}>
                    MODIFICADA
                  </Text>
                )}
              </View>
              <Text style={{
                fontSize: 10,
                fontFamily: FAMILIA,
                color: TEXTO,
                textAlign: 'justify',
                lineHeight: 1.6,
              }}>
                {textoComPendencias(fmt.corpo)}
              </Text>
              </>
              )}
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
              {temFotoNoInventario ? ' As fotos ao fim deste anexo identificam os bens entregues.' : ''}
            </Text>
            <View>
              <View style={{ flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 5, paddingHorizontal: 6, alignItems: 'center' }}>
                <Text style={{ width: 24, fontSize: 8, fontWeight: 'bold', color: CINZA, textAlign: 'center' }}>#</Text>
                <Text style={{ flex: 4, fontSize: 8, fontWeight: 'bold', color: CINZA }}>ITEM</Text>
                <Text style={{ width: 30, fontSize: 8, fontWeight: 'bold', color: CINZA, textAlign: 'center' }}>QTD</Text>
                <Text style={{ flex: 3, fontSize: 8, fontWeight: 'bold', color: CINZA }}>MARCA/MODELO</Text>
                <Text style={{ flex: 2, fontSize: 8, fontWeight: 'bold', color: CINZA }}>ESTADO</Text>
              </View>
              {data.inventario.map((it, i) => (
                <View key={i} wrap={false} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 6, backgroundColor: i % 2 === 1 ? '#fafafa' : undefined }}>
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
            {/* Prancha de fotos: a tabela fica compacta e legível, e o bem
                aparece em tamanho que dá pra reconhecer. O número casa com
                a linha da tabela — é por ele que se confere na devolução. */}
            {temFotoNoInventario && (
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 9.5, fontFamily: FAMILIA, fontWeight: 'bold', color: TEXTO_FORTE, marginBottom: 5 }}>
                  Fotos dos bens
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {data.inventario.map((it, i) => it.foto_url ? (
                    <View key={i} wrap={false} style={{ width: '33.33%', paddingRight: 6, marginBottom: 8 }}>
                      <Image src={it.foto_url} style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 3 }} />
                      <Text style={{ fontSize: 8, color: CINZA, marginTop: 2 }}>
                        {i + 1}. {it.descricao}
                      </Text>
                    </View>
                  ) : null)}
                </View>
              </View>
            )}

            <Text style={{ fontSize: 8, color: CINZA_CLARO, marginTop: 5 }}>
              {data.inventario_declaracao ?? 'Os LOCATÁRIOS declaram receber os bens no estado descrito e obrigam-se a devolvê-los nas mesmas condições, ressalvado o desgaste natural.'}
            </Text>
          </View>
        )}

        {/* ── Quadro financeiro de entrada ──
           `break` força nova página antes deste bloco. Resolve o bug em que
           múltiplos `wrap={false}` próximos (cláusulas + quadro + tabela)
           geram sobreposição de coordenadas no react-pdf. */}
        {data.quadro_entrada.length > 0 && (
          <View break={!v2} wrap={v2 ? false : undefined} style={{ marginTop: v2 ? 22 : 0 }}>
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
              <View minPresenceAhead={v2 ? 60 : undefined} style={{ flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 5, paddingHorizontal: 6 }}>
                <Text style={{ flex: 3, fontSize: 8, fontWeight: 'bold', color: CINZA }}>DESCRIÇÃO</Text>
                <Text style={{ flex: 2, fontSize: 8, fontWeight: 'bold', color: CINZA }}>BASE</Text>
                <Text style={{ flex: 2, fontSize: 8, fontWeight: 'bold', color: CINZA, textAlign: 'right' }}>VALOR</Text>
              </View>
              {data.quadro_entrada.map((r, i) => (
                <View key={i} {...inteiro} style={{
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

        {/* ── Tabela de discriminação (pagamento à vista / antecipado) ── */}
        {data.tabela_12_meses.linhas.length > 0 && data.tabela_12_meses.antecipado && (
          <View wrap={v2 ? false : undefined} style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 11.5, fontFamily: FAMILIA, fontWeight: 'bold', color: TEXTO_FORTE, marginBottom: 8 }}>
              Tabela de discriminação dos 12 meses quitados antecipadamente
            </Text>
            <View>
              <View minPresenceAhead={v2 ? 60 : undefined} style={{ flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 5, paddingHorizontal: 6 }}>
                <Text style={{ flex: 2.2, fontSize: 8, fontWeight: 'bold', color: CINZA }}>COMPETÊNCIA</Text>
                <Text style={{ flex: 3, fontSize: 8, fontWeight: 'bold', color: CINZA }}>PERÍODO</Text>
                <Text style={{ flex: 2, fontSize: 8, fontWeight: 'bold', color: CINZA, textAlign: 'right' }}>VALOR MENSAL</Text>
                <Text style={{ flex: 2.6, fontSize: 8, fontWeight: 'bold', color: CINZA, textAlign: 'right' }}>SITUAÇÃO</Text>
              </View>
              {data.tabela_12_meses.linhas.map((p, i) => (
                <View key={i} {...inteiro} style={{ flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, backgroundColor: i % 2 === 1 ? '#fafafa' : undefined }}>
                  <Text style={{ flex: 2.2, fontSize: 9, color: TEXTO }}>{p.competencia ?? ''}</Text>
                  <Text style={{ flex: 3, fontSize: 9, color: TEXTO }}>{p.periodo}</Text>
                  <Text style={{ flex: 2, fontSize: 9, color: TEXTO, textAlign: 'right' }}>{p.total}</Text>
                  <Text style={{ flex: 2.6, fontSize: 8.5, color: '#15803d', textAlign: 'right' }}>Quitado antecipadamente</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: '#e5e7eb', borderTopStyle: 'solid' }}>
                <Text style={{ flex: 7.2, fontSize: 9, fontWeight: 'bold', color: TEXTO_FORTE }}>Valor total quitado antecipadamente</Text>
                <Text style={{ flex: 2.6, fontSize: 9, fontWeight: 'bold', color: TEXTO_FORTE, textAlign: 'right' }}>{data.tabela_12_meses.total_antecipado ?? ''}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 8, color: CINZA_CLARO, marginTop: 6, textAlign: 'justify' }}>
              A presente tabela possui finalidade meramente discriminativa, não representando vencimentos mensais
              ordinários, uma vez que os aluguéis do período foram ajustados para pagamento antecipado em parcela única.
            </Text>
          </View>
        )}

        {/* ── Tabela dos 12 primeiros meses (vencimentos normais) ── */}
        {data.tabela_12_meses.linhas.length > 0 && !data.tabela_12_meses.antecipado && (
          <View wrap={v2 ? false : undefined} style={{ marginTop: 20 }}>
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
              <View minPresenceAhead={v2 ? 60 : undefined} style={{ flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 5, paddingHorizontal: 6 }}>
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
                  {...inteiro}
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
              {data.tabela_12_meses.observacao ?? 'Após esse período, o aluguel será reajustado anualmente conforme cláusula de reajuste.'}
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
              <View {...inteiro} style={{ marginBottom: 22 }}>
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
              <View {...inteiro} style={{ marginBottom: 22 }}>
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
            <View {...inteiro} style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>LOCADOR / ADMINISTRADORA</Text>
              <Text style={blocoNome}>{data.admin_responsavel_nome ?? data.locador_nome}</Text>
              {data.admin_responsavel_creci && (
                <Text style={blocoSecundario}>CRECI {data.admin_responsavel_creci}</Text>
              )}
              <Text style={blocoSecundario}>
                Representando: {data.locador_nome}
                {data.locador_cpf ? ` — ${docLabel(data.locador_cpf)} ${data.locador_cpf}` : ''}
              </Text>
              {sigDe('administrador', 'locador') && <Image src={sigDe('administrador', 'locador')!} style={ASSIN_IMG} />}
              <View style={linhaAssinatura} />
            </View>
          ) : (
            <View {...inteiro} style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>LOCADOR</Text>
              <Text style={blocoNome}>{data.locador_nome}</Text>
              {data.locador_cpf && <Text style={blocoSecundario}>{docLabel(data.locador_cpf)} {data.locador_cpf}</Text>}
              {sigDe('locador') && <Image src={sigDe('locador')!} style={ASSIN_IMG} />}
              <View style={linhaAssinatura} />
            </View>
          )}

          {/* Locatário */}
          <View {...inteiro} style={{ marginBottom: 22 }}>
            <Text style={blocoPapel}>LOCATÁRIO</Text>
            <Text style={blocoNome}>{data.locatario_nome}</Text>
            {data.locatario_cpf && <Text style={blocoSecundario}>{docLabel(data.locatario_cpf)} {data.locatario_cpf}</Text>}
            {sigDe('locatári') && <Image src={sigDe('locatári')!} style={ASSIN_IMG} />}
            <View style={linhaAssinatura} />
          </View>

          {/* Intermediador (só se atuação for intermediação E corretor optou por assinar) */}
          {atuacao === 'intermediacao' && data.intermediador_assina && data.admin_responsavel_nome && (
            <View {...inteiro} style={{ marginBottom: 22 }}>
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
            <View {...inteiro} style={{ marginBottom: 22 }}>
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
            <View key={idx} {...inteiro} style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>{m.papel.toUpperCase()}</Text>
              <Text style={blocoNome}>{m.nome}</Text>
              {m.cpf && <Text style={blocoSecundario}>{docLabel(m.cpf)} {m.cpf}</Text>}
              {/* Casa pelo NOME, e não pelo papel: "Morador" e "Co-locatário
                  solidário" se repetem entre pessoas, e o papel digitado no
                  painel de assinatura nem sempre é o mesmo rótulo do bloco. */}
              {sigDeNome(m.nome) && <Image src={sigDeNome(m.nome)!} style={ASSIN_IMG} />}
              <View style={linhaAssinatura} />
            </View>
          ))}

          {/* Fiador */}
          {data.fiador_nome && (
            <View {...inteiro} style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>FIADOR</Text>
              <Text style={blocoNome}>{data.fiador_nome}</Text>
              {data.fiador_cpf && <Text style={blocoSecundario}>{docLabel(data.fiador_cpf)} {data.fiador_cpf}</Text>}
              {sigDe('fiador') && <Image src={sigDe('fiador')!} style={ASSIN_IMG} />}
              <View style={linhaAssinatura} />
            </View>
          )}
          </>
          )}

          {/* Testemunhas */}
          {(data.testemunhas.length > 0 ? data.testemunhas : [null, null]).map((t, idx) => (
            <View key={idx} {...inteiro} style={{ marginBottom: 22 }}>
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
              {data.termo_chaves.titulo ?? 'Termo de Entrega de Chaves'}
            </Text>
          </View>

          <View style={{ height: 0.8, backgroundColor: '#e5e7eb', marginBottom: 18 }} />

          {data.termo_chaves.texto_entrega ? (
            data.termo_chaves.texto_entrega.split(/\n\s*\n/).map((par, i) => (
              <Text key={`te${i}`} style={{ fontSize: 10, textAlign: 'justify', marginBottom: 12, lineHeight: 1.65 }}>
                {par.replace(/\s*\n\s*/g, ' ')}
              </Text>
            ))
          ) : (<>
          {/* O ramo "não futuro" mantém o JSX original: a árvore do layout
              legado é fotografada em tests/contratos/pdf-diagramacao. */}
          {data.termo_chaves.entrega_futura ? (
            <Text style={{ fontSize: 10, textAlign: 'justify', marginBottom: 12, lineHeight: 1.65 }}>
              Pelo presente Termo, o LOCADOR/ADMINISTRADORA entregará ao LOCATÁRIO, na data da efetiva
              entrega, as chaves, controles, tags e demais meios de ingresso referentes ao imóvel situado em{' '}
              <Text style={{ fontWeight: 'bold' }}>{data.termo_chaves.endereco_imovel}</Text>.
            </Text>
          ) : (
          <Text style={{ fontSize: 10, textAlign: 'justify', marginBottom: 12, lineHeight: 1.65 }}>
            Pelo presente Termo, o LOCADOR/ADMINISTRADORA entrega ao LOCATÁRIO, nesta data, as chaves,
            controles, tags e demais meios de ingresso referentes ao imóvel situado em{' '}
            <Text style={{ fontWeight: 'bold' }}>{data.termo_chaves.endereco_imovel}</Text>.
          </Text>
          )}

          {data.termo_chaves.entrega_futura ? (
            <Text style={{ fontSize: 10, textAlign: 'justify', marginBottom: 14, lineHeight: 1.65 }}>
              O LOCATÁRIO receberá a posse direta do imóvel na data prevista de{' '}
              <Text style={{ fontWeight: 'bold' }}>{data.termo_chaves.data_entrega}</Text>, ou na data da
              efetiva entrega das chaves, se posterior, para uso {usoFinalidadeTermo}, assumindo, a partir
              da efetiva entrega, responsabilidade pela guarda, conservação, limpeza, pagamento de aluguel,
              encargos, consumos, tributos, seguros, multas e demais obrigações previstas no contrato de
              locação. A entrega só se considera realizada com a efetiva tradição das chaves, cuja data será
              registrada pela ADMINISTRADORA, não bastando a assinatura antecipada deste Termo.
            </Text>
          ) : (
            <Text style={{ fontSize: 10, textAlign: 'justify', marginBottom: 14, lineHeight: 1.65 }}>
              O LOCATÁRIO declara que recebe a posse direta do imóvel em{' '}
              <Text style={{ fontWeight: 'bold' }}>{data.termo_chaves.data_entrega}</Text>, para uso{' '}
              {usoFinalidadeTermo}, assumindo, a partir desta data, responsabilidade pela guarda,
              conservação, limpeza, pagamento de aluguel, encargos, consumos, tributos, seguros, multas
              e demais obrigações previstas no contrato de locação.
            </Text>
          )}
          </>)}

          {data.termo_chaves.recebedores.some(r => r.usuario_autorizado) && (
            <Text style={{ fontSize: 10, textAlign: 'justify', marginBottom: 14, lineHeight: 1.65 }}>
              {data.termo_chaves.recebedores.some(r => r.ciencia) ? 'As chaves serão recebidas por' : 'As chaves poderão ser recebidas por'}{' '}
              <Text style={{ fontWeight: 'bold' }}>
                {data.termo_chaves.recebedores.filter(r => r.usuario_autorizado).map(r => r.nome).join(', ')}
              </Text>
              {', na qualidade de '}
              {(data.termo_chaves.recebedores.find(r => r.usuario_autorizado)?.papel ?? 'usuário autorizado').toUpperCase()}
              {data.termo_chaves.recebedores.some(r => r.ciencia)
                ? ', por autorização do LOCATÁRIO e do LOCADOR. O LOCATÁRIO assina este Termo ciente da entrega e permanece como titular da relação locatícia.'
                : ', por autorização do LOCATÁRIO e do LOCADOR, permanecendo o LOCATÁRIO como titular da relação locatícia.'}
            </Text>
          )}

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

          <View style={{ backgroundColor: '#faf5ff', padding: 12, marginBottom: data.termo_chaves.observacoes ? 10 : 16 }}>
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

          {data.termo_chaves.observacoes && (
            <Text style={{ fontSize: 9.5, textAlign: 'justify', marginBottom: 16, lineHeight: 1.6, color: CINZA }}>
              <Text style={{ fontWeight: 'bold', color: TEXTO }}>Observações: </Text>
              {data.termo_chaves.observacoes}
            </Text>
          )}

          <Text style={{ fontSize: 10, textAlign: 'justify', marginBottom: 24, lineHeight: 1.65 }}>
            {data.termo_chaves.devolucao ?? DEVOLUCAO_LEGADO}
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

          {/* Assinaturas do termo — mesmas imagens da folha de assinatura:
             quem assinou pela plataforma assinou o contrato inteiro, e o termo
             de entrega faz parte dele. */}
          {data.tem_administracao ? (
            <View {...inteiro} style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>LOCADOR / ADMINISTRADORA</Text>
              <Text style={blocoNome}>{data.admin_responsavel_nome ?? data.locador_nome}</Text>
              {data.admin_responsavel_creci && (
                <Text style={blocoSecundario}>CRECI {data.admin_responsavel_creci}</Text>
              )}
              {sigDe('administrador', 'locador') && <Image src={sigDe('administrador', 'locador')!} style={ASSIN_IMG} />}
              <View style={linhaAssinatura} />
            </View>
          ) : (
            <View {...inteiro} style={{ marginBottom: 22 }}>
              <Text style={blocoPapel}>LOCADOR</Text>
              <Text style={blocoNome}>{data.locador_nome}</Text>
              {sigDe('locador') && <Image src={sigDe('locador')!} style={ASSIN_IMG} />}
              <View style={linhaAssinatura} />
            </View>
          )}

          {/* Recebedores das chaves: todos os locatários/moradores que tomam posse.
             Fallback pro locatário principal se a lista vier vazia. */}
          {(data.termo_chaves.recebedores.length > 0
            ? data.termo_chaves.recebedores
            : [{ nome: data.locatario_nome, cpf: data.locatario_cpf }]
          ).map((r, idx, arr) => (
            <View key={idx} {...inteiro} style={{ marginBottom: 22 }}>
              {/* Cada recebedor com o papel dele: usuário autorizado não é
                  "Locatário 2". Sem papel (dado antigo), numera como antes. */}
              <Text style={blocoPapel}>
                {r.papel && r.ciencia
                  ? `${r.papel.toUpperCase()} (CIENTE DA ENTREGA)`
                  : r.papel
                  ? `${r.papel.toUpperCase()} (RECEBI AS CHAVES)`
                  : arr.length > 1 ? `LOCATÁRIO ${idx + 1} (RECEBI AS CHAVES)` : 'LOCATÁRIO (RECEBI AS CHAVES)'}
              </Text>
              <Text style={blocoNome}>{r.nome}</Text>
              {r.cpf && <Text style={blocoSecundario}>{docLabel(r.cpf)} {r.cpf}</Text>}
              {/* Casa pelo nome; no caso de um recebedor só, cai no papel. */}
              {(sigDeNome(r.nome) ?? (arr.length === 1 ? sigDe('locatári') : null)) && (
                <Image src={(sigDeNome(r.nome) ?? sigDe('locatári'))!} style={ASSIN_IMG} />
              )}
              <View style={linhaAssinatura} />
            </View>
          ))}
        </Page>
      )}
    </Document>
  )
}

// Igual ao JSX antigo depois do colapso de espaços (fotografia do layout legado).
const DEVOLUCAO_LEGADO = 'O LOCATÁRIO declara ciência de que a devolução do imóvel somente será considerada válida mediante entrega formal de todas as chaves, controles, tags e acessos, realização de vistoria final e quitação das obrigações pendentes, conforme cláusulas contratuais.'

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

/** Título da cláusula no layout v2 ("CLÁUSULA Nª — …" + selo de modificada). */
function TituloClausula({ texto, realce }: { texto: string; realce: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 }}>
      <Text style={{
        flex: 1, fontSize: 10.5, fontFamily: FAMILIA, fontWeight: 'bold',
        color: TEXTO_FORTE, letterSpacing: 0.2,
      }}>
        {texto}
      </Text>
      {realce && (
        <Text style={{
          fontSize: 6.5, fontFamily: FAMILIA, fontWeight: 'bold',
          color: '#92400e', backgroundColor: '#fde68a',
          paddingVertical: 1.5, paddingHorizontal: 4, borderRadius: 2,
          letterSpacing: 0.5, marginLeft: 6,
        }}>
          MODIFICADA
        </Text>
      )}
    </View>
  )
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
      // v2: o documento é o da proprietária (CNPJ, se PJ). O CPF do
      // representante já está no corpo e na assinatura, junto do nome dele.
      cpf: data.layout === 'v2' ? data.locador_cpf : (data.proprietario_representante_cpf ?? data.locador_cpf),
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
    // Coluna do papel é estreita: na capa vai só o nome do papel; a
    // qualidade de interveniente anuente fica na cláusula e na assinatura.
    linhas.push({ papel: m.papel.replace(/ \/ Interveniente anuente$/i, ''), nome: m.nome, cpf: m.cpf })
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
