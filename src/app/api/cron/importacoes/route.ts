import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { TAG_IMOVEIS } from '@/lib/supabase/public'
import {
  analisarImportacao, iniciarImportacao, opcoesValidas, processarLote, type OpcoesImportacao,
} from '@/lib/importacao/motor'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Cron diário da importação de XML (vercel.json). Ver
 * docs/integracoes/importacao/README.md.
 *
 *  1. Termina importações que ficaram pela metade (a pessoa fechou a aba).
 *  2. Reimporta as URLs com "Atualizar sozinho todo dia" ligado, com as
 *     opções salvas da última importação.
 *
 * Teto de ~4 min por execução: o que não couber continua no dia seguinte
 * (a fila é por item, nada se perde nem duplica).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET não configurado.' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const fim = Date.now() + 240_000
  const db = createAdminClient()
  const log: string[] = []
  let mexeu = false

  const rodarFila = async (id: string) => {
    while (Date.now() < fim - 30_000) {
      const p = await processarLote(id, Math.min(fim, Date.now() + 60_000))
      if (p.mexeuNaVitrine) mexeu = true
      if (p.status !== 'importando' || p.pendentes === 0) return true
    }
    return false
  }

  try {
    // 1. pela metade
    const { data: abertas, error } = await db.from('importacoes').select('id').eq('status', 'importando')
      .order('iniciado_em', { ascending: true }).limit(20)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const a of abertas ?? []) {
      if (Date.now() > fim - 30_000) break
      const terminou = await rodarFila(a.id)
      log.push(`continuada ${a.id}: ${terminou ? 'terminou' : 'segue amanhã'}`)
    }

    // 2. sincronização diária
    const ontem = new Date(Date.now() - 20 * 3600_000).toISOString()
    const { data: fontes } = await db.from('importacoes_fontes')
      .select('id, user_id, url, opcoes, ultima_sincronizacao_em')
      .eq('sincronizar', true)
      .or(`ultima_sincronizacao_em.is.null,ultima_sincronizacao_em.lt.${ontem}`)
      .order('ultima_sincronizacao_em', { ascending: true, nullsFirst: true })
      .limit(20)

    for (const f of fontes ?? []) {
      if (Date.now() > fim - 60_000) break
      const { count } = await db.from('importacoes').select('id', { count: 'exact', head: true })
        .eq('user_id', f.user_id).in('status', ['analisando', 'importando'])
      if (count) { log.push(`fonte ${f.id}: já tem importação aberta`); continue }
      // Já tentou hoje (e deu erro): não insiste até amanhã.
      const { count: hoje } = await db.from('importacoes').select('id', { count: 'exact', head: true })
        .eq('fonte_id', f.id).eq('automatica', true).gte('criado_em', ontem)
      if (hoje) { log.push(`fonte ${f.id}: já tentou hoje`); continue }

      const { data: imp, error: ei } = await db.from('importacoes').insert({
        user_id: f.user_id, fonte_id: f.id, origem: 'url', url: f.url, status: 'analisando', automatica: true,
      }).select('id').single()
      if (ei || !imp) { log.push(`fonte ${f.id}: ${ei?.message}`); continue }

      try {
        await analisarImportacao(imp.id)
        const op = opcoesValidas(f.opcoes as Partial<OpcoesImportacao>, true)
        await iniciarImportacao(imp.id, op)
        const terminou = await rodarFila(imp.id)
        log.push(`fonte ${f.id}: ${terminou ? 'sincronizada' : 'segue amanhã'}`)
      } catch (e) {
        // analisarImportacao já gravou o erro na importação e na fonte.
        log.push(`fonte ${f.id}: erro ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  } finally {
    if (mexeu) revalidateTag(TAG_IMOVEIS, 'max')
  }

  return NextResponse.json({ ok: true, log })
}
