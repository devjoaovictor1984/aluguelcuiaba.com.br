import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DIAS_AVISO_EXPIRACAO } from '@/lib/constants'
import { getTemplate, renderTemplate } from '@/lib/email/templates'
import { enviarEmail } from '@/lib/email/sender'

// Vercel cron jobs e chamadas manuais passam Authorization: Bearer {CRON_SECRET}
function autorizado(request: NextRequest) {
  const auth = request.headers.get('authorization')
  return process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`
}

async function executar() {
  const admin = createAdminClient()
  const agora = new Date()

  // 1. Expirar anúncios ativos que passaram do prazo
  const { error: errExpirar } = await admin
    .from('imoveis')
    .update({ status: 'expirado' })
    .eq('status', 'ativo')
    .lt('expira_em', agora.toISOString())

  if (errExpirar) console.error('[renovar] expirar:', errExpirar.message)

  // 2. Buscar anúncios que vencem nos próximos DIAS_AVISO_EXPIRACAO e ainda não receberam aviso
  const limite = new Date(agora)
  limite.setDate(limite.getDate() + DIAS_AVISO_EXPIRACAO)

  const { data: imoveis, error: errBusca } = await admin
    .from('imoveis')
    .select('id, titulo, expira_em, user_id')
    .eq('status', 'ativo')
    .eq('aviso_enviado', false)
    .gt('expira_em', agora.toISOString())
    .lte('expira_em', limite.toISOString())

  if (errBusca) return { error: errBusca.message, status: 500 }
  if (!imoveis?.length) return { expirados: true, enviados: 0 }

  // 3. Enviar e-mail para cada dono
  const idsEnviados: string[] = []
  const erros: string[] = []
  const template = await getTemplate('aviso_vencimento')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  for (const imovel of imoveis) {
    const { data: userData, error: errUser } = await admin.auth.admin.getUserById(imovel.user_id)
    const email = userData?.user?.email

    if (errUser || !email) {
      erros.push(`sem e-mail: ${imovel.id}`)
      continue
    }

    const dias = Math.ceil(
      (new Date(imovel.expira_em).getTime() - agora.getTime()) / 86_400_000
    )

    const vars = { titulo: imovel.titulo, dias: String(dias), painel_url: `${appUrl}/painel`, nome: email }

    const { error: errEmail } = await enviarEmail({
      to: email,
      subject: renderTemplate(template.assunto, vars),
      html: renderTemplate(template.corpo, vars),
      canal: 'aviso_vencimento',
    })

    if (errEmail) {
      erros.push(`${email}: ${errEmail}`)
    } else {
      idsEnviados.push(imovel.id)
    }
  }

  // 4. Marcar aviso_enviado nos que foram enviados
  if (idsEnviados.length) {
    await admin.from('imoveis').update({ aviso_enviado: true }).in('id', idsEnviados)
  }

  return {
    enviados: idsEnviados.length,
    total: imoveis.length,
    erros: erros.length ? erros : undefined,
  }
}

// GET — invocado pelo cron da Vercel (Authorization: Bearer CRON_SECRET automático)
export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const resultado = await executar()
  if ('status' in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status as number })
  }
  return NextResponse.json(resultado)
}

// POST — para disparos manuais / testes
export async function POST(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const resultado = await executar()
  if ('status' in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status as number })
  }
  return NextResponse.json(resultado)
}
