'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Send, AlertCircle, CheckCircle2 } from 'lucide-react'
import { maskCpfCnpj, maskTelefone } from '@/lib/formatters'
import { enviarAnalisePeloLink, registrarAbertura } from '../actions'

interface Props {
  token: string
  completa: boolean
}

const input = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-base text-gray-900'
const label = 'text-xs font-medium text-gray-600 block mb-1'

/**
 * Formulário do pretenso inquilino. Só os dados dele — imóvel e aluguel
 * vieram do corretor no link. Pensado pra celular: input grande, poucos
 * campos, sem login.
 */
export function FormPretendente({ token, completa }: Props) {
  const [isPending, startTransition] = useTransition()
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [celular, setCelular] = useState('')
  const [dataNasc, setDataNasc] = useState('')
  const [sexo, setSexo] = useState<'M' | 'F' | ''>('')
  const [consentimento, setConsentimento] = useState(false)

  // Avisa o corretor que o link foi aberto, mesmo se o envio não vier.
  useEffect(() => { void registrarAbertura(token) }, [token])

  const enviar = () => {
    setErro('')
    if (!nome.trim()) return setErro('Informe seu nome completo.')
    const doc = cpf.replace(/\D/g, '')
    if (doc.length !== 11 && doc.length !== 14) return setErro('CPF ou CNPJ inválido.')
    if (!email.includes('@')) return setErro('E-mail inválido.')
    if (celular.replace(/\D/g, '').length < 10) return setErro('Celular incompleto (com DDD).')
    if (completa && !dataNasc) return setErro('Informe a data de nascimento.')
    if (completa && !sexo) return setErro('Informe o sexo.')
    if (!consentimento) return setErro('É preciso autorizar o envio dos dados.')

    startTransition(async () => {
      const r = await enviarAnalisePeloLink(token, {
        nome, cpfCnpj: cpf, email, celular,
        dataNascimento: dataNasc || null,
        sexo: sexo || null,
        consentimento,
      })
      if (r.error) { setErro(r.error); return }
      setEnviado(true)
    })
  }

  if (enviado) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <CheckCircle2 size={28} className="text-green-600 mx-auto mb-2" />
        <h2 className="font-bold text-green-900 mb-1">Dados enviados</h2>
        <p className="text-sm text-green-800">
          O corretor recebeu sua solicitação e entra em contato assim que a
          seguradora responder. Pode fechar esta página.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
      <h2 className="text-sm font-bold text-gray-900">Seus dados</h2>

      <div>
        <label className={label}>Nome completo <span className="text-red-500">*</span></label>
        <input
          value={nome}
          onChange={e => setNome(e.target.value)}
          className={input}
          autoComplete="name"
          placeholder="Como está no documento"
        />
      </div>

      <div>
        <label className={label}>CPF <span className="text-red-500">*</span></label>
        <input
          value={cpf}
          onChange={e => setCpf(maskCpfCnpj(e.target.value))}
          className={input}
          inputMode="numeric"
          placeholder="000.000.000-00"
        />
      </div>

      <div>
        <label className={label}>Celular com DDD <span className="text-red-500">*</span></label>
        <input
          value={celular}
          onChange={e => setCelular(maskTelefone(e.target.value))}
          className={input}
          inputMode="tel"
          autoComplete="tel"
          placeholder="(65) 99999-8888"
        />
      </div>

      <div>
        <label className={label}>E-mail <span className="text-red-500">*</span></label>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={input}
          type="email"
          inputMode="email"
          autoComplete="email"
        />
      </div>

      {completa && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Nascimento <span className="text-red-500">*</span></label>
            <input value={dataNasc} onChange={e => setDataNasc(e.target.value)} className={input} type="date" />
          </div>
          <div>
            <label className={label}>Sexo <span className="text-red-500">*</span></label>
            <select value={sexo} onChange={e => setSexo(e.target.value as 'M' | 'F' | '')} className={input}>
              <option value="">—</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </div>
        </div>
      )}

      <label className="flex items-start gap-2 cursor-pointer pt-1 border-t border-gray-50">
        <input
          type="checkbox"
          checked={consentimento}
          onChange={e => setConsentimento(e.target.checked)}
          className="accent-violet-600 mt-1 w-4 h-4"
        />
        <span className="text-xs text-gray-600 leading-snug">
          Autorizo o envio dos meus dados à corretora e às seguradoras parceiras
          para análise do seguro fiança, incluindo consulta a órgãos de proteção
          ao crédito.
        </span>
      </label>

      {erro && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <button
        type="button"
        onClick={enviar}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 active:bg-violet-900 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl text-base"
      >
        {isPending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        {isPending ? 'Enviando…' : 'Enviar para análise'}
      </button>
    </div>
  )
}
