export interface ImovelLite {
  id: string
  titulo: string
  preco: number
  endereco_resumido: string | null
  proprietario_id: string | null
  bairro: { nome: string } | { nome: string }[] | null
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
  observacoes: string
  clausulas_extras: string
  indice_reajuste: string
  data_proximo_reajuste: string
}

export const ESTADO_INICIAL: WizardState = {
  imovel_id: '',
  inquilino_id: '',
  proprietario_id: '',
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
  observacoes: '',
  clausulas_extras: '',
  indice_reajuste: 'IGPM',
  data_proximo_reajuste: '',
}
