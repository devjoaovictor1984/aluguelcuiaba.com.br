'use client'

import { useState, FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User, Mail, Lock, Loader2, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

const GOOGLE_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
)

const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 text-sm transition"

export default function CadastrarPage() {
  const router = useRouter()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [lgpd, setLgpd] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [erro, setErro] = useState('')

  const handleCadastro = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')

    if (nome.trim().length < 3) { setErro('Informe seu nome completo.'); return }
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    if (senha !== confirmaSenha) { setErro('As senhas não coincidem.'); return }
    if (!lgpd) { setErro('Você precisa aceitar os termos para continuar.'); return }

    setCarregando(true)
    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
      options: {
        data: { nome: nome.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setCarregando(false)
      if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
        setErro('Este e-mail já está cadastrado. Faça login.')
      } else {
        setErro(`Erro: ${error.message}`)
      }
      return
    }

    // Salva consentimento LGPD + nome no perfil
    if (data.user) {
      await supabase.from('perfis').upsert({
        id: data.user.id,
        nome: nome.trim(),
        consentimento_lgpd_em: new Date().toISOString(),
      }, { onConflict: 'id' })
    }

    router.push('/painel/perfil?novo=1')
  }

  const handleGoogle = async () => {
    if (!lgpd) { setErro('Você precisa aceitar os termos para continuar.'); return }
    setCarregandoGoogle(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/painel/perfil?novo=1`,
      },
    })
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-gray-50">
      <div className="w-full max-w-sm">

        <div className="flex justify-center mb-8">
          <Link href="/">
            <Image src="/logo.png" alt="AluguelCuiabá" width={180} height={48} className="h-10 w-auto object-contain" priority />
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Criar conta grátis</h1>
          <p className="text-sm text-gray-500 mb-6">Anuncie seu imóvel em minutos.</p>

          {/* Aviso LGPD antes de tudo */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 mb-5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={lgpd}
                onChange={e => setLgpd(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-violet-600 shrink-0"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                Li e concordo com a{' '}
                <Link href="/privacidade" className="text-violet-600 hover:underline font-medium" target="_blank">
                  Política de Privacidade
                </Link>
                {' '}e os{' '}
                <Link href="/termos" className="text-violet-600 hover:underline font-medium" target="_blank">
                  Termos de Uso
                </Link>
                . Autorizo o tratamento dos meus dados conforme a <strong>LGPD (Lei 13.709/2018)</strong>.
              </span>
            </label>
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={carregandoGoogle || carregando}
            className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 text-gray-700 font-medium py-3 rounded-xl transition-colors text-sm mb-4"
          >
            {carregandoGoogle ? <Loader2 size={18} className="animate-spin" /> : GOOGLE_ICON}
            Cadastrar com Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">ou com e-mail</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {erro && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleCadastro} className="space-y-3">
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Nome completo"
                required
                autoComplete="name"
                className={`${inputCls} pl-9`}
              />
            </div>

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
                placeholder="Senha (mín. 6 caracteres)"
                required
                autoComplete="new-password"
                className={`${inputCls} pl-9 pr-10`}
              />
              <button type="button" onClick={() => setVerSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={verSenha ? 'text' : 'password'}
                value={confirmaSenha}
                onChange={e => setConfirmaSenha(e.target.value)}
                placeholder="Confirmar senha"
                required
                autoComplete="new-password"
                className={`${inputCls} pl-9`}
              />
              {confirmaSenha && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {confirmaSenha === senha
                    ? <CheckCircle2 size={16} className="text-green-500" />
                    : <AlertCircle size={16} className="text-red-400" />
                  }
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={carregando || carregandoGoogle}
              className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 active:bg-violet-900 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
            >
              {carregando ? <><Loader2 size={16} className="animate-spin" />Criando conta...</> : 'Criar conta'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Já tem conta?{' '}
          <Link href="/entrar" className="text-violet-600 font-semibold hover:underline">Entrar</Link>
        </p>
      </div>
    </main>
  )
}
