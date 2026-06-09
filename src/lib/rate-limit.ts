import 'server-only'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/** IP do cliente (atrás do proxy da Vercel). Funciona em route handlers e server actions. */
export async function ipDaRequisicao(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0].trim() ?? h.get('x-real-ip') ?? 'desconhecido'
}

/**
 * Controle de taxa durável (via RPC rate_limit_hit no Supabase).
 * Retorna true se PERMITIDO, false se estourou o limite.
 *
 * Fail-open: se a checagem falhar (RPC indisponível, migration não rodada),
 * NÃO bloqueia o usuário legítimo — apenas registra no console.
 */
export async function dentroDoLimite(chave: string, limite: number, janelaSeg: number): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('rate_limit_hit', {
      p_chave: chave,
      p_limite: limite,
      p_janela_seg: janelaSeg,
    })
    if (error) {
      console.warn('[rate-limit] RPC falhou, liberando:', error.message)
      return true
    }
    return data === true
  } catch (e) {
    console.warn('[rate-limit] erro, liberando:', e instanceof Error ? e.message : String(e))
    return true
  }
}

/** Açúcar: limita por IP com uma etiqueta de escopo. */
export async function limitePorIp(escopo: string, limite: number, janelaSeg: number): Promise<boolean> {
  const ip = await ipDaRequisicao()
  return dentroDoLimite(`${escopo}:${ip}`, limite, janelaSeg)
}
