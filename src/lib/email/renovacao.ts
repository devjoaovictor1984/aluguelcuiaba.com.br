import { DIAS_EXPIRACAO } from '@/lib/constants'

interface ImovelAviso {
  id: string
  titulo: string
  dias: number
}

const roxo = '#7c3aed'
const vermelho = '#dc2626'
const fundo = '#f3f4f6'

export function emailAvisoVencimentoHtml(imovel: ImovelAviso): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'AluguelCuiabá'
  const painelUrl = `${appUrl}/painel`
  const urgente = imovel.dias <= 3
  const cor = urgente ? vermelho : roxo
  const emoji = urgente ? '⚠️' : '📅'
  const titulo = urgente ? 'Seu anúncio vence em breve!' : 'Lembrete de renovação'
  const diasStr = `${imovel.dias} dia${imovel.dias !== 1 ? 's' : ''}`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:24px;background:${fundo};font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

    <div style="background:${cor};padding:32px 24px;text-align:center;">
      <p style="margin:0 0 8px;font-size:28px;">${emoji}</p>
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:bold;">${titulo}</h1>
    </div>

    <div style="padding:32px 24px;">
      <p style="color:#374151;font-size:16px;line-height:1.6;margin-top:0;">
        Seu anúncio <strong>&quot;${imovel.titulo}&quot;</strong> vence em
        <strong style="color:${cor};">${diasStr}</strong>.
      </p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Renove agora para manter seu imóvel visível para inquilinos.
        A renovação estende a validade por mais <strong>${DIAS_EXPIRACAO} dias</strong> gratuitamente.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${painelUrl}"
          style="display:inline-block;background:${roxo};color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
          Renovar meu anúncio
        </a>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
        Acesse seu painel em
        <a href="${painelUrl}" style="color:${roxo};text-decoration:none;">${painelUrl}</a>
      </p>
    </div>

    <div style="background:${fundo};padding:16px 24px;text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.5;">
        Você recebe este e-mail porque tem um anúncio ativo no ${appName}.<br/>
        Este é um e-mail automático — não responda.
      </p>
    </div>

  </div>
</body>
</html>`
}
