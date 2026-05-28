/**
 * Seções essenciais de um contrato de locação residencial — a barra de
 * progresso no editor conta quantas dessas estão presentes.
 *
 * Cada seção tem um id (slug interno), label legível e a(s) categoria(s)
 * de cláusula que satisfazem aquela seção. Ex.: "Garantia" pode vir de
 * 'caucao', 'fiador', 'seguro' ou 'sem_garantia'.
 *
 * Usado em:
 *  - ProgressoContrato (cálculo de % e listagem de chips)
 *  - Catálogo de cláusulas (badge ★ pra essenciais)
 *  - Modal de criar cláusula nova (selecionar qual seção a cláusula cobre)
 */

export interface SecaoEssencial {
  id: string                // slug interno, ex: 'partes'
  label: string             // ex: 'Das partes'
  categorias: string[]      // categorias de contrato_clausulas.categoria que satisfazem
}

export const SECOES_ESSENCIAIS: SecaoEssencial[] = [
  { id: 'fundamentacao', label: 'Fundamentação legal',  categorias: ['fundamentacao'] },
  { id: 'partes',        label: 'Das partes',           categorias: ['partes'] },
  { id: 'objeto',        label: 'Objeto da locação',    categorias: ['objeto'] },
  { id: 'prazo',         label: 'Prazo',                categorias: ['prazo'] },
  { id: 'aluguel',       label: 'Aluguel e encargos',   categorias: ['aluguel'] },
  { id: 'reajuste',      label: 'Reajuste',             categorias: ['reajuste'] },
  { id: 'mora',          label: 'Mora e cobrança',      categorias: ['mora'] },
  { id: 'garantia',      label: 'Garantia',             categorias: ['caucao', 'fiador', 'seguro', 'sem_garantia'] },
  { id: 'vistoria',      label: 'Vistoria / Chaves',    categorias: ['vistoria', 'chaves'] },
  { id: 'obrigacoes',    label: 'Obrigações',           categorias: ['obrigacoes_loc', 'obrigacoes_adm'] },
  { id: 'rescisao',      label: 'Rescisão e multa',     categorias: ['rescisao'] },
  { id: 'manutencao',    label: 'Manutenção',           categorias: ['conservacao', 'modificacoes'] },
  { id: 'preferencia',   label: 'Direito de preferência', categorias: ['preferencia'] },
  { id: 'comunicacoes',  label: 'Comunicações',         categorias: ['comunicacoes'] },
  { id: 'foro',          label: 'Foro',                 categorias: ['foro'] },
]

/** Retorna o id da seção essencial que a categoria cobre, ou null. */
export function secaoDaCategoria(categoria: string): string | null {
  for (const s of SECOES_ESSENCIAIS) {
    if (s.categorias.includes(categoria)) return s.id
  }
  return null
}

/** True se a categoria conta como uma seção essencial. */
export function isCategoriaEssencial(categoria: string): boolean {
  return secaoDaCategoria(categoria) !== null
}

/** Retorna a SecaoEssencial completa pelo id, ou undefined. */
export function buscarSecao(id: string): SecaoEssencial | undefined {
  return SECOES_ESSENCIAIS.find(s => s.id === id)
}
