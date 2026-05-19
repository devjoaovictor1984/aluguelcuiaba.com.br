import { createAdminClient } from '@/lib/supabase/admin'

export type TipoEnvio = 'email' | 'push'
export type StatusEnvio = 'ok' | 'erro' | 'morta'

export interface RegistroEnvio {
  tipo: TipoEnvio
  canal: string | null
  destinatario: string | null
  status: StatusEnvio
  erro_msg?: string | null
  contexto?: Record<string, unknown> | null
}

/**
 * Registra um envio no envios_log. Fire-and-forget — nunca quebra o envio
 * principal se a inserção falhar (ex: migration v18 ainda não rodou).
 *
 * Use destinatário truncado em URL longa (endpoint do push):
 *   const dest = endpoint.length > 80 ? endpoint.slice(0, 80) + '…' : endpoint
 */
export async function registrarEnvio(r: RegistroEnvio): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('envios_log').insert({
      tipo: r.tipo,
      canal: r.canal,
      destinatario: r.destinatario?.slice(0, 200) ?? null,
      status: r.status,
      erro_msg: r.erro_msg?.slice(0, 500) ?? null,
      contexto: r.contexto ?? null,
    })
  } catch (e) {
    // Logger nunca pode quebrar o caller — só console.warn pra debug.
    if (typeof console !== 'undefined') {
      console.warn('[envios_log] falha ao registrar:', e instanceof Error ? e.message : String(e))
    }
  }
}
