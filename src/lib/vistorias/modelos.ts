/**
 * Modelos padrão de vistoria — cômodos e itens pré-preenchidos
 * pra acelerar a criação. Corretor pode adicionar/remover livremente.
 */

export type EstadoItem = 'perfeito' | 'bom' | 'regular' | 'danificado' | 'nao_aplicavel'

export const LABEL_ESTADO: Record<EstadoItem, string> = {
  perfeito: 'Perfeito',
  bom: 'Bom',
  regular: 'Regular',
  danificado: 'Danificado',
  nao_aplicavel: 'N/A',
}

export const COR_ESTADO: Record<EstadoItem, string> = {
  perfeito: 'bg-green-100 text-green-700 border-green-200',
  bom: 'bg-blue-100 text-blue-700 border-blue-200',
  regular: 'bg-amber-100 text-amber-700 border-amber-200',
  danificado: 'bg-red-100 text-red-700 border-red-200',
  nao_aplicavel: 'bg-gray-100 text-gray-500 border-gray-200',
}

export interface ItemModelo { comodo: string; item: string }

/**
 * Lista padrão: cobre os itens mais comuns em locação residencial.
 * A vistoria de COMERCIAL pode usar um subset ou ser preenchida do zero.
 */
export const ITENS_PADRAO: ItemModelo[] = [
  // Sala
  { comodo: 'Sala', item: 'Paredes' },
  { comodo: 'Sala', item: 'Piso' },
  { comodo: 'Sala', item: 'Teto' },
  { comodo: 'Sala', item: 'Tomadas e interruptores' },
  { comodo: 'Sala', item: 'Iluminação (lâmpadas/luminárias)' },
  { comodo: 'Sala', item: 'Janelas e venezianas' },
  { comodo: 'Sala', item: 'Porta de entrada' },

  // Cozinha
  { comodo: 'Cozinha', item: 'Paredes e azulejos' },
  { comodo: 'Cozinha', item: 'Piso' },
  { comodo: 'Cozinha', item: 'Teto' },
  { comodo: 'Cozinha', item: 'Pia / cuba / torneira' },
  { comodo: 'Cozinha', item: 'Bancada' },
  { comodo: 'Cozinha', item: 'Armários' },
  { comodo: 'Cozinha', item: 'Tomadas (alta voltagem do fogão)' },
  { comodo: 'Cozinha', item: 'Saída de gás' },
  { comodo: 'Cozinha', item: 'Janela' },

  // Quarto 1
  { comodo: 'Quarto 1', item: 'Paredes' },
  { comodo: 'Quarto 1', item: 'Piso' },
  { comodo: 'Quarto 1', item: 'Teto' },
  { comodo: 'Quarto 1', item: 'Tomadas e interruptores' },
  { comodo: 'Quarto 1', item: 'Janela e venezianas' },
  { comodo: 'Quarto 1', item: 'Porta' },
  { comodo: 'Quarto 1', item: 'Armário embutido (se houver)' },

  // Banheiro
  { comodo: 'Banheiro', item: 'Paredes e azulejos' },
  { comodo: 'Banheiro', item: 'Piso' },
  { comodo: 'Banheiro', item: 'Teto' },
  { comodo: 'Banheiro', item: 'Vaso sanitário' },
  { comodo: 'Banheiro', item: 'Pia / cuba / torneira' },
  { comodo: 'Banheiro', item: 'Box / blindex' },
  { comodo: 'Banheiro', item: 'Chuveiro / ducha' },
  { comodo: 'Banheiro', item: 'Espelho' },
  { comodo: 'Banheiro', item: 'Janela / ventilação' },

  // Área de serviço
  { comodo: 'Área de serviço', item: 'Paredes' },
  { comodo: 'Área de serviço', item: 'Piso' },
  { comodo: 'Área de serviço', item: 'Tanque' },
  { comodo: 'Área de serviço', item: 'Torneira' },
  { comodo: 'Área de serviço', item: 'Saída de máquina de lavar' },

  // Externo / geral
  { comodo: 'Geral', item: 'Pintura externa' },
  { comodo: 'Geral', item: 'Portão / entrada' },
  { comodo: 'Geral', item: 'Quintal / jardim' },
  { comodo: 'Geral', item: 'Garagem' },
  { comodo: 'Geral', item: 'Caixa d\'água' },
  { comodo: 'Geral', item: 'Hidrômetro (leitura inicial)' },
  { comodo: 'Geral', item: 'Medidor de luz (leitura inicial)' },
]

/**
 * Agrupa itens por cômodo, na ordem em que aparecem em ITENS_PADRAO.
 */
export function agruparPorComodo(itens: Array<{ comodo: string; item: string; estado?: EstadoItem }>): Record<string, Array<{ item: string; estado?: EstadoItem }>> {
  const out: Record<string, Array<{ item: string; estado?: EstadoItem }>> = {}
  for (const i of itens) {
    if (!out[i.comodo]) out[i.comodo] = []
    out[i.comodo].push({ item: i.item, estado: i.estado })
  }
  return out
}
