export interface ImovelLite {
  id: string
  titulo: string
  preco: number
  endereco_resumido: string | null
  proprietario_id: string | null
  bairro: { nome: string } | { nome: string }[] | null
  /** True quando o imóvel já tem contrato ativo. Bloqueia seleção. */
  ocupado?: boolean
  /** Código do contrato vigente, pra exibir no card desabilitado. */
  contrato_vigente_codigo?: string | null
}

export interface PessoaLite {
  id: string
  tipo: string
  nome: string
  cpf_cnpj: string | null
}

export interface WizardState {
  // Etapa 1
  imovel_id: string

  // Etapa 2
  inquilino_id: string
  proprietario_id: string

  // Etapa 2b — perfil do contrato
  finalidade: 'residencial' | 'comercial' | 'misto'
  tipo_atuacao: 'administracao' | 'intermediacao' | 'direto'
  intermediador_assina: boolean
  tipo_mobilia: 'sem' | 'semi' | 'parcial' | 'total'
  tem_inventario_bens: boolean
  aceita_pet: 'sim' | 'nao' | 'autorizacao' | 'condominio'
  pet_observacao: string

  // Cobertura do aluguel — quando o aluguel já inclui encargos
  aluguel_inclui_iptu: boolean
  aluguel_inclui_condominio: boolean
  aluguel_inclui_agua: boolean
  aluguel_inclui_energia: boolean
  aluguel_inclui_gas: boolean
  aluguel_inclui_internet: boolean

  // Etapa 3 — garantia
  garantia_tipo: 'fiador' | 'caucao' | 'seguro_fianca' | 'sem_garantia'
  fiador_id: string
  caucao_valor: string
  seguro_fianca_seguradora: string
  seguro_fianca_apolice: string

  // Etapa 4 — valores e datas
  valor_aluguel: string
  valor_seguro_fianca_mensal: string
  valor_seguro_incendio_anual: string
  seguro_incendio_data: string
  iptu_mensal: string
  condominio_mensal: string
  taxa_admin_tipo: 'percentual' | 'fixo'
  taxa_admin_valor: string
  primeira_parcela_cheia: boolean
  data_inicio: string
  data_primeiro_aluguel: string
  data_termino: string
  duracao_meses: string
  dia_vencimento: string
  forma_pagamento: 'boleto' | 'pix' | 'transferencia' | 'dinheiro' | 'cheque'
  pagamento_antecipado: boolean
  data_pagamento_antecipado: string
  observacoes: string
  clausulas_extras: string
  indice_reajuste: string
  data_proximo_reajuste: string
}

export const ESTADO_INICIAL: WizardState = {
  imovel_id: '',
  inquilino_id: '',
  proprietario_id: '',
  finalidade: 'residencial',
  tipo_atuacao: 'administracao',
  intermediador_assina: false,
  tipo_mobilia: 'sem',
  tem_inventario_bens: false,
  aceita_pet: 'nao',
  pet_observacao: '',
  aluguel_inclui_iptu: false,
  aluguel_inclui_condominio: false,
  aluguel_inclui_agua: false,
  aluguel_inclui_energia: false,
  aluguel_inclui_gas: false,
  aluguel_inclui_internet: false,
  garantia_tipo: 'seguro_fianca',
  fiador_id: '',
  caucao_valor: '',
  seguro_fianca_seguradora: '',
  seguro_fianca_apolice: '',
  valor_aluguel: '',
  valor_seguro_fianca_mensal: '',
  valor_seguro_incendio_anual: '',
  seguro_incendio_data: '',
  iptu_mensal: '',
  condominio_mensal: '',
  taxa_admin_tipo: 'percentual',
  taxa_admin_valor: '10',
  primeira_parcela_cheia: false,
  data_inicio: '',
  data_primeiro_aluguel: '',
  data_termino: '',
  duracao_meses: '12',
  dia_vencimento: '5',
  forma_pagamento: 'boleto',
  pagamento_antecipado: false,
  data_pagamento_antecipado: '',
  observacoes: '',
  clausulas_extras: '',
  indice_reajuste: 'IGPM',
  data_proximo_reajuste: '',
}
