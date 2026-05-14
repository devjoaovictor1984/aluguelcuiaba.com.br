import { createAdminClient } from '@/lib/supabase/admin'

export interface Categoria {
  id: string
  label: string
  cor: string
  descricao?: string | null
  ordem?: number
}

export interface CategoriaStyle {
  label: string
  bg: string
  text: string
  border: string
  gradient: string
}

// Mapa de cores → classes Tailwind. Espelha o que está em /admin/categorias
const COR_STYLES: Record<string, Omit<CategoriaStyle, 'label'>> = {
  violet: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300', gradient: 'from-violet-600 to-violet-900' },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300',   gradient: 'from-blue-600 to-blue-900'     },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', gradient: 'from-orange-500 to-orange-900' },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-700',   border: 'border-teal-300',   gradient: 'from-teal-600 to-teal-900'     },
  green:  { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300',  gradient: 'from-green-600 to-green-900'   },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', gradient: 'from-yellow-500 to-yellow-800' },
  red:    { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300',    gradient: 'from-red-600 to-red-900'       },
  pink:   { bg: 'bg-pink-100',   text: 'text-pink-700',   border: 'border-pink-300',   gradient: 'from-pink-600 to-pink-900'     },
}

const FALLBACK: CategoriaStyle = {
  label: 'Geral',
  ...COR_STYLES.violet,
}

export async function getCategorias(): Promise<Categoria[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('categorias')
    .select('id, label, cor, descricao, ordem')
    .order('ordem')
  return (data ?? []) as Categoria[]
}

export function categoriaStyle(cat: Categoria | undefined | null): CategoriaStyle {
  if (!cat) return FALLBACK
  const cor = COR_STYLES[cat.cor] ?? COR_STYLES.violet
  return { label: cat.label, ...cor }
}

// Helper: monta um Record<id, CategoriaStyle> para lookup rápido
export function categoriasMap(cats: Categoria[]): Record<string, CategoriaStyle> {
  return Object.fromEntries(cats.map(c => [c.id, categoriaStyle(c)]))
}
