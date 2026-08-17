'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Conciliação da comissão de seguros.
 *
 * "Marcar recebida" é o único lugar do sistema onde alguém afirma que
 * dinheiro entrou — por isso guarda VALOR e DATA, e não só um booleano.
 * Sem o valor não dá pra ver que a corretora pagou menos do que devia, e
 * essa diferença é o motivo de a tela existir.
 */

async function exigirAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: perfil } = await supabase
    .from('perfis').select('role').eq('id', user.id).maybeSingle()
  return perfil?.role === 'admin' ? user.id : null
}

type Lado = 'corretor' | 'plataforma'

export async function marcarComissaoRecebida(input: {
  id: string
  lado: Lado
  valor: number
  data: string
}) {
  if (!await exigirAdmin()) return { error: 'Sem permissão.' }
  if (!(input.valor >= 0)) return { error: 'Informe o valor recebido.' }
  if (!input.data) return { error: 'Informe a data do recebimento.' }

  const admin = createAdminClient()
  const p = input.lado === 'corretor'
    ? {
        status_corretor: 'recebida',
        valor_recebido_corretor: input.valor,
        recebido_corretor_em: input.data,
      }
    : {
        status_plataforma: 'recebida',
        valor_recebido_plataforma: input.valor,
        recebido_plataforma_em: input.data,
      }

  const { error } = await admin
    .from('seguro_comissoes')
    .update({ ...p, updated_at: new Date().toISOString() })
    .eq('id', input.id)
  if (error) return { error: error.message }

  revalidatePath('/admin/seguros/comissoes')
  return { ok: true }
}

/** Volta ao estado anterior — lançamento errado acontece. */
export async function reabrirComissao(id: string, lado: Lado) {
  if (!await exigirAdmin()) return { error: 'Sem permissão.' }

  const admin = createAdminClient()
  const p = lado === 'corretor'
    ? { status_corretor: 'prevista', valor_recebido_corretor: null, recebido_corretor_em: null }
    : { status_plataforma: 'prevista', valor_recebido_plataforma: null, recebido_plataforma_em: null }

  const { error } = await admin
    .from('seguro_comissoes')
    .update({ ...p, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/seguros/comissoes')
  return { ok: true }
}

/**
 * Define o override da plataforma e aplica às comissões ainda abertas.
 *
 * Aplica só no que não foi recebido nem cancelado: venda já conciliada
 * mantém a taxa do dia em que aconteceu. Reescrever o passado faria
 * nenhuma conferência antiga fechar.
 */
export async function definirOverride(percentual: number) {
  if (!await exigirAdmin()) return { error: 'Sem permissão.' }
  if (!(percentual >= 0) || percentual > 100) return { error: 'Percentual inválido.' }

  const admin = createAdminClient()
  const fracao = percentual > 1 ? percentual / 100 : percentual

  const { error: eCfg } = await admin.from('site_config').upsert(
    { chave: 'seguro_override_percentual', valor: String(percentual) },
    { onConflict: 'chave' },
  )
  if (eCfg) return { error: eCfg.message }

  const { data: abertas } = await admin
    .from('seguro_comissoes')
    .select('id, premio_total')
    .in('status_plataforma', ['prevista', 'confirmada'])

  for (const c of abertas ?? []) {
    const premio = Number(c.premio_total) || 0
    await admin.from('seguro_comissoes').update({
      percentual_plataforma: fracao,
      valor_plataforma: Math.round(premio * fracao * 100) / 100,
      updated_at: new Date().toISOString(),
    }).eq('id', c.id)
  }

  revalidatePath('/admin/seguros/comissoes')
  return { ok: true, atualizadas: abertas?.length ?? 0 }
}
