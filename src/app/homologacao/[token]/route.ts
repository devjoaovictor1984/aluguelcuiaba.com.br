import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { abrirSessao, marcarCookieSessao } from '@/lib/homologacao/sessao'

/**
 * Porta de entrada da sessão de homologação.
 *
 * É rota, e não página, porque o trabalho aqui é efeito colateral —
 * validar o token, autenticar como o usuário convidado e redirecionar.
 * Render não é o assunto.
 *
 * A autenticação usa link mágico gerado e consumido no servidor: o
 * convidado nunca vê senha, e a senha do usuário de homologação não
 * precisa existir em lugar nenhum que possa vazar.
 *
 * Quem valida o prazo é o banco, não o cookie — ver `sessaoAtual`.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const base = req.nextUrl.origin

  const { sessao, motivo } = await abrirSessao(token)
  if (!sessao) {
    return NextResponse.redirect(`${base}/homologacao/encerrada?motivo=${motivo ?? 'inexistente'}`)
  }

  const admin = createAdminClient()

  const { data: usuario } = await admin.auth.admin.getUserById(sessao.usuarioId)
  const email = usuario?.user?.email
  if (!email) {
    return NextResponse.redirect(`${base}/homologacao/encerrada?motivo=inexistente`)
  }

  // Link mágico gerado só para ser consumido aqui mesmo: pegamos o
  // token_hash e trocamos por sessão sem nunca enviar e-mail.
  const { data: link, error: eLink } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const hash = link?.properties?.hashed_token
  if (eLink || !hash) {
    return NextResponse.redirect(`${base}/homologacao/encerrada?motivo=falha`)
  }

  const supabase = await createClient()
  const { error: eOtp } = await supabase.auth.verifyOtp({ token_hash: hash, type: 'magiclink' })
  if (eOtp) {
    return NextResponse.redirect(`${base}/homologacao/encerrada?motivo=falha`)
  }

  await marcarCookieSessao(sessao.id, sessao.expiraEm)

  return NextResponse.redirect(`${base}/homologacao`)
}
