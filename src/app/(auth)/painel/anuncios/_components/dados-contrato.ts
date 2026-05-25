/**
 * Dados reais do imóvel pro contrato — separados dos dados de anúncio.
 * Todos opcionais: vazio = puxa do anúncio na hora de gerar contrato.
 */
export interface DadosContrato {
  endereco_completo: string
  endereco_numero: string
  endereco_complemento: string
  endereco_cep: string
  matricula_cartorio: string
  inscricao_municipal: string
  uc_energia: string
  matricula_agua: string
  area_construida_m2: string  // string no form pra aceitar vírgula; converte no save
  area_terreno_m2: string
  descricao_real: string
}

export const DADOS_CONTRATO_VAZIO: DadosContrato = {
  endereco_completo: '',
  endereco_numero: '',
  endereco_complemento: '',
  endereco_cep: '',
  matricula_cartorio: '',
  inscricao_municipal: '',
  uc_energia: '',
  matricula_agua: '',
  area_construida_m2: '',
  area_terreno_m2: '',
  descricao_real: '',
}

/** Hidrata a partir do Imovel (linha do banco) — converte null em ''. */
export function dadosContratoDeImovel(im: Partial<{
  endereco_completo: string | null
  endereco_numero: string | null
  endereco_complemento: string | null
  endereco_cep: string | null
  matricula_cartorio: string | null
  inscricao_municipal: string | null
  uc_energia: string | null
  matricula_agua: string | null
  area_construida_m2: number | null
  area_terreno_m2: number | null
  descricao_real: string | null
}>): DadosContrato {
  return {
    endereco_completo: im.endereco_completo ?? '',
    endereco_numero: im.endereco_numero ?? '',
    endereco_complemento: im.endereco_complemento ?? '',
    endereco_cep: im.endereco_cep ?? '',
    matricula_cartorio: im.matricula_cartorio ?? '',
    inscricao_municipal: im.inscricao_municipal ?? '',
    uc_energia: im.uc_energia ?? '',
    matricula_agua: im.matricula_agua ?? '',
    area_construida_m2: im.area_construida_m2?.toString().replace('.', ',') ?? '',
    area_terreno_m2: im.area_terreno_m2?.toString().replace('.', ',') ?? '',
    descricao_real: im.descricao_real ?? '',
  }
}

/** Converte pro payload do banco. Strings vazias viram NULL; números são parseados. */
export function dadosContratoParaDb(d: DadosContrato): Record<string, string | number | null> {
  const trimOrNull = (s: string): string | null => {
    const t = s.trim()
    return t.length > 0 ? t : null
  }
  const numOrNull = (s: string): number | null => {
    const t = s.trim().replace(',', '.')
    if (!t) return null
    const n = parseFloat(t)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  return {
    endereco_completo: trimOrNull(d.endereco_completo),
    endereco_numero: trimOrNull(d.endereco_numero),
    endereco_complemento: trimOrNull(d.endereco_complemento),
    endereco_cep: d.endereco_cep.replace(/\D/g, '') || null,
    matricula_cartorio: trimOrNull(d.matricula_cartorio),
    inscricao_municipal: trimOrNull(d.inscricao_municipal),
    uc_energia: trimOrNull(d.uc_energia),
    matricula_agua: trimOrNull(d.matricula_agua),
    area_construida_m2: numOrNull(d.area_construida_m2),
    area_terreno_m2: numOrNull(d.area_terreno_m2),
    descricao_real: trimOrNull(d.descricao_real),
  }
}
