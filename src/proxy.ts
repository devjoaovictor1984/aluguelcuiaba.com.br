import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Marca "cadastro completo", pra não perguntar ao banco a cada navegação. */
const COOKIE_PERFIL_OK = 'perfil_ok'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (!user && (pathname.startsWith('/painel') || pathname.startsWith('/admin'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/entrar'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user && (pathname.startsWith('/painel') || pathname.startsWith('/admin'))) {
    /**
     * Atalho do perfil completo.
     *
     * Este bloco roda em TODA navegação do painel — inclusive nos prefetch
     * que o Next dispara ao passar o mouse num link — e ia ao banco toda
     * vez só pra confirmar algo que muda uma vez na vida: se o cadastro
     * está completo. Era 14% de toda a CPU da conta.
     *
     * O cookie guarda só isso, e só o caso POSITIVO. Cadastro incompleto
     * não grava nada, então quem acabou de preencher não fica preso num
     * cookie velho mandando completar de novo. E forjar o cookie à mão só
     * pula o próprio onboarding — não abre porta nenhuma.
     *
     * Área /admin nunca usa o atalho: papel é permissão, e permissão se
     * confere no banco, a cada vez.
     */
    const ehAdmin = pathname.startsWith('/admin')
    const perfilOkNoCookie = request.cookies.get(COOKIE_PERFIL_OK)?.value === '1'
    if (!ehAdmin && perfilOkNoCookie) return supabaseResponse

    const { data: perfil } = await supabase
      .from('perfis')
      .select('nome, cpf, telefone, endereco_logradouro, role')
      .eq('id', user.id)
      .single()

    if (pathname.startsWith('/admin') && perfil?.role !== 'admin') {
      return NextResponse.redirect(new URL('/painel', request.url))
    }

    /**
     * Convidado de homologação não tem perfil pra completar.
     *
     * Sem esta saída, a equipe técnica da corretora abria o link e caía
     * num formulário pedindo CPF, telefone e endereço antes de alcançar
     * qualquer tela — travando o teste e, pior, pedindo dado pessoal de
     * terceiro que não queremos guardar nem precisamos.
     */
    const ehConvidado = perfil?.role === 'homologacao'

    const completo = !!(perfil?.nome && perfil?.cpf && perfil?.telefone && perfil?.endereco_logradouro)

    if (!ehConvidado && pathname.startsWith('/painel') && !pathname.startsWith('/painel/perfil')) {
      if (!completo) return NextResponse.redirect(new URL('/painel/perfil?novo=1', request.url))
    }

    // Grava o atalho só quando há o que atalhar. Uma hora: curto o
    // bastante pra um perfil esvaziado no banco voltar a ser cobrado.
    if (completo && !ehConvidado) {
      supabaseResponse.cookies.set(COOKIE_PERFIL_OK, '1', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3600,
        path: '/',
      })
    }

    // E não tem o que fazer no perfil: manda de volta ao roteiro.
    if (ehConvidado && pathname.startsWith('/painel/perfil')) {
      return NextResponse.redirect(new URL('/homologacao', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/painel/:path*', '/admin/:path*'],
}
