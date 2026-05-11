import nodemailer from 'nodemailer'

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
}: {
  to: string
  subject: string
  html: string
}): Promise<{ error?: string }> {
  try {
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
