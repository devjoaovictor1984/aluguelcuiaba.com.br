// Máscaras de input em tempo real (formato BR)

export function maskCpf(value: string): string {
  const v = value.replace(/\D/g, '').slice(0, 11)
  return v
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function maskCnpj(value: string): string {
  const v = value.replace(/\D/g, '').slice(0, 14)
  return v
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/** Detecta automaticamente CPF (até 11 dígitos) ou CNPJ (14) */
export function maskCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 11) return maskCpf(value)
  return maskCnpj(value)
}

export function maskTelefone(value: string): string {
  const v = value.replace(/\D/g, '').slice(0, 11)
  if (v.length <= 10) {
    return v
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  }
  return v
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

export function maskCep(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{1,3})$/, '$1-$2')
}

/**
 * Moeda BR — sempre exibe com 2 casas: "1.900,00".
 * Internamente trabalha em centavos.
 * Exemplo: digitar "190000" → "1.900,00"
 */
export function maskMoney(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const n = parseInt(digits, 10)
  return (n / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Converte string formatada (BR) em número.
 * Lida com "1.900,00", "1900,00", "1900", "1900.50".
 */
export function parseMoney(value: string | null | undefined): number {
  if (!value) return 0
  const cleaned = String(value).replace(/[^\d,.-]/g, '')
  if (!cleaned) return 0
  // Se tem vírgula, ela é o separador decimal (formato BR)
  if (cleaned.includes(',')) {
    const semMilhar = cleaned.replace(/\./g, '').replace(',', '.')
    return parseFloat(semMilhar) || 0
  }
  // Sem vírgula: pode ter ponto como decimal (ex: 1900.5) ou milhar (ex: 1.900)
  // Heurística: se tem ponto seguido de 3 dígitos no final, é milhar
  if (/\.\d{3}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '')) || 0
  }
  return parseFloat(cleaned) || 0
}

/** Percentual BR — só aceita 0..100 com vírgula. Ex: "10,5" */
export function maskPercentual(value: string): string {
  const cleaned = value.replace(/[^\d,]/g, '')
  // Permite só uma vírgula
  const parts = cleaned.split(',')
  const inteira = parts[0].slice(0, 3) // máx 100
  const decimal = parts[1]?.slice(0, 2)
  return decimal !== undefined ? `${inteira},${decimal}` : inteira
}

export function parsePercentual(value: string | null | undefined): number {
  if (!value) return 0
  const n = parseFloat(String(value).replace(',', '.'))
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

/** Formata data ISO (YYYY-MM-DD) para DD/MM/AAAA */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = String(iso).slice(0, 10)
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

/** Helper p/ formatar número como BRL */
export function formatarBRL(n: number | null | undefined): string {
  if (n == null) return 'R$ 0,00'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
