'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, AlertCircle, Search, CheckCircle2, CreditCard, Info, ChevronDown,
} from 'lucide-react'
import { maskCep, maskCpfCnpj, maskMoney, parseMoney, formatarBRL } from '@/lib/formatters'
import type { OpcaoPagamento, PlanosPreco } from '@/lib/seguros/tipos'
import { consultarPrecosAnalise, contratarSeguro, type EncargosInput } from '../../../../actions-contratacao'

interface Props {
  analiseId: string
  seguradoras: { sigla: string; nome: string; limiteAprovado: number | null }[]
  seguradoraInicial: string
  valorAluguel: number | null
  encargosIniciais: { condominio: number; iptu: number; gas: number; energia: number; agua: number }
  vigenciaInicial: { inicio: string; fim: string; meses: number; indice: string | null }
  imovelInicial: { cep: string; endereco: string; bairro: string; cidade: string; uf: string }
  proprietarioInicial: {
    nome: string; cpfCnpj: string; rg: string; dataNascimento: string; estadoCivil: string
  } | null
}

const input = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900'
const label = 'text-xs font-medium text-gray-600 block mb-1'

const NOME_PLANO: Record<keyof PlanosPreco, string> = {
  basico: 'Básico',
  completo: 'Completo',
  tradicional: 'Tradicional',
}

/** Soma um período em meses a uma data ISO — usado pra sugerir a vigência. */
function somarMeses(iso: string, meses: number): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + meses)
  return d.toISOString().slice(0, 10)
}

export function FormContratacao(p: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState('')

  const [sigla, setSigla] = useState(p.seguradoraInicial)

  const cent = (n: number) => (n > 0 ? maskMoney(String(Math.round(n * 100))) : '')
  const [condominio, setCondominio] = useState(cent(p.encargosIniciais.condominio))
  const [iptu, setIptu] = useState(cent(p.encargosIniciais.iptu))
  const [gas, setGas] = useState(cent(p.encargosIniciais.gas))
  const [energia, setEnergia] = useState(cent(p.encargosIniciais.energia))
  const [agua, setAgua] = useState(cent(p.encargosIniciais.agua))
  const [danos, setDanos] = useState(false)
  const [multa, setMulta] = useState(false)
  const [pinturaInt, setPinturaInt] = useState(false)
  const [pinturaExt, setPinturaExt] = useState(false)

  const [planos, setPlanos] = useState<PlanosPreco | null>(null)
  const [escolha, setEscolha] = useState<OpcaoPagamento | null>(null)

  const [inicio, setInicio] = useState(p.vigenciaInicial.inicio)
  const [fim, setFim] = useState(
    p.vigenciaInicial.fim || somarMeses(p.vigenciaInicial.inicio, p.vigenciaInicial.meses || 30),
  )

  const [cep, setCep] = useState(p.imovelInicial.cep ? maskCep(p.imovelInicial.cep) : '')
  const [endereco, setEndereco] = useState(p.imovelInicial.endereco)
  const [bairro, setBairro] = useState(p.imovelInicial.bairro)
  const [cidade, setCidade] = useState(p.imovelInicial.cidade)
  const [uf, setUf] = useState(p.imovelInicial.uf)

  const [propTipo, setPropTipo] = useState<'F' | 'J'>(
    (p.proprietarioInicial?.cpfCnpj?.replace(/\D/g, '').length ?? 0) > 11 ? 'J' : 'F',
  )
  const [propNome, setPropNome] = useState(p.proprietarioInicial?.nome ?? '')
  const [propDoc, setPropDoc] = useState(
    p.proprietarioInicial?.cpfCnpj ? maskCpfCnpj(p.proprietarioInicial.cpfCnpj) : '',
  )
  const [propRg, setPropRg] = useState(p.proprietarioInicial?.rg ?? '')
  const [propNasc, setPropNasc] = useState(p.proprietarioInicial?.dataNascimento ?? '')
  const [propEstCivil, setPropEstCivil] = useState(p.proprietarioInicial?.estadoCivil ?? '')
  const [observacoes, setObservacoes] = useState('')

  const encargos = (): EncargosInput => ({
    condominio: parseMoney(condominio) || 0,
    iptu: parseMoney(iptu) || 0,
    gas: parseMoney(gas) || 0,
    energia: parseMoney(energia) || 0,
    agua: parseMoney(agua) || 0,
    danos, multa, pinturaInterna: pinturaInt, pinturaExterna: pinturaExt,
  })

  const buscarPrecos = () => {
    setErro('')
    setEscolha(null)
    startTransition(async () => {
      const r = await consultarPrecosAnalise(p.analiseId, sigla, encargos())
      if (r.error) { setErro(r.error); setPlanos(null); return }
      setPlanos(r.planos ?? null)
    })
  }

  // Qualquer mudança de cobertura invalida o preço já consultado — o
  // prêmio depende exatamente desse conjunto.
  const invalidarPrecos = () => {
    if (planos) { setPlanos(null); setEscolha(null) }
  }

  const efetivar = () => {
    setErro('')
    if (!escolha) return setErro('Escolha um plano e uma forma de pagamento.')
    if (!inicio || !fim) return setErro('Informe a vigência da apólice.')
    if (!propNome.trim()) return setErro('Informe o nome do proprietário.')
    if (propDoc.replace(/\D/g, '').length < 11) return setErro('CPF/CNPJ do proprietário incompleto.')
    if (cep.replace(/\D/g, '').length !== 8) return setErro('CEP do imóvel inválido.')
    if (!endereco.trim()) return setErro('Informe o endereço do imóvel.')

    startTransition(async () => {
      const r = await contratarSeguro({
        analiseId: p.analiseId,
        seguradoraSigla: sigla,
        opcao: escolha,
        encargos: encargos(),
        inicioVigencia: inicio,
        fimVigencia: fim,
        indiceReajuste: p.vigenciaInicial.indice,
        imovel: { cep, endereco, bairro, cidade, uf },
        proprietario: {
          tipo: propTipo,
          nome: propNome.trim(),
          cpfCnpj: propDoc,
          rg: propRg || null,
          dataNascimento: propNasc || null,
          estadoCivil: propEstCivil || null,
        },
        observacoes: observacoes || null,
      })
      if (r.error) { setErro(r.error); return }
      router.push(`/painel/seguros/fianca/${p.analiseId}`)
    })
  }

  const limite = p.seguradoras.find(s => s.sigla === sigla)?.limiteAprovado
  const acimaDoLimite = limite != null && p.valorAluguel != null && p.valorAluguel > limite

  return (
    <div className="space-y-4">
      {/* 1. Seguradora */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-900">1. Seguradora</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {p.seguradoras.map(s => (
            <button
              key={s.sigla}
              type="button"
              onClick={() => { setSigla(s.sigla); setPlanos(null); setEscolha(null) }}
              className={`px-3 py-3 rounded-xl border-2 text-left transition-colors ${
                sigla === s.sigla
                  ? 'border-violet-700 bg-violet-50'
                  : 'border-gray-100 hover:border-violet-300'
              }`}
            >
              <p className="text-sm font-semibold text-gray-900">{s.nome}</p>
              {s.limiteAprovado != null && (
                <p className="text-[11px] text-gray-500">
                  limite {formatarBRL(s.limiteAprovado)}
                </p>
              )}
            </button>
          ))}
        </div>

        {acimaDoLimite && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            O aluguel ({formatarBRL(p.valorAluguel!)}) está acima do limite aprovado
            ({formatarBRL(limite!)}). Confirme com a corretora antes de emitir.
          </p>
        )}
      </section>

      {/* 2. Coberturas */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900">2. O que o seguro cobre</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Quanto mais encargos entram, maior o prêmio. Mudar aqui refaz a consulta.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {([
            ['Condomínio', condominio, setCondominio],
            ['IPTU', iptu, setIptu],
            ['Gás', gas, setGas],
            ['Energia', energia, setEnergia],
            ['Água', agua, setAgua],
          ] as const).map(([rotulo, valor, setter]) => (
            <div key={rotulo}>
              <label className={label}>{rotulo}</label>
              <input
                value={valor}
                onChange={e => { setter(maskMoney(e.target.value)); invalidarPrecos() }}
                className={input}
                inputMode="numeric"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 pt-1 border-t border-gray-50">
          {([
            ['Danos ao imóvel', danos, setDanos],
            ['Multa rescisória', multa, setMulta],
            ['Pintura interna', pinturaInt, setPinturaInt],
            ['Pintura externa', pinturaExt, setPinturaExt],
          ] as const).map(([rotulo, valor, setter]) => (
            <label key={rotulo} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={valor}
                onChange={e => { setter(e.target.checked); invalidarPrecos() }}
                className="accent-violet-600"
              />
              <span className="text-sm text-gray-700">{rotulo}</span>
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={buscarPrecos}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Consultar preços
        </button>
      </section>

      {/* 3. Planos */}
      {planos && (
        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-900">3. Plano e pagamento</h2>

          {(Object.keys(NOME_PLANO) as (keyof PlanosPreco)[]).map(chave => {
            const opcoes = planos[chave]
            if (!opcoes?.length) return null
            return (
              <div key={chave} className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {NOME_PLANO[chave]}
                </p>
                <div className="space-y-1.5">
                  {opcoes.map((o, i) => {
                    const selecionado = escolha === o
                    const total = o.qtdParcelas * o.valorParcela
                    // Cartão fica de fora: trafegar PAN nos põe no escopo PCI-DSS.
                    const cartao = /cart[aã]o/i.test(o.formaPagamento)
                    return (
                      <button
                        key={`${chave}-${i}`}
                        type="button"
                        disabled={cartao}
                        onClick={() => setEscolha(o)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-colors ${
                          cartao
                            ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                            : selecionado
                              ? 'border-violet-700 bg-violet-50'
                              : 'border-gray-100 hover:border-violet-300'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                            {cartao && <CreditCard size={12} className="text-gray-400" />}
                            {o.formaPagamento}
                          </span>
                          <span className="text-sm font-bold text-violet-700">
                            {o.qtdParcelas}× {formatarBRL(o.valorParcela)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          total {formatarBRL(total)}
                          {o.comEntrada && <> · com entrada</>}
                          {cartao && <> · indisponível por aqui</>}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <p className="text-[11px] text-gray-500 flex items-start gap-1.5 pt-1 border-t border-gray-50">
            <Info size={11} className="mt-0.5 shrink-0 text-gray-400" />
            Pagamento por cartão não é feito pela plataforma — o inquilino conclui
            direto com a corretora. Fatura, boleto e ficha seguem por aqui.
          </p>
        </section>
      )}

      {/* 4. Vigência, imóvel, proprietário */}
      {escolha && (
        <>
          <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-900">4. Vigência da apólice</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={label}>Início <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={inicio}
                  onChange={e => {
                    setInicio(e.target.value)
                    if (!p.vigenciaInicial.fim) {
                      setFim(somarMeses(e.target.value, p.vigenciaInicial.meses || 30))
                    }
                  }}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Fim <span className="text-red-500">*</span></label>
                <input type="date" value={fim} onChange={e => setFim(e.target.value)} className={input} />
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-900">5. Endereço do imóvel</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className={label}>CEP <span className="text-red-500">*</span></label>
                <input value={cep} onChange={e => setCep(maskCep(e.target.value))} className={input} inputMode="numeric" />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Endereço <span className="text-red-500">*</span></label>
                <input value={endereco} onChange={e => setEndereco(e.target.value)} className={input} />
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className={label}>Bairro</label>
                <input value={bairro} onChange={e => setBairro(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label}>Cidade</label>
                <input value={cidade} onChange={e => setCidade(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label}>UF</label>
                <input value={uf} onChange={e => setUf(e.target.value.toUpperCase().slice(0, 2))} className={input} maxLength={2} />
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">6. Proprietário (segurado)</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Quem recebe a indenização em caso de inadimplência.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className={label}>Tipo</label>
                <div className="relative">
                  <select value={propTipo} onChange={e => setPropTipo(e.target.value as 'F' | 'J')} className={`${input} appearance-none pr-8`}>
                    <option value="F">Pessoa física</option>
                    <option value="J">Pessoa jurídica</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Nome / Razão social <span className="text-red-500">*</span></label>
                <input value={propNome} onChange={e => setPropNome(e.target.value)} className={input} />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className={label}>CPF / CNPJ <span className="text-red-500">*</span></label>
                <input value={propDoc} onChange={e => setPropDoc(maskCpfCnpj(e.target.value))} className={input} inputMode="numeric" />
              </div>
              {propTipo === 'F' && (
                <>
                  <div>
                    <label className={label}>RG</label>
                    <input value={propRg} onChange={e => setPropRg(e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={label}>Nascimento</label>
                    <input type="date" value={propNasc} onChange={e => setPropNasc(e.target.value)} className={input} />
                  </div>
                </>
              )}
            </div>

            {propTipo === 'F' && (
              <div>
                <label className={label}>Estado civil</label>
                <div className="relative">
                  <select value={propEstCivil} onChange={e => setPropEstCivil(e.target.value)} className={`${input} appearance-none pr-8`}>
                    <option value="">—</option>
                    <option value="solteiro">Solteiro(a)</option>
                    <option value="casado">Casado(a)</option>
                    <option value="divorciado">Divorciado(a)</option>
                    <option value="viuvo">Viúvo(a)</option>
                    <option value="separado">Separado(a)</option>
                    <option value="companheiro">União estável</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            <div>
              <label className={label}>Observações da contratação</label>
              <textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                rows={2}
                className={`${input} resize-y`}
              />
            </div>
          </section>

          {/* Resumo */}
          <section className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-700">Resumo</p>
            <p className="text-sm text-violet-900">
              <strong>{p.seguradoras.find(s => s.sigla === sigla)?.nome}</strong> ·{' '}
              {escolha.formaPagamento} · {escolha.qtdParcelas}× {formatarBRL(escolha.valorParcela)}
            </p>
            <p className="text-lg font-bold text-violet-900">
              {formatarBRL(escolha.qtdParcelas * escolha.valorParcela)}
            </p>
            <p className="text-[11px] text-violet-700">
              O número da apólice chega depois da emissão pela seguradora.
            </p>
          </section>
        </>
      )}

      {erro && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {escolha && (
        <button
          type="button"
          onClick={efetivar}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {isPending ? 'Enviando…' : 'Contratar seguro'}
        </button>
      )}
    </div>
  )
}
