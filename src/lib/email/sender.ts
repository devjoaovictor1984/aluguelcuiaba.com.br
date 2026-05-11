import nodemailer from 'nodemailer'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'

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
  element,
}: {
  to: string
  subject: string
  element: ReactElement
}): Promise<{ error?: string }> {
  try {
    const html = renderToStaticMarkup(element)
    await transporter.sendMail({
      from: `${process.env.NEXT_PUBLIC_APP_NAME ?? 'AluguelCuiabá'} <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
    return {}
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email/sender]', msg)
    return { error: msg }
  }
}
