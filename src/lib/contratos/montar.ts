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
  } | null
}

// ── Formatadores ──
const fmtBRL = (v: number | null | undefined): string => {
  if (v == null) return '[PREENCHER]'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

const fmtData = (iso: string | null | undefined): string => {
  if (!iso) return '[PREENCHER]'
  const s = iso.slice(0, 10)
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

const fmtCpf = (s: string | null | undefined): string => {
  if (!s) return '[PREENCHER]'
  const d = s.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return s
}

const fmtCnpj = (s: string | null | undefined): string => {
  if (!s) return '[PREENCHER]'
  const d = s.replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return s
}

const fmtCep = (s: string | null | undefined): string => {
  if (!s) return '[PREENCHER]'
  const d = s.replace(/\D/g, '')
  if (d.length === 8) return d.replace(/^(\d{5})(\d{3})$/, '$1-$2')
  return s
}

const numeroPorExtenso = (n: number | null | undefined): string => {
  if (n == null) return '[PREENCHER]'
  // Implementação simples — pra valores típicos de aluguel/prazo
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
  const dezenas10a19 = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  if (n === 0) return 'zero'
  if (n < 10) return unidades[n]
  if (n < 20) return dezenas10a19[n - 10]
  if (n < 100) {
    const d = Math.floor(n / 10)
    const u = n % 10
    return u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`
  }
  return String(n)
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

/**
 * Resolve um placeholder pelo nome (sem as chaves) com base nos dados.
 */
function resolverPlaceholder(chave: string, dados: DadosContrato): string {
  const FALLBACK = '[PREENCHER]'

  switch (chave) {
    // ── Locador ──
    case 'LOCADOR_NOME': return dados.locador?.nome ?? FALLBACK
    case 'LOCADOR_CPF': return fmtCpf(dados.locador?.cpf_cnpj)
    case 'LOCADOR_RG': return rgCompleto(dados.locador)
    case 'LOCADOR_NACIONALIDADE': return dados.locador?.nacionalidade ?? FALLBACK
    case 'LOCADOR_ESTADO_CIVIL': return dados.locador?.estado_civil ?? FALLBACK
    case 'LOCADOR_PROFISSAO': return dados.locador?.profissao ?? FALLBACK
    case 'LOCADOR_ENDERECO': return enderecoCompleto(dados.locador)

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
    case 'ALUGUEL_EXTENSO': return numeroPorExtenso(dados.contrato?.valor_aluguel ? Math.floor(dados.contrato.valor_aluguel) : null) + ' reais'
    case 'IPTU_VALOR': return fmtBRL(dados.contrato?.iptu_mensal ?? 0)
    case 'VENCIMENTO_DIA': return dados.contrato?.dia_vencimento != null ? String(dados.contrato.dia_vencimento) : FALLBACK
    case 'TOTAL_MENSAL': {
      const a = dados.contrato?.valor_aluguel ?? 0
      const i = dados.contrato?.iptu_mensal ?? 0
      const c = dados.contrato?.condominio_mensal ?? 0
      return fmtBRL(a + i + c)
    }

    // ── Prazo ──
    case 'PRAZO_MESES': return dados.contrato?.duracao_meses != null ? String(dados.contrato.duracao_meses) : '30'
    case 'PRAZO_EXTENSO': return numeroPorExtenso(dados.contrato?.duracao_meses ?? 30)
    case 'DATA_INICIO': return fmtData(dados.contrato?.data_inicio)
    case 'DATA_FIM': return fmtData(dados.contrato?.data_termino)

    // ── Caução ──
    case 'CAUCAO_VALOR': return fmtBRL(dados.contrato?.caucao_valor)
    case 'CAUCAO_EXTENSO': return numeroPorExtenso(dados.contrato?.caucao_valor ? Math.floor(dados.contrato.caucao_valor) : null) + ' reais'
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

    // ── Seguro ──
    case 'SEGURO_SEGURADORA': return dados.contrato?.seguro_fianca_seguradora ?? FALLBACK
    case 'SEGURO_APOLICE': return dados.contrato?.seguro_fianca_apolice ?? FALLBACK
    case 'SEGURO_VALOR': return fmtBRL(dados.contrato?.valor_seguro_fianca_mensal)
    case 'SEGURO_VIGENCIA': return '12 meses'

    default: return `{{${chave}}}`  // não conhecido: mantém pra usuário ver
  }
}

/**
 * Aplica todos os placeholders no corpo da cláusula.
 */
export function aplicarPlaceholders(corpo: string, dados: DadosContrato): string {
  return corpo.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, chave) => resolverPlaceholder(chave, dados))
}
