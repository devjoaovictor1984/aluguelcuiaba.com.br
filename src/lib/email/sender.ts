import nodemailer from 'nodemailer'
import { registrarEnvio } from '@/lib/envios/logger'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.hostinger.com',
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function enviarEmail({
  to,
  subject,
  html,
  canal,
}: {
  to: string
  subject: string
  html: string
  /** Identifica o template/origem do envio (ex: 'boas_vindas', 'aviso_aluguel'). */
  canal?: string
}): Promise<{ error?: string }> {
  try {
    await transporter.sendMail({
      from: `${process.env.NEXT_PUBLIC_APP_NAME ?? 'AluguelCuiabá'} <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
    registrarEnvio({
      tipo: 'email',
      canal: canal ?? null,
      destinatario: to,
      status: 'ok',
      contexto: { assunto: subject.slice(0, 200) },
    }).catch(() => null)
    return {}
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email/sender]', msg)
    registrarEnvio({
      tipo: 'email',
      canal: canal ?? null,
      destinatario: to,
      status: 'erro',
      erro_msg: msg,
      contexto: { assunto: subject.slice(0, 200) },
    }).catch(() => null)
    return { error: msg }
  }
}
