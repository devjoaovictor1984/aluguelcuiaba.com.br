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
