'use client'

import { useState, FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha` }
    )

    setCarregando(false)
    if (error) { setErro(`Erro: ${error.message}`); return }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link enviado!</h1>
          <p className="text-gray-500 mb-1">Verifique sua caixa de entrada em</p>
          <p className="font-semibold text-gray-800 mb-6 break-all">{email}</p>
          <p className="text-sm text-gray-400 mb-8">Clique no link para criar uma nova senha.<br />Não encontrou? Verifique o spam.</p>
          <Link href="/entrar" className="text-sm text-violet-600 hover:text-violet-700 font-medium">
            Voltar para o login
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Link href="/"><Image src="/logo.png" alt="AluguelCuiabá" width={180} height={48} className="h-10 w-auto object-contain" priority /></Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Esqueci minha senha</h1>
          <p className="text-sm text-gray-500 mb-6">Informe seu e-mail e enviaremos um link para redefinir sua senha.</p>

          {erro && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" required autoFocus
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm transition"
              />
            </div>
            <button
              type="submit" disabled={carregando}
              className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
            >
              {carregando ? <><Loader2 size={16} className="animate-spin" />Enviando...</> : 'Enviar link de redefinição'}
            </button>
          </form>
        </div>

        <div className="mt-6 flex justify-center">
          <Link href="/entrar" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft size={14} />Voltar para o login
          </Link>
        </div>
      </div>
    </main>
  )
}
