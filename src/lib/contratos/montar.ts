/**
 * Monta o contrato: pega dados crus (contrato + pessoas + imóvel + admin)
 * e substitui os placeholders nas cláusulas selecionadas.
 *
 * Não decide qual cláusula entra — a ordem vem do clausula_ids do
 * contrato_geracoes. Aqui só preenchemos os {{NOME}} com dados reais.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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

    default: return `{{${chave}}}`  // não conhecido: mantém pra usuário ver
  }
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
