'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, Check, AlertCircle } from 'lucide-react'
import { editarPerfilAdmin } from '../actions'

interface Props {
  userId: string
  nome: string
  tipo: 'proprietario' | 'corretor' | 'imobiliaria'
  cpf: string
  telefone: string
  plano: 'free' | 'basico' | 'profissional'
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900'

export function FormPerfilAdmin(props: Props) {
  const router = useRouter()
  const [nome, setNome] = useState(props.nome)
  const [tipo, setTipo] = useState(props.tipo)
  const [cpf, setCpf] = useState(props.cpf)
  const [telefone, setTelefone] = useState(props.telefone)
  const [plano, setPlano] = useState(props.plano)
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'ok' | 'erro'>('idle')
  const [msg, setMsg] = useState('')

  const salvar = () => {
    setStatus('idle')
    setMsg('')
    startTransition(async () => {
      const r = await editarPerfilAdmin(props.userId, { nome, tipo, cpf, telefone, plano })
      if (r.error) { setStatus('erro'); setMsg(r.error); return }
      setStatus('ok')
      router.refresh()
      setTimeout(() => setStatus('idle'), 2500)
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Campo label="Nome">
          <input value={nome} onChange={e => setNome(e.target.value)} className={inputCls} />
        </Campo>
        <Campo label="Tipo">
          <select value={tipo} onChange={e => setTipo(e.target.value as Props['tipo'])} className={inputCls}>
            <option value="proprietario">Proprietário</option>
            <option value="corretor">Corretor</option>
            <option value="imobiliaria">Imobiliária</option>
          </select>
        </Campo>
        <Campo label="CPF / CNPJ">
          <input value={cpf} onChange={e => setCpf(e.target.value)} className={inputCls} placeholder="000.000.000-00" />
        </Campo>
        <Campo label="Telefone">
          <input value={telefone} onChange={e => setTelefone(e.target.value)} className={inputCls} placeholder="(65) 9 0000-0000" />
        </Campo>
        <Campo label="Plano">
          <select value={plano} onChange={e => setPlano(e.target.value as Props['plano'])} className={inputCls}>
            <option value="free">Gratuito</option>
            <option value="basico">Básico (até 10 imóveis/contratos)</option>
            <option value="profissional">Profissional (ilimitado)</option>
          </select>
        </Campo>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
        <div className="text-xs">
          {status === 'ok' && <span className="text-green-700 flex items-center gap-1"><Check size={12} /> Salvo</span>}
          {status === 'erro' && <span className="text-red-600 flex items-center gap-1"><AlertCircle size={12} /> {msg}</span>}
        </div>
        <button
          type="button"
          onClick={salvar}
          disabled={isPending}
          className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50"
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Salvar dados
        </button>
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{label}</span>
      {children}
    </label>
  )
}
