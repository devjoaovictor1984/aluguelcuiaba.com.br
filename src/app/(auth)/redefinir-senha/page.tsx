'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [ver, setVer] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [salvo, setSalvo] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    if (senha !== confirma) { setErro('As senhas não coincidem.'); return }

    setCarregando(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: senha })

    if (error) { setCarregando(false); setErro(`Erro: ${error.message}`); return }
    setSalvo(true)
    setTimeout(() => router.push('/painel'), 1500)
  }

  const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-gray-900 text-sm transition"

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {salvo ? (
            <div className="text-center py-4">
              <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
              <p className="font-bold text-gray-900">Senha redefinida!</p>
              <p className="text-sm text-gray-500 mt-1">Redirecionando para o painel...</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Nova senha</h1>
              <p className="text-sm text-gray-500 mb-6">Escolha uma senha segura para sua conta.</p>

              {erro && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{erro}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={ver ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)}
                    placeholder="Nova senha (mín. 6 caracteres)" required autoFocus className={`${inputCls} pl-9 pr-10`} />
                  <button type="button" onClick={() => setVer(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {ver ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={ver ? 'text' : 'password'} value={confirma} onChange={e => setConfirma(e.target.value)}
                    placeholder="Confirmar senha" required className={`${inputCls} pl-9 pr-10`} />
                  {confirma && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {confirma === senha ? <CheckCircle2 size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-400" />}
                    </div>
                  )}
                </div>
                <button type="submit" disabled={carregando}
                  className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm">
                  {carregando ? <><Loader2 size={16} className="animate-spin" />Salvando...</> : 'Definir nova senha'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
