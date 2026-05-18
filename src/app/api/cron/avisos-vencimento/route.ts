import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail } from '@/lib/email/sender'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Avisos de vencimento por email — envia 5 dias antes do vencimento.
 *
 * Para rodar diariamente, agende um Cron Job (Vercel/external) que faça:
 *   GET https://aluguelcuiaba.com.br/api/cron/avisos-vencimento
 *   Header: Authorization: Bearer <CRON_SECRET>
 *
 * Variável de ambiente CRON_SECRET protege contra acessos indevidos.
 * Se CRON_SECRET não estiver definido em produção, a rota recusa o request.
 */
export async function GET(req: NextRequest) {
  // Autenticação por bearer token (Vercel Cron usa header igual)
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado.' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const hoje = new Date()
  const alvo = new Date(hoje.getTime() + 5 * 86400000)
  const alvoIso = alvo.toISOString().slice(0, 10)

  // Busca parcelas que vencem no dia alvo (5 dias à frente), não pagas
  const { data: parcelas, error } = await admin
    .from('parcelas_aluguel')
    .select(`
      id, numero, vencimento, valor_total, status_pagamento,
      contrato:contratos_locacao!inner(
        id, codigo, user_id,
        inquilino:pessoas!inquilino_id(nome, email),
        imovel:imoveis(titulo, bairro:bairros(nome))
      )
    `)
    .eq('vencimento', alvoIso)
    .neq('status_pagamento', 'pago')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Inquilino = { nome: string; email: string | null }
  type Imovel = { titulo: string; bairro: { nome: string } | { nome: string }[] | null }
  type Contrato = { id: string; codigo: string; user_id: string; inquilino: Inquilino | Inquilino[] | null; imovel: Imovel | Imovel[] | null }
  type Parcela = {
    id: string; numero: number; vencimento: string; valor_total: number
    contrato: Contrato | Contrato[] | null
  }

  const lista = (parcelas ?? []) as unknown as Parcela[]
  const unwrap = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

  // Cache de perfis pra obter nome do anunciante
  const userIds = Array.from(new Set(
    lista.map(p => unwrap(p.contrato)?.user_id).filter((u): u is string => !!u)
  ))
  const { data: perfis } = await admin
    .from('perfis')
    .select('id, nome')
    .in('id', userIds)
  const nomePorUser = new Map((perfis ?? []).map(p => [p.id, p.nome as string]))

  const resultados: Array<{ parcela_id: string; email: string; ok: boolean; erro?: string }> = []

  for (const p of lista) {
    const c = unwrap(p.contrato)
    if (!c) continue
    const inq = unwrap(c.inquilino)
    if (!inq?.email) continue   // sem email cadastrado

    const imo = unwrap(c.imovel)
    const bairro = imo && unwrap(imo.bairro)
    const anunciante = nomePorUser.get(c.user_id) ?? 'AluguelCuiabá'
    const venc = new Date(p.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')
    const valor = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.valor_total)
    const primeiroNome = inq.nome.split(' ')[0]

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
        <div style="background: #7c3aed; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 18px;">Lembrete de aluguel</h1>
          <p style="margin: 6px 0 0; opacity: 0.9; font-size: 13px;">${anunciante}</p>
        </div>
        <div style="background: #fff; border: 1px solid #e5e7eb; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="font-size: 15px;">Olá <strong>${primeiroNome}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.6;">
            Passando pra lembrar do aluguel${imo?.titulo ? ` do imóvel <strong>${imo.titulo}</strong>` : ''}${bairro?.nome ? ` (${bairro.nome})` : ''}
            com vencimento em <strong>5 dias</strong>.
          </p>
          <div style="background: #f3e8ff; border-radius: 8px; padding: 14px 18px; margin: 18px 0; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #7c3aed; font-weight: bold; letter-spacing: 1px;">VENCE EM</p>
            <p style="margin: 6px 0; font-size: 22px; font-weight: bold; color: #111827;">${venc}</p>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #7c3aed;">${valor}</p>
          </div>
          <p style="font-size: 13px; color: #6b7280;">Qualquer dúvida, fale comigo respondendo este email ou pelo WhatsApp.</p>
          <p style="font-size: 13px; color: #6b7280;">— ${anunciante}</p>
        </div>
        <p style="font-size: 10px; color: #9ca3af; text-align: center; margin-top: 16px;">
          Este é um lembrete automático. Se você já pagou, desconsidere.
        </p>
      </div>
    `

    const subject = `Lembrete: aluguel vence em ${venc}`
    const r = await enviarEmail({ to: inq.email, subject, html })
    resultados.push({ parcela_id: p.id, email: inq.email, ok: !r.error, erro: r.error })
  }

  const enviados = resultados.filter(r => r.ok).length
  const falhas = resultados.filter(r => !r.ok).length

  return NextResponse.json({
    ok: true,
    data_alvo: alvoIso,
    total_elegiveis: lista.length,
    enviados,
    falhas,
    resultados,
  })
}
