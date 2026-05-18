import { createAdminClient } from '@/lib/supabase/admin'

// Renders {{variavel}} placeholders in a template string
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

export type ChaveTemplate = 'boas_vindas' | 'aviso_vencimento' | 'aviso_aluguel'

// Fetches subject + body from site_config, falls back to defaults
export async function getTemplate(chave: ChaveTemplate): Promise<{ assunto: string; corpo: string }> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('site_config')
      .select('chave, valor')
      .in('chave', [`email_${chave}_assunto`, `email_${chave}_corpo`])

    const cfg = Object.fromEntries((data ?? []).map(c => [c.chave, c.valor ?? '']))
    const assunto = cfg[`email_${chave}_assunto`] || DEFAULT_TEMPLATES[chave].assunto
    const corpo = cfg[`email_${chave}_corpo`] || DEFAULT_TEMPLATES[chave].corpo
    return { assunto, corpo }
  } catch {
    return DEFAULT_TEMPLATES[chave]
  }
}

const roxo = '#7c3aed'
const fundo = '#f3f4f6'

export const DEFAULT_TEMPLATES: Record<string, { assunto: string; corpo: string }> = {
  boas_vindas: {
    assunto: 'Bem-vindo ao AluguelCuiabá! 🎉',
    corpo: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:24px;background:${fundo};font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:${roxo};padding:32px 24px;text-align:center;">
      <p style="margin:0 0 8px;font-size:28px;">🎉</p>
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:bold;">Bem-vindo ao AluguelCuiabá!</h1>
    </div>
    <div style="padding:32px 24px;">
      <p style="color:#374151;font-size:16px;line-height:1.6;margin-top:0;">
        Olá, <strong>{{nome}}</strong>!
      </p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;">
        Sua conta foi criada com sucesso. Agora você pode anunciar seus imóveis gratuitamente e receber contatos direto pelo WhatsApp.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="{{painel_url}}" style="display:inline-block;background:${roxo};color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
          Acessar meu painel
        </a>
      </div>
    </div>
    <div style="background:${fundo};padding:16px 24px;text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.5;">
        Este é um e-mail automático — não responda.
      </p>
    </div>
  </div>
</body>
</html>`,
  },

  aviso_vencimento: {
    assunto: 'Seu anúncio vence em {{dias}} dia(s) — renove agora',
    corpo: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:24px;background:${fundo};font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:${roxo};padding:32px 24px;text-align:center;">
      <p style="margin:0 0 8px;font-size:28px;">📅</p>
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:bold;">Lembrete de renovação</h1>
    </div>
    <div style="padding:32px 24px;">
      <p style="color:#374151;font-size:16px;line-height:1.6;margin-top:0;">
        Seu anúncio <strong>"{{titulo}}"</strong> vence em <strong style="color:${roxo};">{{dias}} dia(s)</strong>.
      </p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Renove agora para manter seu imóvel visível para inquilinos.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="{{painel_url}}" style="display:inline-block;background:${roxo};color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
          Renovar meu anúncio
        </a>
      </div>
    </div>
    <div style="background:${fundo};padding:16px 24px;text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.5;">
        Este é um e-mail automático — não responda.
      </p>
    </div>
  </div>
</body>
</html>`,
  },

  aviso_aluguel: {
    assunto: 'Lembrete: aluguel vence em {{venc}}',
    corpo: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:24px;background:${fundo};font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:${roxo};padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:18px;font-weight:bold;">Lembrete de aluguel</h1>
      <p style="color:#e9d5ff;margin:6px 0 0;font-size:13px;">{{anunciante}}</p>
    </div>
    <div style="padding:32px 24px;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin-top:0;">
        Olá <strong>{{nome}}</strong>,
      </p>
      <p style="color:#374151;font-size:14px;line-height:1.6;">
        Passando pra lembrar do aluguel do imóvel <strong>{{imovel_titulo}}</strong> ({{imovel_bairro}})
        com vencimento em <strong>{{dias}} dia(s)</strong>.
      </p>
      <div style="background:#f3e8ff;border-radius:8px;padding:14px 18px;margin:18px 0;text-align:center;">
        <p style="margin:0;font-size:11px;color:${roxo};font-weight:bold;letter-spacing:1px;">VENCE EM</p>
        <p style="margin:6px 0;font-size:22px;font-weight:bold;color:#111827;">{{venc}}</p>
        <p style="margin:0;font-size:18px;font-weight:bold;color:${roxo};">{{valor}}</p>
      </div>
      <p style="color:#6b7280;font-size:13px;line-height:1.6;">
        Qualquer dúvida, fale comigo respondendo este email ou pelo WhatsApp.
      </p>
      <p style="color:#6b7280;font-size:13px;line-height:1.6;">— {{anunciante}}</p>
    </div>
    <div style="background:${fundo};padding:16px 24px;text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.5;">
        Lembrete automático. Se você já pagou, desconsidere.
      </p>
    </div>
  </div>
</body>
</html>`,
  },
}
