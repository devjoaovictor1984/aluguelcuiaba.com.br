import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail } from '@/lib/email/sender'
import { getTemplate, renderTemplate } from '@/lib/email/templates'

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

  // Template editável em /admin/emails (chave 'aviso_aluguel').
  const template = await getTemplate('aviso_aluguel')

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

    const vars = {
      nome: primeiroNome,
      anunciante,
      imovel_titulo: imo?.titulo ?? 'seu imóvel',
      imovel_bairro: bairro?.nome ?? '',
      venc,
      dias: '5',
      valor,
    }

    const r = await enviarEmail({
      to: inq.email,
      subject: renderTemplate(template.assunto, vars),
      html: renderTemplate(template.corpo, vars),
      canal: 'aviso_aluguel',
    })
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
