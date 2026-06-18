export const TIPOS_IMOVEL = [
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'kitnet', label: 'Kitnet / Studio' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'terreno', label: 'Terreno' },
] as const

export const FAIXAS_PRECO = [
  { label: 'Até R$ 800', min: 0, max: 800 },
  { label: 'R$ 800 a R$ 1.500', min: 800, max: 1500 },
  { label: 'R$ 1.500 a R$ 2.500', min: 1500, max: 2500 },
  { label: 'R$ 2.500 a R$ 4.000', min: 2500, max: 4000 },
  { label: 'Acima de R$ 4.000', min: 4000, max: undefined },
] as const

export const QUARTOS_OPCOES = [
  { value: 1, label: '1 quarto' },
  { value: 2, label: '2 quartos' },
  { value: 3, label: '3 quartos' },
  { value: 4, label: '4+ quartos' },
] as const

export const PLANOS = {
  free:          { nome: 'Gratuito',      imoveis: 1,   fotos: 20, destaque: false, preco: 0     },
  basico:        { nome: 'Básico',        imoveis: 10,  fotos: 20, destaque: false, preco: 14.90 },
  profissional:  { nome: 'Profissional',  imoveis: 999, fotos: 20, destaque: true,  preco: 24.90 },
} as const

export const DIAS_EXPIRACAO = 30
export const DIAS_AVISO_EXPIRACAO = 7
export const MAX_RENOVACOES_FREE = 3
