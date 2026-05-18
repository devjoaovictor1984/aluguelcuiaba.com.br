'use client'

import { useState, useTransition, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, AlertCircle, Trash2 } from 'lucide-react'
import { criarPessoa, atualizarPessoa, excluirPessoa, type PessoaInput, type TipoPessoa, type TipoPix } from '../actions'
import { InputCpfCnpj, InputTelefone, InputCep } from '@/components/inputs/input-mascarado'
import { maskCep } from '@/lib/formatters'

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
  const [nomeFantasia, setNomeFantasia] = useState(inicial.nome_fantasia ?? '')
  const [inscricaoEstadual, setInscricaoEstadual] = useState(inicial.inscricao_estadual ?? '')
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState(inicial.inscricao_municipal ?? '')
  const ehPJ = (cpfCnpj?.replace(/\D/g, '').length ?? 0) === 14
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

  // Recebimento
  const [pixTipo, setPixTipo] = useState<TipoPix | ''>((inicial.pix_tipo as TipoPix) ?? '')
  const [pixChave, setPixChave] = useState(inicial.pix_chave ?? '')
  const [bancoNome, setBancoNome] = useState(inicial.banco_nome ?? '')
  const [bancoCodigo, setBancoCodigo] = useState(inicial.banco_codigo ?? '')
  const [bancoAgencia, setBancoAgencia] = useState(inicial.banco_agencia ?? '')
  const [bancoConta, setBancoConta] = useState(inicial.banco_conta ?? '')
  const [bancoTipoConta, setBancoTipoConta] = useState<'corrente' | 'poupanca' | ''>(
    (inicial.banco_tipo_conta as 'corrente' | 'poupanca') ?? ''
  )
  const [bancoTitular, setBancoTitular] = useState(inicial.banco_titular ?? '')

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
      tipo, nome, cpf_cnpj: cpfCnpj,
      // Campos PF (ignorados em PJ)
      rg: ehPJ ? null : rg,
      data_nascimento: ehPJ ? null : (dataNasc || null),
      estado_civil: ehPJ ? null : estadoCivil,
      profissao: ehPJ ? null : profissao,
      nacionalidade: ehPJ ? null : nacionalidade,
      // Campos PJ (ignorados em PF)
      nome_fantasia: ehPJ ? nomeFantasia : null,
      inscricao_estadual: ehPJ ? inscricaoEstadual : null,
      inscricao_municipal: ehPJ ? inscricaoMunicipal : null,
      email, telefone, whatsapp,
      endereco_cep: cep, endereco_logradouro: logradouro,
      endereco_numero: numero, endereco_complemento: complemento,
      endereco_bairro: bairroEnd, endereco_cidade: cidade, endereco_estado: estado,
      pix_tipo: pixTipo || null,
      pix_chave: pixChave,
      banco_nome: bancoNome,
      banco_codigo: bancoCodigo,
      banco_agencia: bancoAgencia,
      banco_conta: bancoConta,
      banco_tipo_conta: bancoTipoConta || null,
      banco_titular: bancoTitular,
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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {ehPJ ? 'Dados da empresa (PJ)' : 'Dados básicos'}
          </h2>
          {cpfCnpj && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ehPJ ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              {ehPJ ? 'Pessoa Jurídica' : 'Pessoa Física'}
            </span>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Tipo *</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoPessoa)} className={inputCls}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">CPF/CNPJ</label>
            <InputCpfCnpj value={cpfCnpj ?? ''} onChange={setCpfCnpj} className={inputCls} />
            <p className="text-[10px] text-gray-400 mt-0.5">14 dígitos = empresa (mostra campos de PJ)</p>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              {ehPJ ? 'Razão social *' : 'Nome *'}
            </label>
            <input value={nome} onChange={e => setNome(e.target.value)} required
              placeholder={ehPJ ? 'Razão social completa (ex: Comercial XYZ Ltda)' : 'Nome completo'}
              className={inputCls} />
          </div>

          {ehPJ ? (
            <>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-600 block mb-1">Nome fantasia</label>
                <input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)}
                  placeholder="Nome conhecido publicamente" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Inscrição estadual</label>
                <input value={inscricaoEstadual} onChange={e => setInscricaoEstadual(e.target.value)}
                  placeholder="ou ISENTO" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Inscrição municipal</label>
                <input value={inscricaoMunicipal} onChange={e => setInscricaoMunicipal(e.target.value)} className={inputCls} />
              </div>
              <p className="sm:col-span-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                ℹ️ Cadastre os sócios signatários como pessoas separadas e vincule-os ao contrato pela seção &ldquo;Pessoas vinculadas&rdquo;.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
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
            <InputTelefone value={telefone ?? ''} onChange={setTelefone} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">WhatsApp</label>
            <InputTelefone value={whatsapp ?? ''} onChange={setWhatsapp} className={inputCls} />
            <p className="text-[10px] text-gray-400 mt-0.5">Usado para gerar links wa.me</p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Endereço</h2>
        <div className="grid sm:grid-cols-6 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">CEP</label>
            <InputCep value={cep ?? ''} onChange={v => setCep(maskCep(v))} onBlur={buscaCep} className={inputCls} />
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

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recebimento</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {tipo === 'proprietario'
              ? 'Conta onde o repasse mensal será creditado.'
              : 'Opcional. Caso precise reembolsar ou transferir valores.'}
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Tipo de PIX</label>
            <select value={pixTipo} onChange={e => setPixTipo(e.target.value as TipoPix | '')} className={inputCls}>
              <option value="">—</option>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option>
              <option value="telefone">Telefone</option>
              <option value="aleatoria">Chave aleatória</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">Chave PIX</label>
            <input value={pixChave ?? ''} onChange={e => setPixChave(e.target.value)} className={inputCls} placeholder="Cole a chave do PIX" />
          </div>
        </div>

        <div className="pt-3 border-t border-gray-50">
          <p className="text-xs font-medium text-gray-500 mb-2">Dados bancários (alternativa ao PIX)</p>
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">Banco</label>
              <input value={bancoNome ?? ''} onChange={e => setBancoNome(e.target.value)} className={inputCls} placeholder="Ex: Itaú" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Código</label>
              <input value={bancoCodigo ?? ''} onChange={e => setBancoCodigo(e.target.value)} className={inputCls} placeholder="341" maxLength={4} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Tipo conta</label>
              <select value={bancoTipoConta} onChange={e => setBancoTipoConta(e.target.value as 'corrente' | 'poupanca' | '')} className={inputCls}>
                <option value="">—</option>
                <option value="corrente">Corrente</option>
                <option value="poupanca">Poupança</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Agência</label>
              <input value={bancoAgencia ?? ''} onChange={e => setBancoAgencia(e.target.value)} className={inputCls} placeholder="0001" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Conta</label>
              <input value={bancoConta ?? ''} onChange={e => setBancoConta(e.target.value)} className={inputCls} placeholder="00000-0" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">Titular (se diferente)</label>
              <input value={bancoTitular ?? ''} onChange={e => setBancoTitular(e.target.value)} className={inputCls} placeholder="Em branco se for o próprio cadastro" />
            </div>
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
