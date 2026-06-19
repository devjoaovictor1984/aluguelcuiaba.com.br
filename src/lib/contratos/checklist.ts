/**
 * Checklist pré-PDF — valida inconsistências críticas antes de gerar.
 *
 * Cada regra retorna:
 *  - 'ok'      → tudo certo
 *  - 'warn'    → aviso, gera mas com alerta visual
 *  - 'block'   → impede a geração até o usuário corrigir
 *
 * Usado em /api/contratos/[id]/pdf (server) e no editor (cliente).
 */

export type Severidade = 'ok' | 'warn' | 'block'

export interface ItemChecklist {
  id: string
  rotulo: string
  severidade: Severidade
  mensagem?: string
}

export interface DadosChecklist {
  // Tipo de atuação
  tipo_atuacao: 'administracao' | 'intermediacao' | 'direto'
  admin_cnpj?: string | null
  admin_creci_juridico?: string | null

  // Mobília
  tipo_mobilia: 'sem' | 'semi' | 'parcial' | 'total'
  tem_inventario_bens: boolean

  // Partes
  locador_nome?: string | null
  locador_cpf?: string | null
  locatario_nome?: string | null
  locatario_cpf?: string | null
  imovel_endereco?: string | null

  // Garantia
  garantia_tipo?: string | null
  fiador_nome?: string | null
  seguro_fianca_seguradora?: string | null
  seguro_fianca_apolice?: string | null
  caucao_valor?: number | null

  // Datas e valores
  data_inicio?: string | null
  data_termino?: string | null
  duracao_meses?: number | null
  valor_aluguel?: number | null
  dia_vencimento?: number | null
}

export function rodarChecklist(d: DadosChecklist): ItemChecklist[] {
  const itens: ItemChecklist[] = []

  // ── Partes essenciais ──
  itens.push({
    id: 'locador',
    rotulo: 'Locador identificado',
    severidade: d.locador_nome && d.locador_cpf ? 'ok' : 'block',
    mensagem: d.locador_nome ? (d.locador_cpf ? undefined : 'CPF/CNPJ do locador em branco') : 'Locador sem nome',
  })

  itens.push({
    id: 'locatario',
    rotulo: 'Locatário identificado',
    severidade: d.locatario_nome && d.locatario_cpf ? 'ok' : 'block',
    mensagem: d.locatario_nome ? (d.locatario_cpf ? undefined : 'CPF/CNPJ do locatário em branco') : 'Locatário sem nome',
  })

  itens.push({
    id: 'imovel',
    rotulo: 'Endereço do imóvel',
    severidade: d.imovel_endereco ? 'ok' : 'block',
    mensagem: d.imovel_endereco ? undefined : 'Endereço do imóvel em branco',
  })

  // ── Tipo de atuação ──
  if (d.tipo_atuacao === 'administracao') {
    itens.push({
      id: 'admin_cnpj',
      rotulo: 'CNPJ da administradora',
      severidade: d.admin_cnpj ? 'ok' : 'warn',
      mensagem: d.admin_cnpj ? undefined : 'CNPJ vazio — o contrato sairá sem CNPJ da administradora',
    })
    itens.push({
      id: 'admin_creci_j',
      rotulo: 'CRECI Jurídico',
      severidade: d.admin_creci_juridico ? 'ok' : 'warn',
      mensagem: d.admin_creci_juridico ? undefined : 'CRECI-J em branco — recomendado preencher no /painel/perfil',
    })
  }

  // ── Garantia ──
  if (d.garantia_tipo === 'fiador' && !d.fiador_nome) {
    itens.push({
      id: 'fiador',
      rotulo: 'Fiador definido',
      severidade: 'block',
      mensagem: 'Garantia é fiador mas nenhum fiador foi selecionado',
    })
  } else if (d.garantia_tipo === 'seguro_fianca') {
    itens.push({
      id: 'seguro',
      rotulo: 'Seguro fiança',
      severidade: d.seguro_fianca_seguradora && d.seguro_fianca_apolice ? 'ok' : 'block',
      mensagem: !d.seguro_fianca_seguradora ? 'Seguradora em branco'
        : !d.seguro_fianca_apolice ? 'Número da apólice em branco' : undefined,
    })
  } else if (d.garantia_tipo === 'caucao') {
    itens.push({
      id: 'caucao',
      rotulo: 'Valor da caução',
      severidade: d.caucao_valor && d.caucao_valor > 0 ? 'ok' : 'block',
      mensagem: d.caucao_valor ? undefined : 'Valor da caução em branco ou zero',
    })
  }

  // ── Mobília + inventário ──
  if (d.tipo_mobilia !== 'sem' && !d.tem_inventario_bens) {
    itens.push({
      id: 'inventario',
      rotulo: 'Inventário de bens',
      severidade: 'warn',
      mensagem: `Imóvel ${d.tipo_mobilia === 'total' ? '100% mobiliado' : d.tipo_mobilia + '-mobiliado'} sem inventário anexado — recomenda-se anexar antes de assinar.`,
    })
  }

  // ── Datas ──
  itens.push({
    id: 'data_inicio',
    rotulo: 'Data de início',
    severidade: d.data_inicio ? 'ok' : 'block',
    mensagem: d.data_inicio ? undefined : 'Data de início obrigatória',
  })

  itens.push({
    id: 'data_termino',
    rotulo: 'Data de término calculada',
    severidade: d.data_termino ? 'ok' : 'warn',
    mensagem: d.data_termino ? undefined : 'Data de término em branco — recomenda-se preencher pra evitar "[PREENCHER]" no contrato',
  })

  // ── Valores ──
  itens.push({
    id: 'aluguel',
    rotulo: 'Valor do aluguel',
    severidade: d.valor_aluguel && d.valor_aluguel > 0 ? 'ok' : 'block',
    mensagem: d.valor_aluguel ? undefined : 'Aluguel em branco ou zero',
  })

  return itens
}

// ─────────────────────────────────────────────────────────────────────────────
// Checklist do CONTRATO DE ADMINISTRAÇÃO (proprietário ↔ administradora).
// Mínimos diferentes do contrato de locação: aqui o foco é a administradora
// (CNPJ/CRECI-J), a taxa, o repasse e as cláusulas essenciais selecionadas.
// ─────────────────────────────────────────────────────────────────────────────
export interface DadosChecklistAdm {
  proprietario_nome?: string | null
  proprietario_cpf?: string | null
  admin_cnpj?: string | null
  admin_creci_juridico?: string | null
  taxa_valor?: number | null
  dia_repasse?: number | null
  exclusividade?: boolean
  // categorias das cláusulas atualmente no contrato (ex.: 'objeto','remuneracao')
  categorias_presentes: string[]
}

export function rodarChecklistAdm(d: DadosChecklistAdm): ItemChecklist[] {
  const itens: ItemChecklist[] = []
  const tem = (cat: string) => d.categorias_presentes.includes(cat)

  // ── Partes / qualificação ──
  itens.push({
    id: 'proprietario',
    rotulo: 'Proprietário identificado',
    severidade: d.proprietario_nome && d.proprietario_cpf ? 'ok' : 'block',
    mensagem: d.proprietario_nome
      ? (d.proprietario_cpf ? undefined : 'CPF/CNPJ do proprietário em branco')
      : 'Proprietário sem nome',
  })
  itens.push({
    id: 'admin_cnpj',
    rotulo: 'CNPJ da administradora',
    severidade: d.admin_cnpj ? 'ok' : 'warn',
    mensagem: d.admin_cnpj ? undefined : 'CNPJ vazio — preencha em /painel/perfil',
  })
  itens.push({
    id: 'admin_creci_j',
    rotulo: 'CRECI Jurídico',
    severidade: d.admin_creci_juridico ? 'ok' : 'warn',
    mensagem: d.admin_creci_juridico ? undefined : 'CRECI-J em branco — recomendado em /painel/perfil',
  })

  // ── Valores / operacional ──
  itens.push({
    id: 'taxa',
    rotulo: 'Taxa de administração',
    severidade: d.taxa_valor && d.taxa_valor > 0 ? 'ok' : 'block',
    mensagem: d.taxa_valor && d.taxa_valor > 0 ? undefined : 'Taxa em branco ou zero',
  })
  itens.push({
    id: 'dia_repasse',
    rotulo: 'Dia de repasse',
    severidade: d.dia_repasse ? 'ok' : 'warn',
    mensagem: d.dia_repasse ? undefined : 'Dia de repasse não definido',
  })

  // ── Cláusulas essenciais (presença por categoria) ──
  itens.push({
    id: 'cl_objeto',
    rotulo: 'Cláusula de objeto/mandato',
    severidade: tem('objeto') ? 'ok' : 'warn',
    mensagem: tem('objeto') ? undefined : 'Sem cláusula de objeto — adicione no editor',
  })
  itens.push({
    id: 'cl_remuneracao',
    rotulo: 'Cláusula de remuneração',
    severidade: tem('remuneracao') ? 'ok' : 'block',
    mensagem: tem('remuneracao') ? undefined : 'Sem cláusula de remuneração — adicione no editor',
  })
  itens.push({
    id: 'cl_repasse',
    rotulo: 'Cláusula de repasse / prestação de contas',
    severidade: tem('repasse') ? 'ok' : 'warn',
    mensagem: tem('repasse') ? undefined : 'Sem cláusula de repasse',
  })
  if (d.exclusividade) {
    itens.push({
      id: 'cl_exclusividade',
      rotulo: 'Cláusula de exclusividade',
      severidade: tem('exclusividade') ? 'ok' : 'warn',
      mensagem: tem('exclusividade') ? undefined : 'Marcado como exclusivo, mas sem a cláusula de exclusividade',
    })
  }
  itens.push({
    id: 'cl_rescisao',
    rotulo: 'Cláusula de rescisão / inadimplência',
    severidade: tem('inadimplencia') || tem('rescisao') ? 'ok' : 'warn',
    mensagem: (tem('inadimplencia') || tem('rescisao')) ? undefined : 'Sem cláusula de rescisão/inadimplência',
  })

  return itens
}

// Itens essenciais de um contrato de administração que o corretor confirma
// manualmente (não dá pra inferir automaticamente do texto livre da cláusula).
// Baseado nos elementos obrigatórios de um contrato de administração imobiliária.
export interface ItemEssencialAdm {
  chave: string
  rotulo: string
  dica: string
}

export const ITENS_ESSENCIAIS_ADM: ItemEssencialAdm[] = [
  { chave: 'qualificacao_partes', rotulo: 'Qualificação das partes', dica: 'Proprietário(a) e administradora com nome, CPF/CNPJ, estado civil e endereço.' },
  { chave: 'identificacao_imovel', rotulo: 'Identificação do imóvel', dica: 'Endereço completo, matrícula no cartório e condições (vistoria).' },
  { chave: 'escopo_servicos', rotulo: 'Escopo dos serviços', dica: 'Intermediação (captação) e/ou gestão (cobrança, repasse, boletos, inadimplência).' },
  { chave: 'taxa_administracao', rotulo: 'Taxa de administração', dica: 'Percentual mensal sobre o aluguel.' },
  { chave: 'taxa_captacao', rotulo: 'Taxa de captação / 1º aluguel', dica: 'Valor pela busca do inquilino e contrato inicial.' },
  { chave: 'juros_multas', rotulo: 'Destino de juros e multas', dica: 'De quem ficam os juros/multa de atraso do aluguel.' },
  { chave: 'manutencao_limite', rotulo: 'Manutenção e limite emergencial', dica: 'Reparos do administrador e limite de custo sem consultar o proprietário.' },
  { chave: 'poderes_judiciais', rotulo: 'Poderes e medidas judiciais', dica: 'O que o admin pode firmar/representar e quem custeia despejo/cobrança.' },
  { chave: 'vigencia', rotulo: 'Vigência (início e término)', dica: 'Datas de início e fim do contrato.' },
  { chave: 'multa_rescisao', rotulo: 'Multa rescisória', dica: 'Penalidade por encerrar antes do prazo.' },
  { chave: 'aviso_previo', rotulo: 'Aviso prévio', dica: 'Prazo mínimo (30–90 dias) pra notificar o encerramento.' },
]

export function bloqueiaGeracao(itens: ItemChecklist[]): boolean {
  return itens.some(i => i.severidade === 'block')
}

export function contagem(itens: ItemChecklist[]): { ok: number; warn: number; block: number } {
  return {
    ok: itens.filter(i => i.severidade === 'ok').length,
    warn: itens.filter(i => i.severidade === 'warn').length,
    block: itens.filter(i => i.severidade === 'block').length,
  }
}
