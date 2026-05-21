'use client'

import { useState, useEffect, FormEvent, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'

interface Props { logoUrl: string }

const GOOGLE_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
)

const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 text-sm transition"

function EntrarFormInner({ logoUrl }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/painel'
  const erroParam = searchParams.get('erro')

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [erro, setErro] = useState('')

  // Mostra o form imediatamente. Em paralelo, se já houver sessão, redireciona.
  // Sem skeleton — evita classe inteira de bugs (HMR, Safari ITP, PWA isolado,
  // localStorage bloqueado) onde a tela ficava travada no "verificando".
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(next)
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    })

    if (error) {
      setCarregando(false)
      if (error.message.toLowerCase().includes('invalid login') || error.message.toLowerCase().includes('invalid credentials')) {
        setErro('E-mail ou senha incorretos.')
      } else {
        setErro(`Erro: ${error.message}`)
      }
      return
    }

    router.push(next)
    router.refresh()
  }

  const handleGoogle = async () => {
    setCarregandoGoogle(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
      },
    })
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex justify-center mb-8">
        <Link href="/">
          <Image src={logoUrl} alt="AluguelCuiabá" width={360} height={96} className="h-20 w-auto object-contain" priority unoptimized />
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Entrar na sua conta</h1>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={carregandoGoogle || carregando}
          className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 text-gray-700 font-medium py-3 rounded-xl transition-colors text-sm mb-4"
        >
          {carregandoGoogle ? <Loader2 size={18} className="animate-spin" /> : GOOGLE_ICON}
          Continuar com Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">ou com e-mail</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {(erro || erroParam) && (
          <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{erroParam === 'link-invalido' ? 'Link expirado. Faça login novamente.' : erro}</span>
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-3">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
              className={`${inputCls} pl-9`}
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={verSenha ? 'text' : 'password'}
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="Senha"
              required
              autoComplete="current-password"
              className={`${inputCls} pl-9 pr-10`}
            />
            <button
              type="button"
              onClick={() => setVerSenha(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={carregando || carregandoGoogle}
            className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 active:bg-violet-900 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
          >
            {carregando ? <><Loader2 size={16} className="animate-spin" />Entrando...</> : 'Entrar'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          <Link href="/esqueci-senha" className="text-violet-600 hover:underline">Esqueci minha senha</Link>
        </p>
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">
        Não tem conta?{' '}
        <Link href="/cadastrar" className="text-violet-600 font-semibold hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </div>
  )
}

export function EntrarForm({ logoUrl }: Props) {
  return (
    <Suspense fallback={
      <div className="w-full max-w-sm space-y-4">
        <div className="h-10 bg-gray-200 rounded-lg w-44 mx-auto animate-pulse" />
        <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-3">
          <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-11 bg-violet-100 rounded-xl animate-pulse" />
        </div>
      </div>
    }>
      <EntrarFormInner logoUrl={logoUrl} />
    </Suspense>
  )
}
