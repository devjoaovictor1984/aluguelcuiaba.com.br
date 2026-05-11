import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatarPreco(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor)
}

export function formatarData(data: string): string {
  return format(new Date(data), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

export function tempoRelativo(data: string): string {
  return formatDistanceToNow(new Date(data), { locale: ptBR, addSuffix: true })
}

export function gerarLinkWhatsApp(numero: string, mensagem: string): string {
  const numeroLimpo = numero.replace(/\D/g, '')
  const msg = encodeURIComponent(mensagem)
  return `https://wa.me/${numeroLimpo}?text=${msg}`
}

export function gerarMensagemWhatsApp(titulo: string, bairro?: string): string {
  return `Olá! Vi o anúncio "${titulo}"${bairro ? ` no ${bairro}` : ''} no AluguelCuiabá e tenho interesse. Poderia me dar mais informações?`
}

export function validarWhatsApp(numero: string): boolean {
  const limpo = numero.replace(/\D/g, '')
  return limpo.length === 11 || limpo.length === 13
}

export function diasParaExpirar(data: string): number {
  const expira = new Date(data)
  const hoje = new Date()
  const diff = expira.getTime() - hoje.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-|-$/g, '')
}
