/**
 * Catálogo de placeholders disponíveis nas cláusulas de contrato.
 * Cada um aparece como {{CHAVE}} no corpo da cláusula e é substituído
 * pelos dados reais na hora de gerar o PDF.
 */

export interface Placeholder {
  chave: string
  label: string
  exemplo: string
  origem: 'locador' | 'locatario' | 'conjuge_locatario' | 'admin' | 'imovel' | 'valores' | 'prazo' | 'garantia' | 'seguro' | 'fiador'
}

export const PLACEHOLDERS: Placeholder[] = [
  // ── Locador (proprietário) ──
  { chave: 'LOCADOR_NOME', label: 'Nome do locador', exemplo: 'RIVÂNIA SILVA PASSOS COUTINHO', origem: 'locador' },
  { chave: 'LOCADOR_CPF', label: 'CPF do locador', exemplo: '361.799.901-82', origem: 'locador' },
  { chave: 'LOCADOR_RG', label: 'RG do locador', exemplo: '15.878.406 SSP/MT', origem: 'locador' },
  { chave: 'LOCADOR_NACIONALIDADE', label: 'Nacionalidade do locador', exemplo: 'brasileira', origem: 'locador' },
  { chave: 'LOCADOR_ESTADO_CIVIL', label: 'Estado civil do locador', exemplo: 'casada', origem: 'locador' },
  { chave: 'LOCADOR_PROFISSAO', label: 'Profissão do locador', exemplo: 'empresária', origem: 'locador' },
  { chave: 'LOCADOR_ENDERECO', label: 'Endereço completo do locador', exemplo: 'Av. dos Florais, Cond. Florais do Valle, Cuiabá-MT', origem: 'locador' },

  // ── Locatário ──
  { chave: 'LOCATARIO_NOME', label: 'Nome do locatário', exemplo: 'HELDER BARBOSA MACIEL', origem: 'locatario' },
  { chave: 'LOCATARIO_CPF', label: 'CPF do locatário', exemplo: '007.208.961-00', origem: 'locatario' },
  { chave: 'LOCATARIO_RG', label: 'RG do locatário (com órgão e UF)', exemplo: '15.878.406 SSP/MT', origem: 'locatario' },
  { chave: 'LOCATARIO_NACIONALIDADE', label: 'Nacionalidade do locatário', exemplo: 'brasileiro', origem: 'locatario' },
  { chave: 'LOCATARIO_ESTADO_CIVIL', label: 'Estado civil do locatário', exemplo: 'casado', origem: 'locatario' },
  { chave: 'LOCATARIO_REGIME_BENS', label: 'Regime de bens (se casado)', exemplo: 'comunhão parcial de bens', origem: 'locatario' },
  { chave: 'LOCATARIO_PROFISSAO', label: 'Profissão do locatário', exemplo: 'corretor de imóveis', origem: 'locatario' },
  { chave: 'LOCATARIO_DATA_NASC', label: 'Data de nascimento do locatário', exemplo: '01/10/1988', origem: 'locatario' },
  { chave: 'LOCATARIO_NATURALIDADE', label: 'Naturalidade do locatário', exemplo: 'Várzea Grande-MT', origem: 'locatario' },
  { chave: 'LOCATARIO_NOME_PAI', label: 'Nome do pai do locatário', exemplo: 'Hélio Gonçalo Maciel', origem: 'locatario' },
  { chave: 'LOCATARIO_NOME_MAE', label: 'Nome da mãe do locatário', exemplo: 'Valdeth Barbosa Maciel', origem: 'locatario' },
  { chave: 'LOCATARIO_ENDERECO', label: 'Endereço completo do locatário', exemplo: 'Rua Manoel Cavalcante Proença, 547, Goiabeiras, Cuiabá-MT', origem: 'locatario' },

  // ── Cônjuge do locatário (quando aplicável) ──
  { chave: 'CONJUGE_NOME', label: 'Nome do cônjuge do locatário', exemplo: 'JULLIANA MIKAELLA DIAS JORGE MACIEL', origem: 'conjuge_locatario' },
  { chave: 'CONJUGE_CPF', label: 'CPF do cônjuge', exemplo: '023.193.271-50', origem: 'conjuge_locatario' },
  { chave: 'CONJUGE_RG', label: 'RG do cônjuge (com órgão e UF)', exemplo: '18.688.365 SESP/MT', origem: 'conjuge_locatario' },
  { chave: 'CONJUGE_DATA_NASC', label: 'Data nascimento cônjuge', exemplo: '02/05/1989', origem: 'conjuge_locatario' },
  { chave: 'CONJUGE_PROFISSAO', label: 'Profissão do cônjuge', exemplo: 'empresária', origem: 'conjuge_locatario' },
  { chave: 'CONJUGE_NACIONALIDADE', label: 'Nacionalidade do cônjuge', exemplo: 'brasileira', origem: 'conjuge_locatario' },
  { chave: 'CONJUGE_NATURALIDADE', label: 'Naturalidade do cônjuge', exemplo: 'Rondonópolis-MT', origem: 'conjuge_locatario' },
  { chave: 'CONJUGE_NOME_PAI', label: 'Nome do pai do cônjuge', exemplo: 'Luiz Jorge', origem: 'conjuge_locatario' },
  { chave: 'CONJUGE_NOME_MAE', label: 'Nome da mãe do cônjuge', exemplo: 'Jandira Nogueira Dias Jorge', origem: 'conjuge_locatario' },
  { chave: 'CONJUGE_ENDERECO', label: 'Endereço do cônjuge (vazio = mesmo do titular)', exemplo: 'Rua X, 100, Bairro Y, Cuiabá-MT', origem: 'conjuge_locatario' },

  // ── Administradora (imobiliária do corretor) ──
  { chave: 'ADMIN_RAZAO_SOCIAL', label: 'Razão social da administradora', exemplo: 'IMOBILIATTO', origem: 'admin' },
  { chave: 'ADMIN_CNPJ', label: 'CNPJ da administradora', exemplo: '45.528.182/0001-06', origem: 'admin' },
  { chave: 'ADMIN_CRECI_J', label: 'CRECI Jurídico da administradora', exemplo: '14137-J', origem: 'admin' },
  { chave: 'ADMIN_ENDERECO', label: 'Endereço da administradora', exemplo: 'Rua Américo Salgado, 1044-B, Araés, Cuiabá-MT', origem: 'admin' },
  { chave: 'ADMIN_RESPONSAVEL', label: 'Corretor responsável', exemplo: 'JOÃO VICTOR VIEIRA', origem: 'admin' },
  { chave: 'ADMIN_RESPONSAVEL_CRECI', label: 'CRECI do corretor responsável', exemplo: '12130-F', origem: 'admin' },

  // ── Imóvel ──
  { chave: 'IMOVEL_ENDERECO', label: 'Endereço do imóvel locado', exemplo: 'Casa Térrea, Av. São Sebastião, 1389, Goiabeiras, Cuiabá-MT', origem: 'imovel' },
  { chave: 'IMOVEL_CEP', label: 'CEP do imóvel', exemplo: '78032-160', origem: 'imovel' },
  { chave: 'IMOVEL_MATRICULA', label: 'Matrícula do imóvel no cartório', exemplo: '123456', origem: 'imovel' },
  { chave: 'IMOVEL_INSC_MUNICIPAL', label: 'Inscrição municipal/IPTU do imóvel', exemplo: '12.345.678-9', origem: 'imovel' },
  { chave: 'IMOVEL_UC_ENERGIA', label: 'UC da concessionária de energia', exemplo: '987654321', origem: 'imovel' },
  { chave: 'IMOVEL_MATRICULA_AGUA', label: 'Matrícula da água/hidrômetro', exemplo: 'A-12345', origem: 'imovel' },
  { chave: 'IMOVEL_DESCRICAO', label: 'Descrição detalhada do imóvel', exemplo: 'Casa térrea, 3 quartos sendo 1 suíte, sala, cozinha…', origem: 'imovel' },
  { chave: 'IMOVEL_AREA_CONSTRUIDA', label: 'Área construída', exemplo: '120 m²', origem: 'imovel' },
  { chave: 'IMOVEL_AREA_TERRENO', label: 'Área do terreno', exemplo: '250 m²', origem: 'imovel' },
  { chave: 'IMOVEL_CARTORIO', label: 'Cartório de registro do imóvel', exemplo: '1º Ofício de Registro de Imóveis de Cuiabá', origem: 'imovel' },
  { chave: 'IMOVEL_LIVRO_FOLHA', label: 'Livro/folha da matrícula', exemplo: 'Livro 2, folha 123', origem: 'imovel' },
  { chave: 'IMOVEL_HIDROMETRO_NUMERO', label: 'Número do hidrômetro', exemplo: 'A-12345', origem: 'imovel' },
  { chave: 'IMOVEL_HIDROMETRO_LEITURA', label: 'Leitura inicial do hidrômetro', exemplo: '00012345', origem: 'imovel' },
  { chave: 'IMOVEL_MEDIDOR_ENERGIA_NUMERO', label: 'Número do medidor de energia', exemplo: 'M-98765', origem: 'imovel' },
  { chave: 'IMOVEL_MEDIDOR_ENERGIA_LEITURA', label: 'Leitura inicial do medidor de energia', exemplo: '0098765', origem: 'imovel' },

  // ── Valores ──
  { chave: 'ALUGUEL_VALOR', label: 'Valor do aluguel', exemplo: 'R$ 3.500,00', origem: 'valores' },
  { chave: 'ALUGUEL_EXTENSO', label: 'Valor do aluguel por extenso', exemplo: 'três mil e quinhentos reais', origem: 'valores' },
  { chave: 'IPTU_VALOR', label: 'Valor mensal do IPTU', exemplo: 'R$ 300,00', origem: 'valores' },
  { chave: 'VENCIMENTO_DIA', label: 'Dia do vencimento', exemplo: '25', origem: 'valores' },
  { chave: 'TOTAL_MENSAL', label: 'Total mensal (aluguel + IPTU)', exemplo: 'R$ 3.800,00', origem: 'valores' },

  // ── Prazo ──
  { chave: 'PRAZO_MESES', label: 'Prazo em meses', exemplo: '30', origem: 'prazo' },
  { chave: 'PRAZO_EXTENSO', label: 'Prazo por extenso', exemplo: 'trinta', origem: 'prazo' },
  { chave: 'DATA_INICIO', label: 'Data de início', exemplo: '25/05/2026', origem: 'prazo' },
  { chave: 'DATA_FIM', label: 'Data de término', exemplo: '24/11/2028', origem: 'prazo' },

  // ── Garantias ──
  { chave: 'CAUCAO_VALOR', label: 'Valor total da caução', exemplo: 'R$ 10.500,00', origem: 'garantia' },
  { chave: 'CAUCAO_MESES', label: 'Quantos meses de caução', exemplo: '3', origem: 'garantia' },
  { chave: 'CAUCAO_EXTENSO', label: 'Caução por extenso', exemplo: 'dez mil e quinhentos reais', origem: 'garantia' },

  // ── Fiador ──
  { chave: 'FIADOR_NOME', label: 'Nome do fiador', exemplo: 'JOÃO DA SILVA', origem: 'fiador' },
  { chave: 'FIADOR_CPF', label: 'CPF do fiador', exemplo: '000.000.000-00', origem: 'fiador' },
  { chave: 'FIADOR_RG', label: 'RG do fiador', exemplo: '00.000.000 SSP/MT', origem: 'fiador' },
  { chave: 'FIADOR_ENDERECO', label: 'Endereço do fiador', exemplo: 'Rua X, 100, Centro, Cuiabá-MT', origem: 'fiador' },

  // ── Seguro fiança / incêndio ──
  { chave: 'SEGURO_SEGURADORA', label: 'Nome da seguradora', exemplo: 'Porto Seguro', origem: 'seguro' },
  { chave: 'SEGURO_APOLICE', label: 'Número da apólice', exemplo: '00.000.000.0000', origem: 'seguro' },
  { chave: 'SEGURO_VALOR', label: 'Valor da cobertura', exemplo: 'R$ 100.000,00', origem: 'seguro' },
  { chave: 'SEGURO_VIGENCIA', label: 'Vigência da apólice', exemplo: '12 meses', origem: 'seguro' },

  // ── Contrato de Administração (proprietário ↔ administradora) ──
  { chave: 'ADM_CODIGO', label: 'Código do contrato de administração', exemplo: 'ADM2026-001', origem: 'valores' },
  { chave: 'ADM_DATA_INICIO', label: 'Início da administração', exemplo: '01/01/2026', origem: 'prazo' },
  { chave: 'ADM_DATA_TERMINO', label: 'Término da administração', exemplo: '31/12/2026', origem: 'prazo' },
  { chave: 'ADM_PRAZO_MESES', label: 'Prazo da administração em meses', exemplo: '12', origem: 'prazo' },
  { chave: 'ADM_TAXA_VALOR', label: 'Valor/percentual da taxa de administração', exemplo: '10%', origem: 'valores' },
  { chave: 'ADM_TAXA_DESCRICAO', label: 'Descrição da taxa', exemplo: '10% (dez por cento) sobre o aluguel', origem: 'valores' },
  { chave: 'ADM_DIA_REPASSE', label: 'Dia do repasse ao proprietário', exemplo: '5', origem: 'valores' },
  { chave: 'ADM_AVISO_PREVIO_DIAS', label: 'Dias de aviso prévio pra rescisão', exemplo: '30', origem: 'prazo' },
  { chave: 'ADM_MULTA_MESES', label: 'Multa rescisória em meses', exemplo: '3', origem: 'garantia' },
  { chave: 'ADM_EXCLUSIVIDADE', label: 'Exclusividade (sim/não)', exemplo: 'em regime de exclusividade', origem: 'admin' },
]

export const TIPOS_CLAUSULA = [
  { valor: 'generica',         label: 'Genéricas',        descricao: 'Vão em todos os contratos' },
  { valor: 'sem_garantia',     label: 'Sem garantia',     descricao: 'Quando o contrato é celebrado sem nenhuma garantia locatícia' },
  { valor: 'caucao',           label: 'Caução',           descricao: 'Só quando a garantia é caução em dinheiro' },
  { valor: 'fiador',           label: 'Fiador',           descricao: 'Só quando há fiador pessoa física' },
  { valor: 'seguro_fianca',    label: 'Seguro fiança',    descricao: 'Só quando contratado seguro fiança' },
  { valor: 'seguro_incendio',  label: 'Seguro incêndio',  descricao: 'Variações: cobrado à parte, embutido no pacote ou dispensado' },
  { valor: 'adicional',        label: 'Adicionais',       descricao: 'Opcionais, escolhidas caso a caso' },
  { valor: 'administracao',    label: 'Administração',    descricao: 'Cláusulas do contrato de administração imobiliária (entre proprietário e admin)' },
] as const

export type TipoClausula = typeof TIPOS_CLAUSULA[number]['valor']

export const CATEGORIAS_ORDEM = [
  'partes',         // 1. Das partes
  'objeto',         // 2. Do objeto da locação
  'prazo',          // 3. Do prazo, início e entrega das chaves
  'aluguel',        // 4. Do aluguel, IPTU e encargos
  'caucao',         // 5. Da caução (só em contrato com caução)
  'fiador',         //    Do fiador (só com fiador)
  'seguro',         //    Do seguro
  'reajuste',       // 6. Do reajuste
  'mora',           // 7. Da mora e cobrança
  'destinacao',     // 8. Da destinação e ocupação
  'conservacao',    // 9. Da conservação
  'vistoria',       // 10. Da vistoria
  'modificacoes',   // 11. Das modificações e obras
  'visitas',        // 12. Das visitas e vistorias periódicas
  'preferencia',    // 13. Direito de preferência
  'obrigacoes_loc', // 14. Obrigações dos locatários
  'obrigacoes_adm', // 15. Obrigações da locadora/administradora
  'rescisao',       // 16. Rescisão e multa
  'inadimplencia',  // 17. Inadimplência grave
  'comunicacoes',   // 18. Comunicações
  'anexos',         // 19. Anexos
  'finais',         // 20. Disposições finais
] as const
