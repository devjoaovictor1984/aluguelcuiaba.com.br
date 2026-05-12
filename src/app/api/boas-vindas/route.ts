import { NextRequest, NextResponse } from 'next/server'
import { enviarEmail } from '@/lib/email/sender'
import { getTemplate, renderTemplate } from '@/lib/email/templates'

export async function POST(request: NextRequest) {
  try {
    const { nome, email } = await request.json()
    if (!nome || !email) return NextResponse.json({ ok: false }, { status: 400 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const template = await getTemplate('boas_vindas')

    const vars = { nome, email, painel_url: `${appUrl}/painel` }

    const { error } = await enviarEmail({
      to: email,
      subject: renderTemplate(template.assunto, vars),
      html: renderTemplate(template.corpo, vars),
    })

    if (error) return NextResponse.json({ ok: false, error }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
