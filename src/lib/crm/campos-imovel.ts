/**
 * Campos do imóvel que o link de cadastro pode pedir à proprietária.
 *
 * Uma lista só, usada em três pontas: o painel (o que pedir), a página
 * pública (o que mostrar e como) e quem grava (pra qual coluna de
 * `imoveis` vai cada resposta). As chaves levam o prefixo `imovel_` porque
 * o mesmo formulário tem `endereco_cep` e `inscricao_municipal` da pessoa.
 *
 * `coluna` vazia = não existe coluna no imóvel pra isso (bairro em texto,
 * aluguel pretendido, quartos…). A resposta fica em `dados_imovel` e é
 * usada pra pré-preencher o anúncio novo.
 */

export type FormatoCampoImovel = 'texto' | 'numero' | 'inteiro' | 'cep' | 'tipo' | 'mobiliado' | 'longo'

export interface CampoImovel {
  chave: string
  label: string
  /** Rótulo curto pro chip do painel. */
  curto: string
  grupo: string
  formato: FormatoCampoImovel
  coluna?: string
  dica?: string
}

export const CAMPOS_IMOVEL: CampoImovel[] = [
  // ── Endereço ──
  { chave: 'imovel_tipo', label: 'Tipo do imóvel', curto: 'Tipo', grupo: 'Endereço', formato: 'tipo' },
  { chave: 'imovel_condominio_nome', label: 'Nome do condomínio / edifício', curto: 'Nome do condomínio', grupo: 'Endereço', formato: 'texto', coluna: 'condominio_nome', dica: 'Deixe em branco se não for condomínio.' },
  { chave: 'imovel_endereco_cep', label: 'CEP do imóvel', curto: 'CEP', grupo: 'Endereço', formato: 'cep', coluna: 'endereco_cep' },
  { chave: 'imovel_endereco_logradouro', label: 'Rua / avenida', curto: 'Logradouro', grupo: 'Endereço', formato: 'texto', coluna: 'endereco_completo' },
  { chave: 'imovel_endereco_numero', label: 'Número', curto: 'Número', grupo: 'Endereço', formato: 'texto', coluna: 'endereco_numero' },
  { chave: 'imovel_endereco_complemento', label: 'Complemento (apto, bloco, quadra, lote)', curto: 'Complemento', grupo: 'Endereço', formato: 'texto', coluna: 'endereco_complemento' },
  { chave: 'imovel_endereco_bairro', label: 'Bairro', curto: 'Bairro', grupo: 'Endereço', formato: 'texto' },
  { chave: 'imovel_endereco_cidade', label: 'Cidade / UF', curto: 'Cidade', grupo: 'Endereço', formato: 'texto' },

  // ── Registro ──
  { chave: 'imovel_matricula_cartorio', label: 'Número da matrícula no cartório', curto: 'Matrícula', grupo: 'Registro e IPTU', formato: 'texto', coluna: 'matricula_cartorio', dica: 'Está no topo da certidão de matrícula.' },
  { chave: 'imovel_cartorio_registro', label: 'Cartório de registro', curto: 'Cartório', grupo: 'Registro e IPTU', formato: 'texto', coluna: 'cartorio_registro', dica: 'Ex.: 1º Ofício de Registro de Imóveis de Cuiabá' },
  { chave: 'imovel_inscricao_municipal', label: 'Inscrição imobiliária (IPTU)', curto: 'Inscrição IPTU', grupo: 'Registro e IPTU', formato: 'texto', coluna: 'inscricao_municipal', dica: 'Aparece no carnê do IPTU.' },
  { chave: 'imovel_iptu_anual', label: 'Valor anual do IPTU (R$)', curto: 'Valor do IPTU', grupo: 'Registro e IPTU', formato: 'numero', coluna: 'iptu', dica: 'O total do ano, como está no carnê.' },

  // ── Contas ──
  { chave: 'imovel_uc_energia', label: 'Unidade consumidora de energia (Energisa)', curto: 'UC energia', grupo: 'Contas de consumo', formato: 'texto', coluna: 'uc_energia', dica: 'Número da UC, na conta de luz.' },
  { chave: 'imovel_matricula_agua', label: 'Matrícula / código da água', curto: 'Matrícula água', grupo: 'Contas de consumo', formato: 'texto', coluna: 'matricula_agua', dica: 'Na conta de água (Águas Cuiabá).' },
  { chave: 'imovel_uc_gas', label: 'Código do gás encanado', curto: 'Código gás', grupo: 'Contas de consumo', formato: 'texto', coluna: 'uc_gas', dica: 'Se o imóvel tiver gás encanado.' },

  // ── Valores ──
  { chave: 'imovel_valor_aluguel', label: 'Valor de aluguel pretendido (R$)', curto: 'Aluguel pretendido', grupo: 'Valores', formato: 'numero' },
  { chave: 'imovel_taxa_condominio', label: 'Valor do condomínio (R$/mês)', curto: 'Valor condomínio', grupo: 'Valores', formato: 'numero', coluna: 'taxa_condominio' },
  { chave: 'imovel_administradora_condominio', label: 'Administradora ou síndico do condomínio (nome e telefone)', curto: 'Síndico/administradora', grupo: 'Valores', formato: 'texto' },

  // ── Características ──
  { chave: 'imovel_area_construida_m2', label: 'Área construída / privativa (m²)', curto: 'Área construída', grupo: 'Características', formato: 'numero', coluna: 'area_construida_m2' },
  { chave: 'imovel_area_terreno_m2', label: 'Área do terreno (m²)', curto: 'Área terreno', grupo: 'Características', formato: 'numero', coluna: 'area_terreno_m2' },
  { chave: 'imovel_quartos', label: 'Quartos', curto: 'Quartos', grupo: 'Características', formato: 'inteiro' },
  { chave: 'imovel_suites', label: 'Suítes', curto: 'Suítes', grupo: 'Características', formato: 'inteiro' },
  { chave: 'imovel_banheiros', label: 'Banheiros', curto: 'Banheiros', grupo: 'Características', formato: 'inteiro' },
  { chave: 'imovel_vagas', label: 'Vagas de garagem', curto: 'Vagas', grupo: 'Características', formato: 'inteiro' },
  { chave: 'imovel_mobiliado', label: 'Mobília', curto: 'Mobília', grupo: 'Características', formato: 'mobiliado' },
  { chave: 'imovel_observacoes', label: 'Algo mais sobre o imóvel?', curto: 'Observações', grupo: 'Características', formato: 'longo', dica: 'Reformas, o que fica no imóvel, se aceita pet, chaves…' },
]

export const CHAVES_CAMPO_IMOVEL = CAMPOS_IMOVEL.map(c => c.chave)

export const CAMPO_IMOVEL_POR_CHAVE: Record<string, CampoImovel> =
  Object.fromEntries(CAMPOS_IMOVEL.map(c => [c.chave, c]))

export const LABEL_MOBILIADO: Record<string, string> = {
  nao: 'Sem mobília',
  semi: 'Semimobiliado',
  sim: 'Mobiliado',
}

/**
 * "1.234,56" e "1234.56" viram 1234.56. Quem preenche é a proprietária,
 * no celular, então aceita os dois jeitos.
 */
export function numeroBr(s: string | null | undefined): number | null {
  if (!s) return null
  let t = s.replace(/[^\d.,]/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  // "1.200" sem vírgula é mil e duzentos, não um vírgula dois.
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  const n = parseFloat(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Respostas → colunas de `imoveis`. Só entra o que veio preenchido: a
 * proprietária deixar um campo em branco não apaga o que o corretor já
 * tinha digitado no imóvel.
 */
export function dadosImovelParaColunas(dados: Record<string, string>): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const c of CAMPOS_IMOVEL) {
    if (!c.coluna) continue
    const v = (dados[c.chave] ?? '').trim()
    if (!v) continue
    if (c.formato === 'numero' || c.formato === 'inteiro') {
      const n = numeroBr(v)
      if (n === null) continue
      // Na tabela o IPTU é mensal (é o que o anúncio mostra e o boleto cobra).
      out[c.coluna] = c.chave === 'imovel_iptu_anual' ? Math.round((n / 12) * 100) / 100 : n
    } else if (c.formato === 'cep') {
      const cep = v.replace(/\D/g, '')
      if (cep) out[c.coluna] = cep
    } else {
      out[c.coluna] = v
    }
  }
  return out
}

/** Colunas do imóvel → valores do formulário, pra pré-preencher o link. */
export function colunasParaDadosImovel(im: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of CAMPOS_IMOVEL) {
    if (!c.coluna) continue
    const v = im[c.coluna]
    if (v === null || v === undefined || v === '') continue
    if (c.chave === 'imovel_iptu_anual' && typeof v === 'number') {
      out[c.chave] = (Math.round(v * 12 * 100) / 100).toString().replace('.', ',')
    } else if (typeof v === 'number') {
      out[c.chave] = v.toString().replace('.', ',')
    } else {
      out[c.chave] = String(v)
    }
  }
  if (typeof im.tipo === 'string') out.imovel_tipo = im.tipo
  return out
}
