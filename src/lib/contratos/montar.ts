/**
 * Monta o contrato: pega dados crus (contrato + pessoas + imóvel + admin)
 * e substitui os placeholders nas cláusulas selecionadas.
 *
 * Não decide qual cláusula entra — a ordem vem do clausula_ids do
 * contrato_geracoes. Aqui só preenchemos os {{NOME}} com dados reais.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { PLACEHOLDER_POR_CHAVE, nivelPlaceholder, type NivelPlaceholder } from './placeholders'

export interface DadosContrato {
  // Locador (proprietário)
  locador?: {
    nome?: string | null
    cpf_cnpj?: string | null
    rg?: string | null
    rg_orgao_emissor?: string | null
    rg_uf?: string | null
    nacionalidade?: string | null
    estado_civil?: string | null
    profissao?: string | null
    genero?: string | null
    email?: string | null
    telefone?: string | null
    whatsapp?: string | null
    endereco_logradouro?: string | null
    endereco_numero?: string | null
    endereco_complemento?: string | null
    endereco_bairro?: string | null
    endereco_cidade?: string | null
    endereco_estado?: string | null
    endereco_cep?: string | null
  } | null

  // Locatário
  locatario?: {
    nome?: string | null
    cpf_cnpj?: string | null
    rg?: string | null
    rg_orgao_emissor?: string | null
    rg_uf?: string | null
    nacionalidade?: string | null
    estado_civil?: string | null
    regime_bens?: string | null
    profissao?: string | null
    genero?: string | null
    data_nascimento?: string | null
    naturalidade?: string | null
    nome_pai?: string | null
    nome_mae?: string | null
    email?: string | null
    telefone?: string | null
    whatsapp?: string | null
    endereco_logradouro?: string | null
    endereco_numero?: string | null
    endereco_complemento?: string | null
    endereco_bairro?: string | null
    endereco_cidade?: string | null
    endereco_estado?: string | null
    endereco_cep?: string | null
    conjuge_nome?: string | null
    conjuge_cpf?: string | null
    conjuge_genero?: string | null
    conjuge_rg?: string | null
    conjuge_data_nascimento?: string | null
    conjuge_profissao?: string | null
    conjuge_nacionalidade?: string | null
    conjuge_naturalidade?: string | null
    conjuge_nome_pai?: string | null
    conjuge_nome_mae?: string | null
    conjuge_endereco_logradouro?: string | null
    conjuge_endereco_numero?: string | null
    conjuge_endereco_bairro?: string | null
    conjuge_endereco_cidade?: string | null
    conjuge_endereco_estado?: string | null
    conjuge_endereco_cep?: string | null
  } | null

  // Fiador
  fiador?: {
    nome?: string | null
    cpf_cnpj?: string | null
    rg?: string | null
    genero?: string | null
    endereco_logradouro?: string | null
    endereco_numero?: string | null
    endereco_cidade?: string | null
    endereco_estado?: string | null
  } | null

  // Administradora (perfil do usuário)
  admin?: {
    nome?: string | null
    razao_social?: string | null
    cnpj?: string | null
    creci?: string | null
    creci_juridico?: string | null
    endereco_logradouro?: string | null
    endereco_numero?: string | null
    endereco_bairro?: string | null
    endereco_cidade?: string | null
    endereco_uf?: string | null
    endereco_cep?: string | null
  } | null

  // Imóvel
  imovel?: {
    tipo?: string | null
    endereco_resumido?: string | null
    endereco_completo?: string | null
    endereco_numero?: string | null
    endereco_complemento?: string | null
    endereco_bairro?: string | null
    endereco_cep?: string | null
    bairro_nome?: string | null
    matricula_cartorio?: string | null
    inscricao_municipal?: string | null
    uc_energia?: string | null
    matricula_agua?: string | null
    uc_gas?: string | null
    area_construida_m2?: number | null
    area_terreno_m2?: number | null
    descricao_real?: string | null
    descricao?: string | null
    cartorio_registro?: string | null
    livro_folha_matricula?: string | null
    hidrometro_numero?: string | null
    hidrometro_leitura_inicial?: string | null
    medidor_energia_numero?: string | null
    medidor_energia_leitura_inicial?: string | null
  } | null

  // Contrato
  contrato?: {
    codigo?: string | null
    valor_aluguel?: number | null
    iptu_mensal?: number | null
    condominio_mensal?: number | null
    data_inicio?: string | null
    data_termino?: string | null
    duracao_meses?: number | null
    dia_vencimento?: number | null
    caucao_valor?: number | null
    seguro_fianca_seguradora?: string | null
    seguro_fianca_contratacao?: string | null
    seguro_fianca_apolice?: string | null
    valor_seguro_fianca_mensal?: number | null
    valor_seguro_incendio_anual?: number | null
    aluguel_inclui_iptu?: boolean | null
    aluguel_inclui_condominio?: boolean | null
    aluguel_inclui_agua?: boolean | null
    aluguel_inclui_energia?: boolean | null
    aluguel_inclui_gas?: boolean | null
    aluguel_inclui_internet?: boolean | null
    /** Da geração (não do contrato): se 'cobrado_parte', cobra mensal no boleto;
     *  se 'embutido_pacote' ou 'dispensado', NÃO entra no boleto mensal. */
    tipo_seguro_incendio?: 'dispensado' | 'cobrado_parte' | 'embutido_pacote' | null
  } | null

  // Contrato de administração (quando aplicável)
  administracao?: {
    codigo?: string | null
    data_inicio?: string | null
    data_termino?: string | null
    prazo_meses?: number | null
    taxa_tipo?: 'percentual' | 'fixo' | null
    taxa_valor?: number | null
    dia_repasse?: number | null
    aviso_previo_dias?: number | null
    multa_rescisao_meses?: number | null
    exclusividade?: boolean | null
    recebimento_comissao?: 'mensal' | 'pagamento_unico' | null
    /** Primeiro aluguel inteiro fica com a administradora (comissão de intermediação). */
    primeira_parcela_cheia?: boolean | null
    /** v105: base da taxa percentual. */
    taxa_base?: 'aluguel' | 'aluguel_encargos' | null
    /** v105: prazo do repasse em dias úteis após a compensação. */
    repasse_dias_uteis?: number | null
    /** v105: teto por evento para reparo urgente sem autorização. */
    limite_reparos?: number | null
    proprietario_representante_nome?: string | null
    proprietario_representante_cpf?: string | null
    proprietario_representante_qualificacao?: string | null
  } | null
}

// ── Formatadores ──
const fmtBRL = (v: number | null | undefined): string => {
  if (v == null) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

/**
 * Junta lista de strings com vírgulas + " e " antes do último.
 *   ['a']                → 'a'
 *   ['a', 'b']           → 'a e b'
 *   ['a', 'b', 'c']      → 'a, b e c'
 *   []                   → ''
 */
const listarPt = (arr: string[]): string => {
  if (arr.length === 0) return ''
  if (arr.length === 1) return arr[0]
  return arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1]
}

const fmtData = (iso: string | null | undefined): string => {
  if (!iso) return ''
  const s = iso.slice(0, 10)
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

const fmtCpf = (s: string | null | undefined): string => {
  if (!s) return ''
  const d = s.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return s
}

const fmtCnpj = (s: string | null | undefined): string => {
  if (!s) return ''
  const d = s.replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return s
}

const fmtCep = (s: string | null | undefined): string => {
  if (!s) return ''
  const d = s.replace(/\D/g, '')
  if (d.length === 8) return d.replace(/^(\d{5})(\d{3})$/, '$1-$2')
  return s
}

// Converte inteiro 0–999.999.999 em extenso (pt-BR).
const inteiroPorExtenso = (n: number): string => {
  if (n === 0) return 'zero'
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
  const dezenas10a19 = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

  // Converte 0–999
  const ate999 = (x: number): string => {
    if (x === 0) return ''
    if (x === 100) return 'cem'
    const c = Math.floor(x / 100)
    const resto = x % 100
    const partes: string[] = []
    if (c > 0) partes.push(centenas[c])
    if (resto > 0) {
      if (resto < 10) partes.push(unidades[resto])
      else if (resto < 20) partes.push(dezenas10a19[resto - 10])
      else {
        const d = Math.floor(resto / 10)
        const u = resto % 10
        partes.push(u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`)
      }
    }
    return partes.join(' e ')
  }

  const milhoes = Math.floor(n / 1_000_000)
  const milhares = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000

  const blocos: string[] = []
  if (milhoes > 0) blocos.push(milhoes === 1 ? 'um milhão' : `${ate999(milhoes)} milhões`)
  if (milhares > 0) blocos.push(milhares === 1 ? 'mil' : `${ate999(milhares)} mil`)
  if (resto > 0) blocos.push(ate999(resto))

  // Junta blocos: usa " e " antes do último bloco quando o último é < 100 ou múltiplo de cem
  let out = ''
  for (let i = 0; i < blocos.length; i++) {
    if (i === 0) out = blocos[i]
    else {
      const ultimoNum = i === blocos.length - 1 ? resto : milhares
      const usaE = i === blocos.length - 1 && (resto === 0 || resto < 100 || resto % 100 === 0)
      out += (usaE ? ' e ' : ', ') + blocos[i]
      void ultimoNum
    }
  }
  return out
}

// Mantido pra compatibilidade (prazo em meses, etc) — só o inteiro.
const numeroPorExtenso = (n: number | null | undefined): string => {
  if (n == null) return '[PREENCHER]'
  return inteiroPorExtenso(Math.floor(n))
}

// Valor monetário por extenso: "dois mil e oitocentos reais",
// "cento e onze reais e onze centavos".
const valorPorExtenso = (v: number | null | undefined): string => {
  if (v == null) return ''
  const reais = Math.floor(v)
  const centavos = Math.round((v - reais) * 100)
  const parteReais = reais === 0 ? '' : `${inteiroPorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`
  const parteCentavos = centavos === 0 ? '' : `${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`
  if (parteReais && parteCentavos) return `${parteReais} e ${parteCentavos}`
  return parteReais || parteCentavos || 'zero reais'
}

/**
 * Strip HTML tags e decodifica entidades comuns.
 * A descrição do imóvel é salva via editor TipTap como HTML — no contrato
 * precisamos do texto puro.
 */
const stripHtml = (html: string | null | undefined): string => {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?p[^>]*>/gi, '')
    .replace(/<\/?(div|span|strong|b|em|i|u|ul|ol|li)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

const enderecoCompleto = (p: Record<string, any> | null | undefined): string => {
  if (!p) return '[PREENCHER]'
  const partes = [
    p.endereco_logradouro,
    p.endereco_numero ? `nº ${p.endereco_numero}` : null,
    p.endereco_complemento,
    p.endereco_bairro,
    p.endereco_cidade && p.endereco_estado ? `${p.endereco_cidade}-${p.endereco_estado}` : (p.endereco_cidade ?? null),
    p.endereco_cep ? `CEP ${fmtCep(p.endereco_cep)}` : null,
  ].filter(Boolean)
  return partes.length ? partes.join(', ') : '[PREENCHER]'
}

const rgCompleto = (p: Record<string, any> | null | undefined): string => {
  if (!p?.rg) return '[PREENCHER]'
  const orgao = p.rg_orgao_emissor
  const uf = p.rg_uf
  if (orgao && uf) return `${p.rg} ${orgao}/${uf}`
  if (orgao) return `${p.rg} ${orgao}`
  return p.rg
}

// ── Flexão de gênero pra qualificação contratual ────────────────────
type Genero = 'M' | 'F' | 'N'

/** Determina o gênero efetivo pra redação. PJ (CNPJ 14 dígitos) é sempre
 *  tratada como feminino ("a empresa", "denominada CONTRATANTE"). */
const generoEfetivo = (p: { cpf_cnpj?: string | null; genero?: string | null } | null | undefined): Genero => {
  if (!p) return 'N'
  const digitos = (p.cpf_cnpj ?? '').replace(/\D/g, '')
  if (digitos.length === 14) return 'F'  // PJ → feminino por convenção contratual
  const g = (p.genero ?? 'N') as Genero
  return g === 'M' || g === 'F' ? g : 'N'
}

/** Escolhe a forma certa conforme o gênero. Se neutro e não houver forma
 *  neutra explícita, cai no masculino (forma jurídica aceita). */
const flex = (g: Genero, m: string, f: string, n?: string): string =>
  g === 'M' ? m : g === 'F' ? f : (n ?? m)

/**
 * Resolve um placeholder pelo nome (sem as chaves) com base nos dados.
 */
function resolverPlaceholder(chave: string, dados: DadosContrato): string {
  // Vazio = não aparece nada (em vez de [PREENCHER]). Texto pode ficar
  // com lacunas, mas o usuário pode editar a cláusula pra adaptar.
  const FALLBACK = ''

  switch (chave) {
    // ── Locador ──
    case 'LOCADOR_NOME': return dados.locador?.nome ?? FALLBACK
    case 'LOCADOR_CPF': return fmtCpf(dados.locador?.cpf_cnpj)
    case 'LOCADOR_RG': return rgCompleto(dados.locador)
    case 'LOCADOR_NACIONALIDADE': return dados.locador?.nacionalidade ?? FALLBACK
    case 'LOCADOR_ESTADO_CIVIL': return dados.locador?.estado_civil ?? FALLBACK
    case 'LOCADOR_PROFISSAO': return dados.locador?.profissao ?? FALLBACK
    case 'LOCADOR_ENDERECO': return enderecoCompleto(dados.locador)
    case 'LOCADOR_BRASILEIRO': return flex(generoEfetivo(dados.locador), 'brasileiro', 'brasileira')
    case 'LOCADOR_NASCIDO': return flex(generoEfetivo(dados.locador), 'nascido', 'nascida')
    case 'LOCADOR_PORTADOR': return flex(generoEfetivo(dados.locador), 'portador', 'portadora')
    case 'LOCADOR_INSCRITO': return flex(generoEfetivo(dados.locador), 'inscrito', 'inscrita')
    case 'LOCADOR_DOMICILIADO': return flex(generoEfetivo(dados.locador), 'residente e domiciliado', 'residente e domiciliada')
    case 'LOCADOR_DENOMINADO': return flex(generoEfetivo(dados.locador), 'denominado', 'denominada', 'doravante identificado como')
    case 'LOCADOR_PAPEL': return flex(generoEfetivo(dados.locador), 'LOCADOR', 'LOCADORA')
    case 'LOCADOR_REPRESENTADO': return flex(generoEfetivo(dados.locador), 'representado', 'representada')
    case 'LOCADOR_PROPRIETARIO': return flex(generoEfetivo(dados.locador), 'PROPRIETÁRIO', 'PROPRIETÁRIA')

    // ── Locatário ──
    case 'LOCATARIO_NOME': return dados.locatario?.nome ?? FALLBACK
    case 'LOCATARIO_CPF': return fmtCpf(dados.locatario?.cpf_cnpj)
    case 'LOCATARIO_RG': return rgCompleto(dados.locatario)
    case 'LOCATARIO_NACIONALIDADE': return dados.locatario?.nacionalidade ?? FALLBACK
    case 'LOCATARIO_ESTADO_CIVIL': return dados.locatario?.estado_civil ?? FALLBACK
    case 'LOCATARIO_REGIME_BENS': return dados.locatario?.regime_bens ?? FALLBACK
    case 'LOCATARIO_PROFISSAO': return dados.locatario?.profissao ?? FALLBACK
    case 'LOCATARIO_DATA_NASC': return fmtData(dados.locatario?.data_nascimento)
    case 'LOCATARIO_NATURALIDADE': return dados.locatario?.naturalidade ?? FALLBACK
    case 'LOCATARIO_NOME_PAI': return dados.locatario?.nome_pai ?? FALLBACK
    case 'LOCATARIO_NOME_MAE': return dados.locatario?.nome_mae ?? FALLBACK
    case 'LOCATARIO_ENDERECO': return enderecoCompleto(dados.locatario)
    case 'LOCATARIO_BRASILEIRO': return flex(generoEfetivo(dados.locatario), 'brasileiro', 'brasileira')
    case 'LOCATARIO_NASCIDO': return flex(generoEfetivo(dados.locatario), 'nascido', 'nascida')
    case 'LOCATARIO_PORTADOR': return flex(generoEfetivo(dados.locatario), 'portador', 'portadora')
    case 'LOCATARIO_INSCRITO': return flex(generoEfetivo(dados.locatario), 'inscrito', 'inscrita')
    case 'LOCATARIO_DOMICILIADO': return flex(generoEfetivo(dados.locatario), 'residente e domiciliado', 'residente e domiciliada')
    case 'LOCATARIO_DENOMINADO': return flex(generoEfetivo(dados.locatario), 'denominado', 'denominada', 'doravante identificado como')
    case 'LOCATARIO_PAPEL': return flex(generoEfetivo(dados.locatario), 'LOCATÁRIO', 'LOCATÁRIA')
    case 'LOCATARIO_FILHO': return flex(generoEfetivo(dados.locatario), 'filho', 'filha')

    // ── Cônjuge ──
    case 'CONJUGE_NOME': return dados.locatario?.conjuge_nome ?? FALLBACK
    case 'CONJUGE_CPF': return fmtCpf(dados.locatario?.conjuge_cpf)
    case 'CONJUGE_RG': return dados.locatario?.conjuge_rg ?? FALLBACK
    case 'CONJUGE_DATA_NASC': return fmtData(dados.locatario?.conjuge_data_nascimento)
    case 'CONJUGE_PROFISSAO': return dados.locatario?.conjuge_profissao ?? FALLBACK
    case 'CONJUGE_NACIONALIDADE': return dados.locatario?.conjuge_nacionalidade ?? FALLBACK
    case 'CONJUGE_NATURALIDADE': return dados.locatario?.conjuge_naturalidade ?? FALLBACK
    case 'CONJUGE_NOME_PAI': return dados.locatario?.conjuge_nome_pai ?? FALLBACK
    case 'CONJUGE_NOME_MAE': return dados.locatario?.conjuge_nome_mae ?? FALLBACK
    case 'CONJUGE_ENDERECO': {
      // Se cônjuge tem endereço próprio, usa; senão usa do titular
      const l = dados.locatario
      if (!l) return FALLBACK
      if (l.conjuge_endereco_logradouro) {
        return enderecoCompleto({
          endereco_logradouro: l.conjuge_endereco_logradouro,
          endereco_numero: l.conjuge_endereco_numero,
          endereco_bairro: l.conjuge_endereco_bairro,
          endereco_cidade: l.conjuge_endereco_cidade,
          endereco_estado: l.conjuge_endereco_estado,
          endereco_cep: l.conjuge_endereco_cep,
        })
      }
      return enderecoCompleto(l)
    }
    case 'CONJUGE_BRASILEIRO': return flex(generoEfetivo({ cpf_cnpj: dados.locatario?.conjuge_cpf, genero: dados.locatario?.conjuge_genero }), 'brasileiro', 'brasileira')
    case 'CONJUGE_NASCIDO': return flex(generoEfetivo({ cpf_cnpj: dados.locatario?.conjuge_cpf, genero: dados.locatario?.conjuge_genero }), 'nascido', 'nascida')
    case 'CONJUGE_PORTADOR': return flex(generoEfetivo({ cpf_cnpj: dados.locatario?.conjuge_cpf, genero: dados.locatario?.conjuge_genero }), 'portador', 'portadora')
    case 'CONJUGE_INSCRITO': return flex(generoEfetivo({ cpf_cnpj: dados.locatario?.conjuge_cpf, genero: dados.locatario?.conjuge_genero }), 'inscrito', 'inscrita')
    case 'CONJUGE_DOMICILIADO': return flex(generoEfetivo({ cpf_cnpj: dados.locatario?.conjuge_cpf, genero: dados.locatario?.conjuge_genero }), 'residente e domiciliado', 'residente e domiciliada')

    // ── Administradora ──
    case 'ADMIN_RAZAO_SOCIAL': return dados.admin?.razao_social ?? dados.admin?.nome ?? FALLBACK
    case 'ADMIN_CNPJ': return fmtCnpj(dados.admin?.cnpj)
    case 'ADMIN_CRECI_J': return dados.admin?.creci_juridico ?? FALLBACK
    case 'ADMIN_ENDERECO': {
      if (!dados.admin) return FALLBACK
      const a = dados.admin
      const partes = [
        a.endereco_logradouro,
        a.endereco_numero ? `nº ${a.endereco_numero}` : null,
        a.endereco_bairro,
        a.endereco_cidade && a.endereco_uf ? `${a.endereco_cidade}-${a.endereco_uf}` : null,
        a.endereco_cep ? `CEP ${fmtCep(a.endereco_cep)}` : null,
      ].filter(Boolean)
      return partes.length ? partes.join(', ') : FALLBACK
    }
    case 'ADMIN_RESPONSAVEL': return dados.admin?.nome ?? FALLBACK
    case 'ADMIN_RESPONSAVEL_CRECI': return dados.admin?.creci ?? FALLBACK

    // ── Imóvel ──
    case 'IMOVEL_ENDERECO': {
      const i = dados.imovel
      if (!i) return FALLBACK
      // Preferir o endereço "real" se houver; fallback pro do anúncio
      if (i.endereco_completo) {
        const partes = [
          i.endereco_completo,
          i.endereco_numero ? `nº ${i.endereco_numero}` : null,
          i.endereco_complemento,
          i.endereco_bairro ?? i.bairro_nome,
        ].filter(Boolean)
        return partes.join(', ')
      }
      if (i.endereco_resumido) {
        return `${i.endereco_resumido}${i.bairro_nome ? `, ${i.bairro_nome}` : ''}`
      }
      return FALLBACK
    }
    case 'IMOVEL_CEP': return fmtCep(dados.imovel?.endereco_cep)
    case 'IMOVEL_MATRICULA': return dados.imovel?.matricula_cartorio ?? FALLBACK
    case 'IMOVEL_INSC_MUNICIPAL': return dados.imovel?.inscricao_municipal ?? FALLBACK
    case 'IMOVEL_UC_ENERGIA': return dados.imovel?.uc_energia ?? FALLBACK
    case 'IMOVEL_MATRICULA_AGUA': return dados.imovel?.matricula_agua ?? FALLBACK
    case 'IMOVEL_UC_GAS': return dados.imovel?.uc_gas ?? FALLBACK
    case 'IMOVEL_DESCRICAO': {
      // descricao_real (texto livre da aba "Dados pro contrato") tem prioridade;
      // descricao (do anúncio) é HTML — precisa stripar tags.
      const txt = dados.imovel?.descricao_real ?? stripHtml(dados.imovel?.descricao) ?? ''
      return txt.trim().length > 0 ? txt : FALLBACK
    }
    case 'IMOVEL_AREA_CONSTRUIDA':
      return dados.imovel?.area_construida_m2 ? `${dados.imovel.area_construida_m2} m²` : FALLBACK
    case 'IMOVEL_AREA_TERRENO':
      return dados.imovel?.area_terreno_m2 ? `${dados.imovel.area_terreno_m2} m²` : FALLBACK
    case 'IMOVEL_CARTORIO': return dados.imovel?.cartorio_registro ?? FALLBACK
    case 'IMOVEL_LIVRO_FOLHA': return dados.imovel?.livro_folha_matricula ?? FALLBACK
    case 'IMOVEL_HIDROMETRO_NUMERO': return dados.imovel?.hidrometro_numero ?? FALLBACK
    case 'IMOVEL_HIDROMETRO_LEITURA': return dados.imovel?.hidrometro_leitura_inicial ?? FALLBACK
    case 'IMOVEL_MEDIDOR_ENERGIA_NUMERO': return dados.imovel?.medidor_energia_numero ?? FALLBACK
    case 'IMOVEL_MEDIDOR_ENERGIA_LEITURA': return dados.imovel?.medidor_energia_leitura_inicial ?? FALLBACK

    // ── Valores ──
    case 'ALUGUEL_VALOR': return fmtBRL(dados.contrato?.valor_aluguel)
    case 'ALUGUEL_EXTENSO': return valorPorExtenso(dados.contrato?.valor_aluguel)
    case 'IPTU_VALOR': return fmtBRL(dados.contrato?.iptu_mensal ?? 0)
    case 'VENCIMENTO_DIA': return dados.contrato?.dia_vencimento != null ? String(dados.contrato.dia_vencimento) : FALLBACK
    case 'TOTAL_MENSAL': {
      const c = dados.contrato
      const a = c?.valor_aluguel ?? 0
      // Só soma IPTU/condomínio se NÃO estiverem inclusos no aluguel.
      // Garante consistência com a tabela dos 12 meses e o quadro de entrada.
      const i = c?.aluguel_inclui_iptu ? 0 : (c?.iptu_mensal ?? 0)
      const co = c?.aluguel_inclui_condominio ? 0 : (c?.condominio_mensal ?? 0)
      return fmtBRL(a + i + co)
    }

    case 'ENCARGOS_INCLUSOS': {
      const c = dados.contrato
      if (!c) return FALLBACK
      const itens: string[] = []
      if (c.aluguel_inclui_iptu) itens.push('IPTU')
      if (c.aluguel_inclui_condominio) itens.push('condomínio ordinário')
      if (c.aluguel_inclui_agua) itens.push('água')
      if (c.aluguel_inclui_energia) itens.push('energia elétrica')
      if (c.aluguel_inclui_gas) itens.push('gás')
      if (c.aluguel_inclui_internet) itens.push('internet')
      return listarPt(itens)
    }
    case 'ENCARGOS_SEPARADOS': {
      const c = dados.contrato
      if (!c) return FALLBACK
      const itens: string[] = []
      if (!c.aluguel_inclui_iptu) itens.push('IPTU')
      if (!c.aluguel_inclui_condominio) itens.push('condomínio ordinário')
      if (!c.aluguel_inclui_agua) itens.push('água')
      if (!c.aluguel_inclui_energia) itens.push('energia elétrica')
      if (!c.aluguel_inclui_gas) itens.push('gás')
      if (!c.aluguel_inclui_internet) itens.push('internet')
      return listarPt(itens)
    }

    // Pacote locatício (aluguel + IPTU se incluso + condomínio se incluso)
    case 'PACOTE_LOCATICIO_VALOR': {
      const c = dados.contrato
      const a = c?.valor_aluguel ?? 0
      const i = c?.aluguel_inclui_iptu ? (c?.iptu_mensal ?? 0) : 0
      const co = c?.aluguel_inclui_condominio ? (c?.condominio_mensal ?? 0) : 0
      return fmtBRL(a + i + co)
    }
    case 'PACOTE_LOCATICIO_EXTENSO': {
      const c = dados.contrato
      const a = c?.valor_aluguel ?? 0
      const i = c?.aluguel_inclui_iptu ? (c?.iptu_mensal ?? 0) : 0
      const co = c?.aluguel_inclui_condominio ? (c?.condominio_mensal ?? 0) : 0
      return valorPorExtenso(a + i + co)
    }

    // Seguro fiança mensal
    case 'SEGURO_FIANCA_VALOR': return fmtBRL(dados.contrato?.valor_seguro_fianca_mensal ?? 0)
    case 'SEGURO_FIANCA_EXTENSO': return valorPorExtenso(dados.contrato?.valor_seguro_fianca_mensal ?? 0)

    // Seguro incêndio: SEMPRE retorna vazio no contexto de "boleto mensal".
    // Regra de mercado: seguro incêndio é obrigatório por lei (Lei 8.245/91),
    // mas é pago em parcela única anual à parte — o valor não entra no
    // boleto recorrente. A cláusula de obrigatoriedade continua no contrato.
    // Se o corretor quiser ratear no boleto, edita a cláusula manualmente.
    case 'SEGURO_INCENDIO_VALOR': return ''

    // Total do boleto = pacote + seguro fiança. Seguro incêndio NÃO entra
    // (é anual, pago à parte).
    case 'TOTAL_BOLETO_VALOR': {
      const c = dados.contrato
      const a = c?.valor_aluguel ?? 0
      const i = c?.aluguel_inclui_iptu ? (c?.iptu_mensal ?? 0) : 0
      const co = c?.aluguel_inclui_condominio ? (c?.condominio_mensal ?? 0) : 0
      const sf = c?.valor_seguro_fianca_mensal ?? 0
      return fmtBRL(a + i + co + sf)
    }
    case 'TOTAL_BOLETO_EXTENSO': {
      const c = dados.contrato
      const a = c?.valor_aluguel ?? 0
      const i = c?.aluguel_inclui_iptu ? (c?.iptu_mensal ?? 0) : 0
      const co = c?.aluguel_inclui_condominio ? (c?.condominio_mensal ?? 0) : 0
      const sf = c?.valor_seguro_fianca_mensal ?? 0
      return valorPorExtenso(a + i + co + sf)
    }

    case 'OUTROS_ENCARGOS_FIXOS': return ''  // texto livre — corretor edita depois se quiser

    // ── Prazo ──
    case 'PRAZO_MESES': return dados.contrato?.duracao_meses != null ? String(dados.contrato.duracao_meses) : '30'
    case 'PRAZO_EXTENSO': return numeroPorExtenso(dados.contrato?.duracao_meses ?? 30)
    case 'DATA_INICIO': return fmtData(dados.contrato?.data_inicio)
    case 'DATA_FIM': {
      // Se data_termino veio preenchido, usa. Senão calcula a partir de
      // data_inicio + duracao_meses (1 dia antes do mesmo dia, meses depois).
      const c = dados.contrato
      if (c?.data_termino) return fmtData(c.data_termino)
      if (c?.data_inicio && c?.duracao_meses) {
        const inicio = new Date(c.data_inicio + 'T00:00:00')
        const fim = new Date(inicio.getFullYear(), inicio.getMonth() + c.duracao_meses, inicio.getDate() - 1)
        const y = fim.getFullYear()
        const m = String(fim.getMonth() + 1).padStart(2, '0')
        const d = String(fim.getDate()).padStart(2, '0')
        return `${d}/${m}/${y}`
      }
      return FALLBACK
    }

    // ── Caução ──
    case 'CAUCAO_VALOR': return fmtBRL(dados.contrato?.caucao_valor)
    case 'CAUCAO_EXTENSO': return valorPorExtenso(dados.contrato?.caucao_valor)
    case 'CAUCAO_MESES': {
      const v = dados.contrato?.caucao_valor ?? 0
      const a = dados.contrato?.valor_aluguel ?? 0
      if (!v || !a) return '3'
      return String(Math.round(v / a))
    }

    // ── Fiador ──
    case 'FIADOR_NOME': return dados.fiador?.nome ?? FALLBACK
    case 'FIADOR_CPF': return fmtCpf(dados.fiador?.cpf_cnpj)
    case 'FIADOR_RG': return dados.fiador?.rg ?? FALLBACK
    case 'FIADOR_ENDERECO': return enderecoCompleto(dados.fiador)
    case 'FIADOR_BRASILEIRO': return flex(generoEfetivo(dados.fiador), 'brasileiro', 'brasileira')
    case 'FIADOR_NASCIDO': return flex(generoEfetivo(dados.fiador), 'nascido', 'nascida')
    case 'FIADOR_PORTADOR': return flex(generoEfetivo(dados.fiador), 'portador', 'portadora')
    case 'FIADOR_INSCRITO': return flex(generoEfetivo(dados.fiador), 'inscrito', 'inscrita')
    case 'FIADOR_DOMICILIADO': return flex(generoEfetivo(dados.fiador), 'residente e domiciliado', 'residente e domiciliada')
    case 'FIADOR_DENOMINADO': return flex(generoEfetivo(dados.fiador), 'denominado', 'denominada', 'doravante identificado como')
    case 'FIADOR_PAPEL': return flex(generoEfetivo(dados.fiador), 'FIADOR', 'FIADORA')

    // ── Seguro ──
    case 'SEGURO_SEGURADORA': return dados.contrato?.seguro_fianca_seguradora ?? FALLBACK
    case 'SEGURO_CONTRATACAO': return dados.contrato?.seguro_fianca_contratacao ?? FALLBACK
    case 'SEGURO_APOLICE': return dados.contrato?.seguro_fianca_apolice ?? FALLBACK
    case 'SEGURO_VALOR': return fmtBRL(dados.contrato?.valor_seguro_fianca_mensal)
    case 'SEGURO_VIGENCIA': return '12 meses'

    // ── Contrato de Administração ──
    case 'ADM_CODIGO': return dados.administracao?.codigo ?? FALLBACK
    case 'ADM_DATA_INICIO': return fmtData(dados.administracao?.data_inicio)
    case 'ADM_DATA_TERMINO': return fmtData(dados.administracao?.data_termino)
    case 'ADM_PRAZO_MESES': return dados.administracao?.prazo_meses != null ? String(dados.administracao.prazo_meses) : '12'
    case 'ADM_TAXA_VALOR': {
      const t = dados.administracao
      if (!t || t.taxa_valor == null) return FALLBACK
      return t.taxa_tipo === 'fixo' ? fmtBRL(t.taxa_valor) : `${t.taxa_valor}%`
    }
    case 'ADM_TAXA_DESCRICAO': {
      const t = dados.administracao
      if (!t || t.taxa_valor == null) return FALLBACK
      if (t.taxa_tipo === 'fixo') {
        return `${fmtBRL(t.taxa_valor)} (${valorPorExtenso(t.taxa_valor)}) mensais`
      }
      return `${t.taxa_valor}% (${numeroPorExtenso(Math.floor(t.taxa_valor))} por cento) sobre o aluguel`
    }
    case 'ADM_DIA_REPASSE': return dados.administracao?.dia_repasse != null ? String(dados.administracao.dia_repasse) : '5'
    case 'ADM_AVISO_PREVIO_DIAS': return dados.administracao?.aviso_previo_dias != null ? String(dados.administracao.aviso_previo_dias) : '30'
    case 'ADM_MULTA_MESES': return dados.administracao?.multa_rescisao_meses != null ? String(dados.administracao.multa_rescisao_meses) : '3'
    case 'ADM_EXCLUSIVIDADE': return dados.administracao?.exclusividade === false
      ? 'sem exclusividade de captação'
      : 'em regime de exclusividade'
    case 'ADM_REMUNERACAO_FORMA': return dados.administracao?.recebimento_comissao === 'pagamento_unico'
      ? 'Parágrafo. As partes ajustam que a remuneração da ADMINISTRADORA (comissão de intermediação e taxa de administração do período) será recebida em PARCELA ÚNICA, no ato da assinatura deste contrato ou da efetivação da locação, ficando dispensado o desconto ou repasse mensal da taxa de administração durante o referido período.'
      : 'Parágrafo. A remuneração da ADMINISTRADORA será recebida mensalmente, mediante desconto ou retenção sobre os valores recebidos do LOCATÁRIO, conforme os parágrafos acima.'
    case 'ADM_PROPRIETARIO_REPRESENTANTE': {
      const a = dados.administracao
      if (!a?.proprietario_representante_nome) return ''
      const cpf = a.proprietario_representante_cpf ? `, CPF nº ${a.proprietario_representante_cpf}` : ''
      const qual = a.proprietario_representante_qualificacao?.trim() || 'representante legal'
      return `A PROPRIETÁRIA é, neste ato, representada por ${a.proprietario_representante_nome}${cpf}, na qualidade de ${qual}, que assina o presente instrumento em seu nome.`
    }

    // ── v105: campos do contrato de administração que eram colchetes ──
    case 'ADM_PRAZO_DESCRICAO': {
      const a = dados.administracao
      if (!a?.data_inicio) return FALLBACK
      if (a.prazo_meses) {
        const fim = a.data_termino ? ` e término em ${fmtData(a.data_termino)}` : ''
        return `pelo prazo de ${a.prazo_meses} (${numeroPorExtenso(a.prazo_meses)}) meses, com início em ${fmtData(a.data_inicio)}${fim}`
      }
      return `por prazo indeterminado, com início em ${fmtData(a.data_inicio)}`
    }
    case 'ADM_TAXA_BASE': {
      const a = dados.administracao
      if (!a || a.taxa_valor == null) return FALLBACK
      if (a.taxa_tipo === 'fixo') return 'em valor fixo mensal, independentemente do valor do aluguel'
      return a.taxa_base === 'aluguel_encargos'
        ? 'calculada sobre o aluguel e sobre o condomínio e o IPTU efetivamente recebidos do locatário, excluídos seguros, consumos, multas, indenizações e reembolsos'
        : 'calculada exclusivamente sobre o aluguel-base efetivamente recebido do locatário, excluídos condomínio, IPTU, seguros, consumos, multas, indenizações e reembolsos, ainda que cobrados no mesmo boleto'
    }
    case 'ADM_COMISSAO_INTERMEDIACAO': {
      const a = dados.administracao
      if (!a) return FALLBACK
      return a.primeira_parcela_cheia
        ? 'equivalente a 100% (cem por cento) do primeiro aluguel-base, retida do primeiro aluguel efetivamente recebido do locatário, sem incidência da taxa de administração sobre esse mesmo mês'
        : 'não cobrada de forma destacada, incidindo sobre o primeiro aluguel apenas a taxa de administração ordinária'
    }
    case 'ADM_REPASSE_DIAS_UTEIS': return dados.administracao?.repasse_dias_uteis != null ? String(dados.administracao.repasse_dias_uteis) : FALLBACK
    case 'ADM_REPASSE_DIAS_UTEIS_EXTENSO': return dados.administracao?.repasse_dias_uteis != null ? numeroPorExtenso(dados.administracao.repasse_dias_uteis) : FALLBACK
    case 'ADM_LIMITE_REPAROS': return dados.administracao?.limite_reparos != null ? fmtBRL(dados.administracao.limite_reparos) : FALLBACK
    case 'ADM_LIMITE_REPAROS_EXTENSO': return dados.administracao?.limite_reparos != null ? valorPorExtenso(dados.administracao.limite_reparos) : FALLBACK

    // ── v2: documento, contato e qualificação ──
    // Textos antigos não usam estas chaves, então o modo legado continua
    // produzindo exatamente o mesmo texto de antes.
    case 'LOCADOR_DOC_TIPO': return tipoDocumento(dados.locador?.cpf_cnpj)
    case 'LOCATARIO_DOC_TIPO': return tipoDocumento(dados.locatario?.cpf_cnpj)
    case 'LOCADOR_EMAIL': return dados.locador?.email?.trim() || FALLBACK
    case 'LOCATARIO_EMAIL': return dados.locatario?.email?.trim() || FALLBACK
    case 'LOCADOR_TELEFONE': return fmtTelefone(dados.locador?.telefone || dados.locador?.whatsapp)
    case 'LOCATARIO_TELEFONE': return fmtTelefone(dados.locatario?.telefone || dados.locatario?.whatsapp)
    case 'LOCADOR_QUALIFICACAO':
      return qualificacao(dados.locador, 'locador', dados, () => '')
    case 'LOCATARIO_QUALIFICACAO':
      return qualificacao(dados.locatario, 'locatario', dados, () => '')

    default: return `{{${chave}}}`  // não conhecido: mantém pra usuário ver
  }
}

const tipoDocumento = (doc: string | null | undefined): string => {
  const d = (doc ?? '').replace(/\D/g, '')
  if (d.length === 14) return 'CNPJ'
  if (d.length === 11) return 'CPF'
  return ''
}

const fmtTelefone = (s: string | null | undefined): string => {
  if (!s) return ''
  const d = s.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
  return s.trim()
}

const ESTADO_CIVIL: Record<string, [string, string]> = {
  solteiro: ['solteiro', 'solteira'],
  casado: ['casado', 'casada'],
  divorciado: ['divorciado', 'divorciada'],
  separado: ['separado judicialmente', 'separada judicialmente'],
  viuvo: ['viúvo', 'viúva'],
  uniao_estavel: ['em união estável', 'em união estável'],
}

type Pessoa = NonNullable<DadosContrato['locador']> & Record<string, any>

/**
 * Qualificação contratual de uma parte, PF ou PJ, decidida pelo documento
 * cadastrado (14 dígitos = PJ). Cada pedaço que falta passa por `falta`,
 * que no motor v2 devolve o marcador [PENDENTE] e no legado devolve '' —
 * e o pedaço inteiro sai junto ("portadora do RG nº", a vírgula), em vez
 * de deixar a construção pela metade.
 *
 * PJ: razão social + CNPJ + sede + representante (quando cadastrado). O CPF
 * do representante vai junto do nome dele, nunca no lugar do CNPJ.
 */
function qualificacao(
  p: Pessoa | null | undefined,
  papel: 'locador' | 'locatario',
  dados: DadosContrato,
  falta: (chave: string, rotulo: string, motivo?: MotivoPendencia) => string,
): string {
  const prefixo = papel === 'locador' ? 'LOCADOR' : 'LOCATARIO'
  const quem = papel === 'locador' ? 'do locador' : 'do locatário'
  if (!p) return falta(`${prefixo}_QUALIFICACAO`, `qualificação ${quem}`)

  const digitos = (p.cpf_cnpj ?? '').replace(/\D/g, '')
  const ehPJ = digitos.length === 14
  const g = generoEfetivo(p)
  const partes: string[] = []
  const nome = p.nome?.trim() || falta(`${prefixo}_NOME`, `nome ${quem}`)

  if (ehPJ) {
    partes.push(`${nome}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${fmtCnpj(p.cpf_cnpj)}`)
    const sede = enderecoCompleto(p)
    const sedeTxt = sede === '[PREENCHER]' ? falta(`${prefixo}_ENDERECO`, `endereço da sede ${quem}`) : sede
    if (sedeTxt) partes.push(`com sede em ${sedeTxt}`)
    const repr = papel === 'locador' ? dados.administracao : null
    if (repr?.proprietario_representante_nome) {
      const cpf = repr.proprietario_representante_cpf ? `, inscrito(a) no CPF sob o nº ${fmtCpf(repr.proprietario_representante_cpf)}` : ''
      const qual = repr.proprietario_representante_qualificacao?.trim()
      partes.push(`neste ato representada por ${repr.proprietario_representante_nome}${cpf}${qual ? `, na qualidade de ${qual}` : ''}`)
    }
    return partes.join(', ')
  }

  partes.push(nome)
  const nac = p.nacionalidade?.trim()
  partes.push(nac
    ? (/^brasileir/i.test(nac) ? flex(g, 'brasileiro', 'brasileira') : nac)
    : falta(`${prefixo}_NACIONALIDADE`, `nacionalidade ${quem}`))
  const ec = p.estado_civil ? ESTADO_CIVIL[p.estado_civil] : null
  partes.push(ec ? flex(g, ec[0], ec[1]) : (p.estado_civil?.trim() || falta(`${prefixo}_ESTADO_CIVIL`, `estado civil ${quem}`)))
  partes.push(p.profissao?.trim() || falta(`${prefixo}_PROFISSAO`, `profissão ${quem}`))
  const rg = rgCompleto(p)
  const rgTxt = rg === '[PREENCHER]' ? falta(`${prefixo}_RG`, `RG ${quem}`) : rg
  if (rgTxt) partes.push(`${flex(g, 'portador', 'portadora')} do RG nº ${rgTxt}`)
  const cpf = digitos.length === 11
    ? fmtCpf(p.cpf_cnpj)
    : falta(`${prefixo}_CPF`, `CPF ${quem}`, digitos.length > 0 ? 'invalido' : undefined)
  if (cpf) partes.push(`${flex(g, 'inscrito', 'inscrita')} no CPF sob o nº ${cpf}`)
  const end = enderecoCompleto(p)
  const endTxt = end === '[PREENCHER]' ? falta(`${prefixo}_ENDERECO`, `endereço ${quem}`) : end
  if (endTxt) partes.push(`${flex(g, 'residente e domiciliado', 'residente e domiciliada')} em ${endTxt}`)
  return partes.filter(Boolean).join(', ')
}

// ════════════════════════════════════════════════════════════════════
//  Motor v2 — nenhum placeholder some em silêncio
// ════════════════════════════════════════════════════════════════════

/**
 * Por que um placeholder não pôde ser preenchido:
 *  - vazio: o campo existe no cadastro, mas está em branco
 *  - sem_vinculo: a pessoa/imóvel nem está ligada ao contrato
 *  - desconhecido: a chave escrita na cláusula não existe no catálogo
 *  - invalido: tem valor, mas fora do formato (CPF com dígito faltando)
 */
export type MotivoPendencia = 'vazio' | 'sem_vinculo' | 'desconhecido' | 'invalido' | 'manual'

export type EntidadePlaceholder =
  'locador' | 'locatario' | 'conjuge' | 'fiador' | 'admin' | 'imovel' | 'contrato' | 'administracao' | 'clausula'

export interface PendenciaPlaceholder {
  chave: string
  rotulo: string
  motivo: MotivoPendencia
  entidade: EntidadePlaceholder
  nivel: NivelPlaceholder
  /** Quantas vezes aparece no contrato. */
  ocorrencias: number
}

/** Delimitadores do trecho pendente no texto (área de uso privado do Unicode). */
export const MARCA_PENDENTE_INI = '\uE000'
export const MARCA_PENDENTE_FIM = '\uE001'
export const RE_MARCA_PENDENTE = /\uE000([^\uE001]*)\uE001/g

/**
 * Contratos cujo processo de assinatura foi aberto antes desta data seguem
 * no motor antigo pra sempre: os signatários leram aquele texto, e a via
 * final (quando ainda não congelada) tem que sair igual ao que foi lido.
 * Processo aberto depois disso já nasce no v2, do início ao fim.
 */
export const MOTOR_V2_DESDE = '2026-11-12T04:00:00Z'

export type MotorPlaceholders = 'legado' | 'v2'

/** Decide o motor pelo processo de assinatura mais recente (não cancelado). */
export function motorDoContrato(processoCriadoEm: string | null | undefined): MotorPlaceholders {
  if (processoCriadoEm && processoCriadoEm < MOTOR_V2_DESDE) return 'legado'
  return 'v2'
}

const marcar = (rotulo: string) =>
  `${MARCA_PENDENTE_INI}PENDENTE: ${rotulo.toUpperCase()}${MARCA_PENDENTE_FIM}`

function entidadeDaChave(chave: string): EntidadePlaceholder {
  if (chave.startsWith('LOCADOR_')) return 'locador'
  if (chave.startsWith('LOCATARIO_')) return 'locatario'
  if (chave.startsWith('CONJUGE_')) return 'conjuge'
  if (chave.startsWith('FIADOR_')) return 'fiador'
  if (chave.startsWith('ADMIN_')) return 'admin'
  if (chave.startsWith('IMOVEL_')) return 'imovel'
  if (chave.startsWith('ADM_')) return 'administracao'
  return 'contrato'
}

function objetoDaEntidade(e: EntidadePlaceholder, d: DadosContrato): unknown {
  switch (e) {
    case 'locador': return d.locador
    case 'locatario': return d.locatario
    case 'conjuge': return d.locatario?.conjuge_nome ? d.locatario : null
    case 'fiador': return d.fiador
    case 'admin': return d.admin
    case 'imovel': return d.imovel
    case 'administracao': return d.administracao
    default: return d.contrato ?? d.administracao
  }
}

/**
 * Chaves cujo resolvedor antigo inventa um valor quando o dado falta
 * ('30' meses, repasse dia '5', caução de '3' meses…). No v2 a falta do
 * dado bruto vira pendência — o número inventado nunca chega ao texto.
 */
const SEM_DADO_BRUTO: Record<string, (d: DadosContrato) => boolean> = {
  PRAZO_MESES: d => d.contrato?.duracao_meses == null,
  PRAZO_EXTENSO: d => d.contrato?.duracao_meses == null,
  ALUGUEL_VALOR: d => !d.contrato?.valor_aluguel,
  ALUGUEL_EXTENSO: d => !d.contrato?.valor_aluguel,
  PACOTE_LOCATICIO_VALOR: d => !d.contrato?.valor_aluguel,
  PACOTE_LOCATICIO_EXTENSO: d => !d.contrato?.valor_aluguel,
  TOTAL_BOLETO_VALOR: d => !d.contrato?.valor_aluguel,
  TOTAL_BOLETO_EXTENSO: d => !d.contrato?.valor_aluguel,
  TOTAL_MENSAL: d => !d.contrato?.valor_aluguel,
  CAUCAO_VALOR: d => !d.contrato?.caucao_valor,
  CAUCAO_EXTENSO: d => !d.contrato?.caucao_valor,
  CAUCAO_MESES: d => !d.contrato?.caucao_valor || !d.contrato?.valor_aluguel,
  SEGURO_FIANCA_VALOR: d => !d.contrato?.valor_seguro_fianca_mensal,
  SEGURO_FIANCA_EXTENSO: d => !d.contrato?.valor_seguro_fianca_mensal,
  SEGURO_VALOR: d => !d.contrato?.valor_seguro_fianca_mensal,
  ADM_PRAZO_MESES: d => d.administracao?.prazo_meses == null,
  ADM_DIA_REPASSE: d => d.administracao?.dia_repasse == null,
  ADM_AVISO_PREVIO_DIAS: d => d.administracao?.aviso_previo_dias == null,
  ADM_MULTA_MESES: d => d.administracao?.multa_rescisao_meses == null,
  ADM_REPASSE_DIAS_UTEIS: d => d.administracao?.repasse_dias_uteis == null,
  ADM_REPASSE_DIAS_UTEIS_EXTENSO: d => d.administracao?.repasse_dias_uteis == null,
  ADM_LIMITE_REPAROS: d => d.administracao?.limite_reparos == null,
  ADM_LIMITE_REPAROS_EXTENSO: d => d.administracao?.limite_reparos == null,
}

/** Rótulo legível do placeholder, pro marcador e pro painel. */
function rotuloDe(chave: string): string {
  const p = PLACEHOLDER_POR_CHAVE.get(chave)
  return p ? p.label.replace(/\s*\((gerado|vazio[^)]*|com órgão e UF|sai depois)\)\s*/gi, '').trim() : `{{${chave}}}`
}

/**
 * Aplica os placeholders no motor v2. Mesma limpeza de pontuação do legado,
 * mas o que falta vira [PENDENTE: …] (obrigatório/importante) e entra em
 * `pendencias`; o opcional sai do texto e também entra em `pendencias`,
 * pra aparecer no painel como omitido.
 */
export function aplicarPlaceholdersV2(
  corpo: string,
  dados: DadosContrato,
  pendencias: Map<string, PendenciaPlaceholder>,
): string {
  const registrar = (chave: string, motivo: MotivoPendencia, nivelForcado?: NivelPlaceholder, rotulo?: string) => {
    const atual = pendencias.get(chave)
    if (atual) { atual.ocorrencias++; return }
    pendencias.set(chave, {
      chave,
      rotulo: rotulo ?? rotuloDe(chave),
      motivo,
      entidade: motivo === 'desconhecido' || motivo === 'manual' ? 'clausula' : entidadeDaChave(chave),
      nivel: nivelForcado ?? nivelPlaceholder(chave),
      ocorrencias: 1,
    })
  }

  // Pendência dentro de um valor composto (a qualificação): registra a peça
  // que falta e devolve o marcador ou nada, conforme o nível dela.
  const falta = (chave: string, rotulo: string, motivoDado?: MotivoPendencia): string => {
    const motivo: MotivoPendencia = motivoDado
      ?? (objetoDaEntidade(entidadeDaChave(chave), dados) ? 'vazio' : 'sem_vinculo')
    registrar(chave, motivo, undefined, rotulo)
    return nivelPlaceholder(chave) === 'opcional' ? '' : marcar(rotulo)
  }

  const resolver = (chave: string): string => {
    if (!PLACEHOLDER_POR_CHAVE.has(chave)) {
      registrar(chave, 'desconhecido', 'obrigatorio', `placeholder {{${chave}}} não reconhecido`)
      return marcar(`placeholder ${chave} não reconhecido`)
    }
    if (chave === 'LOCADOR_QUALIFICACAO') return qualificacao(dados.locador, 'locador', dados, falta)
    if (chave === 'LOCATARIO_QUALIFICACAO') return qualificacao(dados.locatario, 'locatario', dados, falta)

    const nivel = nivelPlaceholder(chave)
    const pendente = (motivo: MotivoPendencia) => {
      registrar(chave, motivo)
      return nivel === 'opcional' ? '' : marcar(rotuloDe(chave))
    }

    const ent = entidadeDaChave(chave)
    if (!objetoDaEntidade(ent, dados)) {
      // Flexões de gênero têm forma neutra e não dependem do vínculo.
      if (/_(BRASILEIRO|NASCIDO|PORTADOR|INSCRITO|DOMICILIADO|DENOMINADO|PAPEL|REPRESENTADO|PROPRIETARIO|FILHO)$/.test(chave)) {
        return resolverPlaceholder(chave, dados)
      }
      return pendente('sem_vinculo')
    }
    if (SEM_DADO_BRUTO[chave]?.(dados)) return pendente('vazio')

    // Estado civil concorda com o gênero ("casada", não "casado"). Valor
    // fora do padrão do cadastro sai como foi digitado.
    if (/^(LOCADOR|LOCATARIO)_ESTADO_CIVIL$/.test(chave)) {
      const p = chave.startsWith('LOCADOR') ? dados.locador : dados.locatario
      const ec = p?.estado_civil ? ESTADO_CIVIL[p.estado_civil] : null
      if (ec) return flex(generoEfetivo(p), ec[0], ec[1])
    }

    const v = resolverPlaceholder(chave, dados)
    if (!v.trim() || v === '[PREENCHER]') return pendente('vazio')
    if (/_CPF$/.test(chave)) {
      const n = v.replace(/\D/g, '').length
      if (n !== 11 && n !== 14) return pendente('invalido')
    }
    return v
  }

  // Pega qualquer {{…}}, não só as chaves bem escritas: "{{locador_nome}}"
  // ou "{{ LOCADOR NOME }}" viram pendência visível em vez de texto cru.
  const substituido = corpo.replace(/\{\{\s*([^{}]*?)\s*\}\}/g, (_, chave: string) => resolver(chave))

  // Lacuna escrita à mão no texto ("[e-mail]", "[valor]", "[DETALHAR
  // REFORMA]") nunca é preenchida por cadastro nenhum: vira pendência do
  // texto da cláusula, em vermelho, e trava a assinatura até alguém editar.
  const comLacunas = substituido.replace(/\[([^[\]\n]{1,120})\]/g, (_, trecho: string) => {
    registrar(`TEXTO:${trecho.trim().toLowerCase()}`, 'manual', 'importante', `Trecho a completar no texto: [${trecho.trim()}]`)
    return `${MARCA_PENDENTE_INI}COMPLETAR NO TEXTO: ${trecho.trim()}${MARCA_PENDENTE_FIM}`
  })

  return limparPontuacao(comLacunas)
}

/** Os mesmos ajustes do legado, aplicados depois da substituição. */
function limparPontuacao(texto: string): string {
  let r = texto
    .replace(/,(\s*,)+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/\(\s*,\s*\)/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/(CPF nº|RG|CNPJ)\s*[.,]/g, '$1')
    .replace(/, +(\.)/g, '$1')
    .replace(/:\s*\./g, '.')
    .replace(/:\s*$/gm, '.')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\n[ \t]*\n[ \t]*\n+/g, '\n\n')
  r = r.replace(/\bCPF\b([^\d]{0,6}?)(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g, 'CNPJ$1$2')
  return r
}

/** Lista ordenada pro painel e pra trava de assinatura. */
export function listarPendencias(m: Map<string, PendenciaPlaceholder>): PendenciaPlaceholder[] {
  const peso: Record<NivelPlaceholder, number> = { obrigatorio: 0, importante: 1, opcional: 2 }
  return [...m.values()].sort((a, b) => peso[a.nivel] - peso[b.nivel] || a.rotulo.localeCompare(b.rotulo))
}

/** O que impede ir pra assinatura: tudo que aparece em vermelho no texto. */
export function pendenciasQueTravam(lista: PendenciaPlaceholder[]): PendenciaPlaceholder[] {
  return lista.filter(p => p.nivel !== 'opcional')
}

/**
 * Aplica todos os placeholders no corpo da cláusula e limpa pontuação
 * "órfã" que sobra quando o valor era vazio (ex: ", ," vira ",").
 */
export function aplicarPlaceholders(corpo: string, dados: DadosContrato): string {
  let r = corpo.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, chave) => resolverPlaceholder(chave, dados))

  // Limpeza pós-substituição: evita ", , ", "CPF nº ,", etc.
  r = r
    .replace(/,(\s*,)+/g, ',')              // vírgulas duplas → uma
    .replace(/\s+,/g, ',')                  // espaço antes de vírgula
    .replace(/\(\s*,\s*\)/g, '')            // ( , ) vazio
    .replace(/\(\s*\)/g, '')                // ( ) vazio
    .replace(/[ \t]+/g, ' ')                // múltiplos espaços
    .replace(/(CPF nº|RG|CNPJ)\s*[.,]/g, '$1') // "CPF nº ," sobra como "CPF nº"
    .replace(/, +(\.)/g, '$1')              // vírgula antes de ponto
    .replace(/:\s*\./g, '.')                // ": ." quando placeholder fica vazio
    .replace(/:\s*$/gm, '.')                // ":" no fim de linha sem conteúdo
    .replace(/\s+([.,;:])/g, '$1')          // espaço antes de pontuação
    .replace(/\n[ \t]*\n[ \t]*\n+/g, '\n\n') // múltiplas linhas em branco → 2

  // PJ: quando o número que entrou no lugar do {{..._CPF}} é um CNPJ
  // (formato com barra: 00.000.000/0000-00), o rótulo correto é CNPJ.
  // Reescreve "CPF nº 00.000.000/0000-00" → "CNPJ nº 00.000.000/0000-00".
  // Não toca em rótulos já genéricos ("CPF/CNPJ") por causa do limite de gap.
  r = r.replace(
    /\bCPF\b([^\d]{0,6}?)(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g,
    'CNPJ$1$2',
  )
  return r
}

/**
 * Remove primeira linha do corpo se ela for igual ao título da cláusula
 * (case insensitive). Acontece quando o usuário (ou ChatGPT) cola o título
 * em maiúsculas no início do texto, e o PDF mostra título duplicado.
 */
export function limparTituloDuplicado(titulo: string, corpo: string): string {
  if (!titulo?.trim()) return corpo
  const linhas = corpo.split('\n')
  if (linhas.length === 0) return corpo
  const primeira = linhas[0].trim().toLowerCase().replace(/[.,;:!?]+$/g, '')
  const tituloNorm = titulo.trim().toLowerCase().replace(/[.,;:!?]+$/g, '')
  // Match exato OU primeira linha contém o título (ex: title prefixado por "1. ")
  if (primeira === tituloNorm || (tituloNorm.length > 8 && primeira.includes(tituloNorm))) {
    return linhas.slice(1).join('\n').replace(/^\n+/, '')
  }
  return corpo
}
