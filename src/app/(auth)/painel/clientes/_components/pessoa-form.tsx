'use client'

import { useState, useTransition, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, AlertCircle, Trash2 } from 'lucide-react'
import { criarPessoa, atualizarPessoa, excluirPessoa, type PessoaInput, type TipoPessoa } from '../actions'

interface Props {
  modo: 'novo' | 'editar'
  id?: string
  inicial?: Partial<PessoaInput>
  redirectApos?: string
}

const TIPOS: { value: TipoPessoa; label: string }[] = [
  { value: 'inquilino',    label: 'Inquilino'    },
  { value: 'proprietario', label: 'Proprietário' },
  { value: 'fiador',       label: 'Fiador'       },
  { value: 'testemunha',   label: 'Testemunha'   },
  { value: 'outro',        label: 'Outro'        },
]

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900 placeholder:text-gray-400"

export function PessoaForm({ modo, id, inicial = {}, redirectApos = '/painel/clientes' }: Props) {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoPessoa>((inicial.tipo as TipoPessoa) ?? 'inquilino')
  const [nome, setNome] = useState(inicial.nome ?? '')
  const [cpfCnpj, setCpfCnpj] = useState(inicial.cpf_cnpj ?? '')
  const [rg, setRg] = useState(inicial.rg ?? '')
  const [dataNasc, setDataNasc] = useState(inicial.data_nascimento ?? '')
  const [estadoCivil, setEstadoCivil] = useState(inicial.estado_civil ?? '')
  const [profissao, setProfissao] = useState(inicial.profissao ?? '')
  const [nacionalidade, setNacionalidade] = useState(inicial.nacionalidade ?? 'Brasileira')
  const [email, setEmail] = useState(inicial.email ?? '')
  const [telefone, setTelefone] = useState(inicial.telefone ?? '')
  const [whatsapp, setWhatsapp] = useState(inicial.whatsapp ?? '')
  const [cep, setCep] = useState(inicial.endereco_cep ?? '')
  const [logradouro, setLogradouro] = useState(inicial.endereco_logradouro ?? '')
  const [numero, setNumero] = useState(inicial.endereco_numero ?? '')
  const [complemento, setComplemento] = useState(inicial.endereco_complemento ?? '')
  const [bairroEnd, setBairroEnd] = useState(inicial.endereco_bairro ?? '')
  const [cidade, setCidade] = useState(inicial.endereco_cidade ?? 'Cuiabá')
  const [estado, setEstado] = useState(inicial.endereco_estado ?? 'MT')
  const [observacoes, setObservacoes] = useState(inicial.observacoes ?? '')

  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const buscaCep = async () => {
    const cepLimpo = cep.replace(/\D/g, '')
    if (cepLimpo.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const data = await res.json()
      if (data.erro) return
      setLogradouro(data.logradouro ?? '')
      setBairroEnd(data.bairro ?? '')
      setCidade(data.localidade ?? '')
      setEstado(data.uf ?? '')
    } catch {}
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    const payload: PessoaInput = {
      tipo, nome, cpf_cnpj: cpfCnpj, rg,
      data_nascimento: dataNasc || null,
      estado_civil: estadoCivil, profissao, nacionalidade,
      email, telefone, whatsapp,
      endereco_cep: cep, endereco_logradouro: logradouro,
      endereco_numero: numero, endereco_complemento: complemento,
      endereco_bairro: bairroEnd, endereco_cidade: cidade, endereco_estado: estado,
      observacoes,
    }

    startTransition(async () => {
      const r = modo === 'novo'
        ? await criarPessoa(payload)
        : await atualizarPessoa(id!, payload)

      if (r.error) { setErro(r.error); return }
      router.push(redirectApos)
      router.refresh()
    })
  }

  const handleExcluir = () => {
    if (!id || !confirm('Excluir esta pessoa? Não pode ser desfeito.')) return
    startTransition(async () => {
      const r = await excluirPessoa(id)
      if (r?.error) setErro(r.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6 p-6">
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Dados básicos</h2>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Tipo *</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoPessoa)} className={inputCls}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Nome *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required placeholder="Nome completo" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">CPF/CNPJ</label>
            <input value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)} placeholder="000.000.000-00" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">RG</label>
            <input value={rg} onChange={e => setRg(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Nascimento</label>
            <input type="date" value={dataNasc ?? ''} onChange={e => setDataNasc(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Estado civil</label>
            <select value={estadoCivil ?? ''} onChange={e => setEstadoCivil(e.target.value)} className={inputCls}>
              <option value="">—</option>
              <option value="solteiro">Solteiro(a)</option>
              <option value="casado">Casado(a)</option>
              <option value="uniao_estavel">União estável</option>
              <option value="divorciado">Divorciado(a)</option>
              <option value="viuvo">Viúvo(a)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Profissão</label>
            <input value={profissao ?? ''} onChange={e => setProfissao(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Nacionalidade</label>
            <input value={nacionalidade ?? ''} onChange={e => setNacionalidade(e.target.value)} className={inputCls} />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Contato</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">E-mail</label>
            <input type="email" value={email ?? ''} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Telefone</label>
            <input value={telefone ?? ''} onChange={e => setTelefone(e.target.value)} placeholder="(65) 99999-9999" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">WhatsApp</label>
            <input value={whatsapp ?? ''} onChange={e => setWhatsapp(e.target.value)} placeholder="65999999999" className={inputCls} />
            <p className="text-[10px] text-gray-400 mt-0.5">Só números, com DDD (para links wa.me)</p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Endereço</h2>
        <div className="grid sm:grid-cols-6 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">CEP</label>
            <input value={cep ?? ''} onChange={e => setCep(e.target.value)} onBlur={buscaCep} placeholder="00000-000" className={inputCls} />
            <p className="text-[10px] text-gray-400 mt-0.5">Preenche endereço automaticamente</p>
          </div>
          <div className="sm:col-span-4">
            <label className="text-xs font-medium text-gray-600 block mb-1">Logradouro</label>
            <input value={logradouro ?? ''} onChange={e => setLogradouro(e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-1">
            <label className="text-xs font-medium text-gray-600 block mb-1">Número</label>
            <input value={numero ?? ''} onChange={e => setNumero(e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">Complemento</label>
            <input value={complemento ?? ''} onChange={e => setComplemento(e.target.value)} placeholder="Apto, bloco..." className={inputCls} />
          </div>
          <div className="sm:col-span-3">
            <label className="text-xs font-medium text-gray-600 block mb-1">Bairro</label>
            <input value={bairroEnd ?? ''} onChange={e => setBairroEnd(e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-4">
            <label className="text-xs font-medium text-gray-600 block mb-1">Cidade</label>
            <input value={cidade ?? ''} onChange={e => setCidade(e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">UF</label>
            <input value={estado ?? ''} onChange={e => setEstado(e.target.value.toUpperCase())} maxLength={2} className={inputCls} />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Observações</h2>
        <textarea value={observacoes ?? ''} onChange={e => setObservacoes(e.target.value)} rows={3} className={`${inputCls} resize-y`} placeholder="Notas internas..." />
      </section>

      {erro && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">
          <AlertCircle size={16} />
          {erro}
        </div>
      )}

      <div className="flex items-center justify-between">
        {modo === 'editar' ? (
          <button type="button" onClick={handleExcluir} disabled={isPending}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
            <Trash2 size={14} /> Excluir
          </button>
        ) : <span />}
        <button type="submit" disabled={isPending}
          className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {modo === 'novo' ? 'Cadastrar' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}
