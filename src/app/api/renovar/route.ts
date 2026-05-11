import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { DIAS_AVISO_EXPIRACAO, DIAS_EXPIRACAO } from '@/lib/constants'
import { EmailAvisoVencimento } from '@/lib/email/renovacao'

const resend = new Resend(process.env.RESEND_API_KEY)

// Protegido por Bearer token — configure CRON_SECRET no .env.local
// e passe o mesmo valor no header Authorization ao chamar de um cron job.
export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const agora = new Date()

  // 1. Marcar como expirado todos os anúncios ativos que já passaram do prazo
  const { error: errExpirar } = await admin
    .from('imoveis')
    .update({ status: 'expirado' })
    .eq('status', 'ativo')
    .lt('expira_em', agora.toISOString())

  if (errExpirar) {
    console.error('[renovar] erro ao expirar anúncios:', errExpirar.message)
  }

  // 2. Buscar anúncios ativos que vencem nos próximos DIAS_AVISO_EXPIRACAO dias
  //    e ainda não receberam aviso
  const limiteAviso = new Date(agora)
  limiteAviso.setDate(limiteAviso.getDate() + DIAS_AVISO_EXPIRACAO)

  const { data: imoveis, error: errBusca } = await admin
    .from('imoveis')
    .select('id, titulo, expira_em, user_id')
    .eq('status', 'ativo')
    .eq('aviso_enviado', false)
    .gt('expira_em', agora.toISOString())
    .lte('expira_em', limiteAviso.toISOString())

  if (errBusca) {
    return NextResponse.json({ error: errBusca.message }, { status: 500 })
  }

  if (!imoveis?.length) {
    return NextResponse.json({ expirados: true, enviados: 0 })
  }

  // 3. Enviar e-mail para cada dono e coletar IDs bem-sucedidos
  const idsEnviados: string[] = []
  const erros: string[] = []

  for (const imovel of imoveis) {
    const { data: userData, error: errUser } = await admin.auth.admin.getUserById(imovel.user_id)
    const email = userData?.user?.email

    if (errUser || !email) {
      erros.push(`sem e-mail para imovel ${imovel.id}`)
      continue
    }

    const dias = Math.ceil(
      (new Date(imovel.expira_em).getTime() - agora.getTime()) / 86_400_000
    )

    const { error: errEmail } = await resend.emails.send({
      from: `${process.env.NEXT_PUBLIC_APP_NAME} <nao-responda@${new URL(process.env.NEXT_PUBLIC_APP_URL!).hostname}>`,
      to: email,
      subject: `Seu anúncio vence em ${dias} dia${dias !== 1 ? 's' : ''} — renove agora`,
      react: EmailAvisoVencimento({ imovel: { id: imovel.id, titulo: imovel.titulo, dias } }),
    })

    if (errEmail) {
      erros.push(`erro ao enviar para ${email}: ${errEmail.message}`)
    } else {
      idsEnviados.push(imovel.id)
    }
  }

  // 4. Marcar aviso_enviado nos que foram enviados com sucesso
  if (idsEnviados.length) {
    await admin
      .from('imoveis')
      .update({ aviso_enviado: true })
      .in('id', idsEnviados)
  }

  return NextResponse.json({
    enviados: idsEnviados.length,
    total: imoveis.length,
    erros: erros.length ? erros : undefined,
  })
}
