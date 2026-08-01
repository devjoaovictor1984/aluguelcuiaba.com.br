'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send, AlertCircle, ShieldCheck, ChevronDown } from 'lucide-react'
import { maskCpfCnpj, maskTelefone, maskCep, maskMoney, parseMoney } from '@/lib/formatters'
import { TIPOS_IMOVEL_RESIDENCIAL, TIPOS_IMOVEL_COMERCIAL } from '@/lib/seguros/tabelas'
import { criarAnalise } from '../../../actions'
import {
  CamposSolidarios, validarSolidarios, type SolidarioCampo,
} from '../../../_components/campos-solidarios'

interface InquilinoOpcao {
  id: string
  nome: string
  cpfCnpj: string | null
  email: string | null
  telefone: string | null
  dataNascimento: string | null
}

interface ContratoBase {
  id: string
  codigo: string
  valor_aluguel: number
  condominio_mensal: number | null
  iptu_mensal: number | null
  duracao_meses: number | null
  inquilino_id: string | null
  imovel_id: string | null
}

interface Props {
  inquilinos: InquilinoOpcao[]
  contratoBase: ContratoBase | null
}

const input = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900'
const label = 'text-xs font-medium text-gray-600 block mb-1'

export function FormNovaAnalise({ inquilinos, contratoBase }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState('')

  const inicial = contratoBase?.inquilino_id
    ? inquilinos.find(i => i.id === contratoBase.inquilino_id)
    : undefined

  const [inquilinoId, setInquilinoId] = useState(inicial?.id ?? '')
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [cpf, setCpf] = useState(inicial?.cpfCnpj ? maskCpfCnpj(inicial.cpfCnpj) : '')
  const [email, setEmail] = useState(inicial?.email ?? '')
  const [celular, setCelular] = useState(inicial?.telefone ? maskTelefone(inicial.telefone) : '')

  const [cep, setCep] = useState('')
  const [aluguel, setAluguel] = useState(
    contratoBase ? maskMoney(String(Math.round(contratoBase.valor_aluguel * 100))) : '',
  )
  const [condominio, setCondominio] = useState(
    contratoBase?.condominio_mensal ? maskMoney(String(Math.round(contratoBase.condominio_mensal * 100))) : '',
  )
  const [iptu, setIptu] = useState(
    contratoBase?.iptu_mensal ? maskMoney(String(Math.round(contratoBase.iptu_mensal * 100))) : '',
  )
  const [meses, setMeses] = useState(String(contratoBase?.duracao_meses ?? 30))
  const [pinturaNova, setPinturaNova] = useState(true)
  const [finalidade, setFinalidade] = useState<'R' | 'C'>('R')
  const [tipoImovel, setTipoImovel] = useState('')

  const [completa, setCompleta] = useState(false)
  const [dataNasc, setDataNasc] = useState(inicial?.dataNascimento ?? '')
  const [sexo, setSexo] = useState<'M' | 'F' | ''>('')

  const [solidarios, setSolidarios] = useState<SolidarioCampo[]>([])
  const [consentimento, setConsentimento] = useState(false)

  // Comercial exige análise completa — a reduzida só existe pra residencial.
  const exigeCompleta = finalidade === 'C'
  const usarCompleta = completa || exigeCompleta

  const escolherInquilino = (id: string) => {
    setInquilinoId(id)
    const p = inquilinos.find(i => i.id === id)
    if (!p) return
    setNome(p.nome)
    if (p.cpfCnpj) setCpf(maskCpfCnpj(p.cpfCnpj))
    if (p.email) setEmail(p.email)
    if (p.telefone) setCelular(maskTelefone(p.telefone))
    if (p.dataNascimento) setDataNasc(p.dataNascimento)
  }

  const enviar = () => {
    setErro('')

    if (!nome.trim()) return setErro('Informe o nome do pretendente.')
    if (cpf.replace(/\D/g, '').length < 11) return setErro('CPF/CNPJ incompleto.')
    if (!email.includes('@')) return setErro('E-mail inválido.')
    if (celular.replace(/\D/g, '').length < 10) return setErro('Celular incompleto (com DDD).')
    if (cep.replace(/\D/g, '').length !== 8) return setErro('CEP inválido.')
    if (parseMoney(aluguel) <= 0) return setErro('Informe o valor do aluguel.')
    if (usarCompleta && !dataNasc) return setErro('Data de nascimento é obrigatória na análise completa.')
    if (usarCompleta && !sexo) return setErro('Informe o sexo na análise completa.')
    if (!consentimento) return setErro('É preciso confirmar o aceite do inquilino.')

    const sol = validarSolidarios(solidarios)
    if ('erro' in sol) return setErro(sol.erro)

    startTransition(async () => {
      const r = await criarAnalise({
        contratoId: contratoBase?.id ?? null,
        imovelId: contratoBase?.imovel_id ?? null,
        inquilinoId: inquilinoId || null,
        consentimento,
        dados: {
          produto: 'fianca',
          tipoAnalise: usarCompleta ? 'completa' : 'reduzida',
          pretendente: {
            tipo: cpf.replace(/\D/g, '').length > 11 ? 'J' : 'F',
            nome: nome.trim(),
            cpfCnpj: cpf,
            email: email.trim(),
            celular,
            dataNascimento: dataNasc || null,
            sexo: sexo || null,
          },
          solidarios: sol.solidarios,
          imovel: {
            cep,
            aluguel: parseMoney(aluguel),
            condominio: parseMoney(condominio) || null,
            iptu: parseMoney(iptu) || null,
            pinturaNova,
            finalidade,
            tipo: tipoImovel || null,
            periodoContratoMeses: parseInt(meses, 10) || 30,
          },
        },
      })

      if (r.error) {
        setErro(r.error)
        // Mesmo com erro a análise fica gravada — leva pro detalhe pra
        // não parecer que a solicitação sumiu.
        if (r.id) router.push(`/painel/seguros/fianca/${r.id}`)
        return
      }
      router.push(`/painel/seguros/fianca/${r.id}`)
    })
  }

  const tipos = finalidade === 'R' ? TIPOS_IMOVEL_RESIDENCIAL : TIPOS_IMOVEL_COMERCIAL

  return (
    <div className="space-y-4">
      {contratoBase && (
        <p className="text-xs text-violet-800 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
          Dados puxados do contrato <strong>{contratoBase.codigo}</strong>.
        </p>
      )}

      {/* Pretendente */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-900">Pretendente (inquilino)</h2>

        {inquilinos.length > 0 && (
          <div>
            <label className={label}>Puxar de um cliente cadastrado</label>
            <div className="relative">
              <select
                value={inquilinoId}
                onChange={e => escolherInquilino(e.target.value)}
                className={`${input} appearance-none pr-8`}
              >
                <option value="">— digitar manualmente —</option>
                {inquilinos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}

        <div>
          <label className={label}>Nome completo <span className="text-red-500">*</span></label>
          <input value={nome} onChange={e => setNome(e.target.value)} className={input} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>CPF / CNPJ <span className="text-red-500">*</span></label>
            <input value={cpf} onChange={e => setCpf(maskCpfCnpj(e.target.value))} className={input} inputMode="numeric" />
          </div>
          <div>
            <label className={label}>Celular com DDD <span className="text-red-500">*</span></label>
            <input value={celular} onChange={e => setCelular(maskTelefone(e.target.value))} className={input} inputMode="tel" />
          </div>
        </div>

        <div>
          <label className={label}>E-mail <span className="text-red-500">*</span></label>
          <input value={email} onChange={e => setEmail(e.target.value)} className={input} type="email" />
        </div>

        {usarCompleta && (
          <div className="grid sm:grid-cols-2 gap-3 pt-1 border-t border-gray-50">
            <div>
              <label className={label}>Data de nascimento <span className="text-red-500">*</span></label>
              <input value={dataNasc} onChange={e => setDataNasc(e.target.value)} className={input} type="date" />
            </div>
            <div>
              <label className={label}>Sexo <span className="text-red-500">*</span></label>
              <div className="relative">
                <select value={sexo} onChange={e => setSexo(e.target.value as 'M' | 'F' | '')} className={`${input} appearance-none pr-8`}>
                  <option value="">—</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Imóvel */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-900">Imóvel pretendido</h2>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>CEP <span className="text-red-500">*</span></label>
            <input value={cep} onChange={e => setCep(maskCep(e.target.value))} className={input} inputMode="numeric" />
          </div>
          <div>
            <label className={label}>Finalidade</label>
            <div className="relative">
              <select
                value={finalidade}
                onChange={e => { setFinalidade(e.target.value as 'R' | 'C'); setTipoImovel('') }}
                className={`${input} appearance-none pr-8`}
              >
                <option value="R">Residencial</option>
                <option value="C">Comercial</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className={label}>Aluguel <span className="text-red-500">*</span></label>
            <input value={aluguel} onChange={e => setAluguel(maskMoney(e.target.value))} className={input} inputMode="numeric" />
          </div>
          <div>
            <label className={label}>Condomínio</label>
            <input value={condominio} onChange={e => setCondominio(maskMoney(e.target.value))} className={input} inputMode="numeric" />
          </div>
          <div>
            <label className={label}>IPTU</label>
            <input value={iptu} onChange={e => setIptu(maskMoney(e.target.value))} className={input} inputMode="numeric" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Duração do contrato (meses)</label>
            <input value={meses} onChange={e => setMeses(e.target.value.replace(/\D/g, ''))} className={input} inputMode="numeric" />
          </div>
          {usarCompleta && (
            <div>
              <label className={label}>Tipo do imóvel</label>
              <div className="relative">
                <select value={tipoImovel} onChange={e => setTipoImovel(e.target.value)} className={`${input} appearance-none pr-8`}>
                  <option value="">—</option>
                  {tipos.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={pinturaNova} onChange={e => setPinturaNova(e.target.checked)} className="accent-violet-600" />
          <span className="text-sm text-gray-700">Imóvel entregue com pintura nova</span>
        </label>
      </section>

      {/* Solidários */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
        <CamposSolidarios
          valores={solidarios}
          onChange={setSolidarios}
          inputCls={input}
          disabled={isPending}
        />
      </section>

      {/* Tipo de análise */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
        <label className={`flex items-start gap-2 ${exigeCompleta ? 'opacity-60' : 'cursor-pointer'}`}>
          <input
            type="checkbox"
            checked={usarCompleta}
            disabled={exigeCompleta}
            onChange={e => setCompleta(e.target.checked)}
            className="accent-violet-600 mt-0.5"
          />
          <span>
            <p className="text-sm font-semibold text-gray-900">Análise completa</p>
            <p className="text-[11px] text-gray-500 leading-tight">
              {exigeCompleta
                ? 'Obrigatória para imóvel comercial.'
                : 'Pede mais dados, mas inclui as seguradoras que não aceitam análise rápida.'}
            </p>
          </span>
        </label>
      </section>

      {/* Consentimento — LGPD */}
      <section className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={consentimento}
            onChange={e => setConsentimento(e.target.checked)}
            className="accent-violet-600 mt-0.5"
          />
          <span className="text-xs text-violet-900 leading-snug">
            Confirmo que o inquilino autorizou o envio dos dados dele (nome, CPF, contato)
            à corretora e às seguradoras parceiras para análise de crédito e emissão do
            seguro fiança.
          </span>
        </label>
      </section>

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
        className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {isPending ? 'Enviando pras seguradoras…' : 'Enviar para análise'}
      </button>

      <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1">
        <ShieldCheck size={11} /> Cotação sem compromisso — a contratação é um passo separado.
      </p>
    </div>
  )
}
