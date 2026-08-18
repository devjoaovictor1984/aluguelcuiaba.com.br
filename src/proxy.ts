import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

    if (!ehConvidado && pathname.startsWith('/painel') && !pathname.startsWith('/painel/perfil')) {
      const completo = perfil?.nome && perfil?.cpf && perfil?.telefone && perfil?.endereco_logradouro
      if (!completo) return NextResponse.redirect(new URL('/painel/perfil?novo=1', request.url))
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
