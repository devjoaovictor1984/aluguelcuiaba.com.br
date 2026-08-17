'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, AlertCircle, Calculator, ChevronDown, Sparkles, Flame, Info,
} from 'lucide-react'
import { maskCep, maskCpfCnpj, maskMoney, maskTelefone, parseMoney } from '@/lib/formatters'
import {
  COBERTURA_LABEL, VIGENCIA_LABEL,
  type Ocupacao, type PacoteAssistencia, type TipoCobertura, type TipoSeguro, type TipoVigencia,
} from '@/lib/seguros/incendio/tipos'
import { sugerirValores } from '@/lib/seguros/incendio/sugestoes'
import {
  calcularApoliceIncendio, carregarCatalogoIncendio, listarSeguradorasDoIncendio,
} from '../../../actions-incendio'

interface ContratoOpcao {
  id: string
  codigo: string
  titulo: string
  aluguel: number
  dataInicio: string
  dataTermino: string | null
  imovelId: string | null
  endereco: { cep: string; endereco: string; numero: string; bairro: string; cidade: string; uf: string }
  inquilino: { id: string; nome: string; cpfCnpj: string; email: string; telefone: string; dataNascimento: string } | null
  proprietario: { id: string; nome: string; cpfCnpj: string } | null
}

interface Props {
  contratos: ContratoOpcao[]
  contratoInicial: string | null
}

const input = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm text-gray-900'
const label = 'text-xs font-medium text-gray-600 block mb-1'

/** Nome e sobrenome — é o que a Alfa exige de segurado e beneficiário. */
const nomeCompleto = (v: string) =>
  v.trim().split(/\s+/).filter(p => p.length > 1).length >= 2

/** Soma meses a uma data ISO. */
function somarMeses(iso: string, meses: number): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + meses)
  return d.toISOString().slice(0, 10)
}

const hoje = () => new Date().toISOString().slice(0, 10)

export function FormIncendio({ contratos, contratoInicial }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState('')

  const [seguradoras, setSeguradoras] = useState<string[]>([])
  const [seguradora, setSeguradora] = useState('')
  const [ocupacoes, setOcupacoes] = useState<Ocupacao[]>([])
  const [pacotes, setPacotes] = useState<PacoteAssistencia[]>([])
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(false)

  const [contratoId, setContratoId] = useState(contratoInicial ?? '')
  const [tipoSeguro, setTipoSeguro] = useState<TipoSeguro>('R')
  const [tipoVigencia, setTipoVigencia] = useState<TipoVigencia>(1)
  const [tipoCobertura, setTipoCobertura] = useState<TipoCobertura>(2)
  const [ocupacao, setOcupacao] = useState('')
  const [pacote, setPacote] = useState('')

  const [aluguel, setAluguel] = useState('')
  const [inicio, setInicio] = useState(hoje())
  const [fim, setFim] = useState(somarMeses(hoje(), 12))

  const [cep, setCep] = useState('')
  const [endereco, setEndereco] = useState('')
  const [numero, setNumero] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('Cuiabá')
  const [uf, setUf] = useState('MT')

  const [inqNome, setInqNome] = useState('')
  const [inqDoc, setInqDoc] = useState('')
  const [inqEmail, setInqEmail] = useState('')
  const [inqFone, setInqFone] = useState('')
  const [inqNasc, setInqNasc] = useState('')
  const [inqSexo, setInqSexo] = useState<'M' | 'F' | ''>('')

  const [propNome, setPropNome] = useState('')
  const [propDoc, setPropDoc] = useState('')

  // Limites das coberturas, em centavos mascarados.
  const [vIncendio, setVIncendio] = useState('')
  const [vPerdaAluguel, setVPerdaAluguel] = useState('')
  const [vVendaval, setVVendaval] = useState('')
  const [vDanosEletricos, setVDanosEletricos] = useState('')
  const [vVazamento, setVVazamento] = useState('')
  const [vRespCivil, setVRespCivil] = useState('')
  const [vConteudo, setVConteudo] = useState('')

  const [idsCrm, setIdsCrm] = useState<{
    imovelId: string | null; inquilinoId: string | null; proprietarioId: string | null
  }>({ imovelId: null, inquilinoId: null, proprietarioId: null })

  const cent = (n: number) => (n > 0 ? maskMoney(String(Math.round(n * 100))) : '')

  /* ── Seguradoras ── */
  useEffect(() => {
    void (async () => {
      const r = await listarSeguradorasDoIncendio()
      if ('error' in r) { setErro(r.error!); return }
      setSeguradoras(r.seguradoras ?? [])
      if (r.seguradoras?.length) setSeguradora(s => s || r.seguradoras![0])
    })()
  }, [])

  /* ── Catálogo: depende da seguradora e do tipo ── */
  useEffect(() => {
    if (!seguradora) return
    // Descarta resposta obsoleta: trocar de seguradora rápido dispara
    // duas buscas, e a primeira pode chegar depois da segunda.
    let cancelado = false

    void (async () => {
      setCarregandoCatalogo(true)
      const r = await carregarCatalogoIncendio(seguradora, tipoSeguro, tipoVigencia)
      if (cancelado) return

      setCarregandoCatalogo(false)
      if ('error' in r) { setErro(r.error!); return }
      setOcupacoes(r.ocupacoes ?? [])
      setPacotes(r.pacotes ?? [])
      // Escolhas anteriores podem não existir no catálogo novo.
      setOcupacao(o => (r.ocupacoes ?? []).some(x => x.rubrica === o) ? o : '')
      setPacote(p => (r.pacotes ?? []).some(x => String(x.codigo) === p) ? p : String(r.pacotes?.[0]?.codigo ?? ''))
    })()

    return () => { cancelado = true }
  }, [seguradora, tipoSeguro, tipoVigencia])

  /**
   * Sugere os limites a partir do aluguel — o painel da corretora faz isso
   * num botão "Sugerir valores"; aqui já vem preenchido. Só sobrescreve
   * campo vazio, pra não apagar ajuste do corretor.
   */
  const aplicarSugestao = (valorAluguel: number, cobertura: TipoCobertura, forcar = false) => {
    const s = sugerirValores(valorAluguel, cobertura)
    const por = (atual: string, novo?: number) =>
      (forcar || !atual) && novo ? cent(novo) : atual
    setVIncendio(a => por(a, s.incendio))
    setVPerdaAluguel(a => por(a, s.perdaAluguel))
    setVVendaval(a => por(a, s.vendaval))
    setVDanosEletricos(a => por(a, s.danosEletricos))
    setVVazamento(a => por(a, s.vazamento))
    setVRespCivil(a => por(a, s.respCivil))
    setVConteudo(a => (forcar || !a) ? (s.conteudo ? cent(s.conteudo) : '') : a)
  }

  const escolherContrato = (id: string) => {
    setContratoId(id)
    const c = contratos.find(x => x.id === id)
    if (!c) return

    setAluguel(cent(c.aluguel))
    setInicio(c.dataInicio || hoje())
    setFim(c.dataTermino || somarMeses(c.dataInicio || hoje(), 12))
    setCep(c.endereco.cep ? maskCep(c.endereco.cep) : '')
    setEndereco(c.endereco.endereco)
    setNumero(c.endereco.numero)
    setBairro(c.endereco.bairro)
    setCidade(c.endereco.cidade)
    setUf(c.endereco.uf)

    if (c.inquilino) {
      setInqNome(c.inquilino.nome)
      setInqDoc(c.inquilino.cpfCnpj ? maskCpfCnpj(c.inquilino.cpfCnpj) : '')
      setInqEmail(c.inquilino.email)
      setInqFone(c.inquilino.telefone ? maskTelefone(c.inquilino.telefone) : '')
      setInqNasc(c.inquilino.dataNascimento)
    }
    if (c.proprietario) {
      setPropNome(c.proprietario.nome)
      setPropDoc(c.proprietario.cpfCnpj ? maskCpfCnpj(c.proprietario.cpfCnpj) : '')
    }

    setIdsCrm({
      imovelId: c.imovelId,
      inquilinoId: c.inquilino?.id ?? null,
      proprietarioId: c.proprietario?.id ?? null,
    })

    aplicarSugestao(c.aluguel, tipoCobertura, true)
  }

  const ehPorto = seguradora.toLowerCase().startsWith('porto')

  const calcular = () => {
    setErro('')
    const oc = ocupacoes.find(o => o.rubrica === ocupacao)

    if (!seguradora) return setErro('Escolha a seguradora.')
    if (!oc) return setErro('Escolha a ocupação do imóvel.')
    if (!pacote) return setErro('Escolha o pacote de assistência.')
    if (parseMoney(aluguel) <= 0) return setErro('Informe o valor do aluguel.')
    if (cep.replace(/\D/g, '').length !== 8) return setErro('CEP inválido.')
    if (!inqNome.trim()) return setErro('Informe o nome do inquilino.')
    // A Alfa recusa nome de uma palavra só, e a mensagem dela é "Nome
    // Segurado Inválido" — que não diz o que corrigir. Barramos antes.
    if (!nomeCompleto(inqNome)) return setErro('Informe o nome COMPLETO do inquilino — a seguradora recusa só o primeiro nome.')
    if (inqDoc.replace(/\D/g, '').length < 11) return setErro('CPF/CNPJ do inquilino incompleto.')
    if (!propNome.trim()) return setErro('Informe o nome do proprietário.')
    if (!nomeCompleto(propNome)) return setErro('Informe o nome COMPLETO do proprietário — a seguradora recusa só o primeiro nome.')
    if (propDoc.replace(/\D/g, '').length < 11) return setErro('CPF/CNPJ do proprietário incompleto.')
    if (!inicio || !fim) return setErro('Informe a vigência.')
    if (parseMoney(vIncendio) <= 0) return setErro('Informe o valor da cobertura de incêndio.')
    // A Porto exige conteúdo mesmo quando a cobertura é "somente prédio", e
    // trata zero como não informado.
    if (ehPorto && parseMoney(vConteudo) <= 0) {
      return setErro('A Porto exige um valor para a cobertura de conteúdo, mesmo em "somente prédio".')
    }

    startTransition(async () => {
      const r = await calcularApoliceIncendio({
        contratoId: contratoId || null,
        imovelId: idsCrm.imovelId,
        inquilinoId: idsCrm.inquilinoId,
        proprietarioId: idsCrm.proprietarioId,
        dados: {
          seguradora,
          aluguel: parseMoney(aluguel),
          tipoSeguro,
          tipoCobertura,
          tipoVigencia,
          ocupacao: { rubrica: oc.rubrica, cdresp2: oc.cdresp2 },
          pacoteAssistencia: parseInt(pacote, 10),
          inquilino: {
            tipo: inqDoc.replace(/\D/g, '').length > 11 ? 'J' : 'F',
            nome: inqNome.trim(),
            cpfCnpj: inqDoc,
            email: inqEmail.trim() || null,
            dataNascimento: inqNasc || null,
            sexo: inqSexo || null,
            telefone: inqFone || null,
          },
          proprietario: {
            tipo: propDoc.replace(/\D/g, '').length > 11 ? 'J' : 'F',
            nome: propNome.trim(),
            cpfCnpj: propDoc,
          },
          endereco: { cep, endereco, numero, bairro, cidade, uf },
          inicioVigencia: inicio,
          fimVigencia: fim,
          valores: {
            incendio: parseMoney(vIncendio) || 0,
            perdaAluguel: parseMoney(vPerdaAluguel) || 0,
            vendaval: parseMoney(vVendaval) || 0,
            danosEletricos: parseMoney(vDanosEletricos) || 0,
            vazamento: parseMoney(vVazamento) || 0,
            respCivil: parseMoney(vRespCivil) || 0,
            conteudo: parseMoney(vConteudo) || 0,
          },
        },
      })

      if (r.error) { setErro(r.error); if (r.id) router.push(`/painel/seguros/incendio/${r.id}`); return }
      router.push(`/painel/seguros/incendio/${r.id}`)
    })
  }

  const valorAluguel = parseMoney(aluguel)

  return (
    <div className="space-y-4">
      {/* Contrato */}
      {contratos.length > 0 && (
        <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4">
          <label className={label}>Puxar de um contrato ativo</label>
          <div className="relative">
            <select value={contratoId} onChange={e => escolherContrato(e.target.value)} className={`${input} appearance-none pr-8`}>
              <option value="">— preencher manualmente —</option>
              {contratos.map(c => (
                <option key={c.id} value={c.id}>{c.codigo} · {c.titulo}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Traz imóvel, inquilino, proprietário, aluguel e vigência de uma vez.
          </p>
        </section>
      )}

      {/* Seguradora e modalidade */}
      <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-900">Seguradora e modalidade</h2>

        <div className="flex gap-2">
          {seguradoras.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSeguradora(s)}
              className={`flex-1 rounded-xl border-2 px-3 py-3 text-sm font-bold transition-colors ${
                seguradora === s
                  ? 'border-orange-600 bg-orange-50 text-orange-700'
                  : 'border-gray-100 text-gray-600 hover:border-orange-300'
              }`}
            >
              {s}
            </button>
          ))}
          {seguradoras.length === 0 && (
            <p className="text-xs text-gray-400 py-2">Carregando seguradoras…</p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Tipo</label>
            <div className="relative">
              <select value={tipoSeguro} onChange={e => setTipoSeguro(e.target.value as TipoSeguro)} className={`${input} appearance-none pr-8`}>
                <option value="R">Residencial</option>
                <option value="C">Comercial</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={label}>Vigência</label>
            <div className="relative">
              <select value={tipoVigencia} onChange={e => setTipoVigencia(Number(e.target.value) as TipoVigencia)} className={`${input} appearance-none pr-8`}>
                <option value={1}>{VIGENCIA_LABEL[1]} — cobra junto do aluguel</option>
                <option value={0}>{VIGENCIA_LABEL[0]} — pagamento à vista ou parcelado</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div>
          <label className={label}>
            Ocupação do imóvel <span className="text-red-500">*</span>
            {carregandoCatalogo && <Loader2 size={11} className="inline animate-spin ml-1.5 text-gray-400" />}
          </label>
          <div className="relative">
            <select value={ocupacao} onChange={e => setOcupacao(e.target.value)} className={`${input} appearance-none pr-8`} disabled={carregandoCatalogo}>
              <option value="">— escolha —</option>
              {ocupacoes.map(o => <option key={o.rubrica} value={o.rubrica}>{o.nome}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className={label}>Assistência 24h</label>
          <div className="relative">
            <select value={pacote} onChange={e => setPacote(e.target.value)} className={`${input} appearance-none pr-8`} disabled={carregandoCatalogo}>
              {pacotes.map(p => <option key={p.codigo} value={p.codigo}>{p.tipo}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {pacotes.find(p => String(p.codigo) === pacote)?.descricao && (
            <p className="text-[11px] text-gray-500 mt-1 leading-snug">
              {pacotes.find(p => String(p.codigo) === pacote)!.descricao}
            </p>
          )}
        </div>
      </section>

      {/* Coberturas */}
      <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-900">Coberturas</h2>
          {valorAluguel > 0 && (
            <button
              type="button"
              onClick={() => aplicarSugestao(valorAluguel, tipoCobertura, true)}
              className="shrink-0 flex items-center gap-1 rounded-lg ring-1 ring-orange-200 bg-orange-50 px-2.5 py-1.5 text-[11px] font-bold text-orange-700"
            >
              <Sparkles size={11} /> Refazer sugestão
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Aluguel <span className="text-red-500">*</span></label>
            <input
              value={aluguel}
              onChange={e => {
                const v = maskMoney(e.target.value)
                setAluguel(v)
                aplicarSugestao(parseMoney(v), tipoCobertura)
              }}
              className={input}
              inputMode="numeric"
            />
            <p className="text-[11px] text-gray-400 mt-0.5">Base da sugestão de valores.</p>
          </div>
          <div>
            <label className={label}>Divisão da cobertura</label>
            <div className="relative">
              <select
                value={tipoCobertura}
                onChange={e => {
                  const t = Number(e.target.value) as TipoCobertura
                  setTipoCobertura(t)
                  aplicarSugestao(valorAluguel, t, true)
                }}
                className={`${input} appearance-none pr-8`}
              >
                {([2, 3, 4, 5] as TipoCobertura[]).map(t => (
                  <option key={t} value={t}>{COBERTURA_LABEL[t]}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-1 border-t border-gray-50">
          {([
            ['Incêndio, raio e explosão *', vIncendio, setVIncendio],
            ['Perda de aluguel', vPerdaAluguel, setVPerdaAluguel],
            ['Vendaval', vVendaval, setVVendaval],
            ['Danos elétricos', vDanosEletricos, setVDanosEletricos],
            ['Vazamento', vVazamento, setVVazamento],
            ['Responsabilidade civil', vRespCivil, setVRespCivil],
            ...(tipoCobertura !== 3 ? [['Conteúdo', vConteudo, setVConteudo] as const] : []),
          ] as const).map(([rotulo, valor, setter]) => (
            <div key={rotulo}>
              <label className={label}>{rotulo}</label>
              <input
                value={valor}
                onChange={e => setter(maskMoney(e.target.value))}
                className={input}
                inputMode="numeric"
              />
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-500 flex items-start gap-1.5">
          <Info size={11} className="mt-0.5 shrink-0 text-gray-400" />
          Sugerimos os limites a partir do aluguel. Ajuste se conhecer o valor de
          reconstrução do imóvel — é ele que define a cobertura de incêndio.
        </p>
      </section>

      {/* Vigência e endereço */}
      <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-900">Vigência e endereço</h2>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Início <span className="text-red-500">*</span></label>
            <input type="date" value={inicio} onChange={e => { setInicio(e.target.value); setFim(somarMeses(e.target.value, 12)) }} className={input} />
          </div>
          <div>
            <label className={label}>Fim <span className="text-red-500">*</span></label>
            <input type="date" value={fim} onChange={e => setFim(e.target.value)} className={input} />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className={label}>CEP <span className="text-red-500">*</span></label>
            <input value={cep} onChange={e => setCep(maskCep(e.target.value))} className={input} inputMode="numeric" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Endereço</label>
            <input value={endereco} onChange={e => setEndereco(e.target.value)} className={input} />
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-3">
          <div>
            <label className={label}>Número</label>
            <input value={numero} onChange={e => setNumero(e.target.value)} className={input} inputMode="numeric" />
          </div>
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

      {/* Partes */}
      <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-900">Inquilino</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Nome <span className="text-red-500">*</span></label>
            <input value={inqNome} onChange={e => setInqNome(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>CPF / CNPJ <span className="text-red-500">*</span></label>
            <input value={inqDoc} onChange={e => setInqDoc(maskCpfCnpj(e.target.value))} className={input} inputMode="numeric" />
          </div>
          <div>
            <label className={label}>E-mail</label>
            <input value={inqEmail} onChange={e => setInqEmail(e.target.value)} className={input} type="email" />
          </div>
          <div>
            <label className={label}>Celular</label>
            <input value={inqFone} onChange={e => setInqFone(maskTelefone(e.target.value))} className={input} inputMode="tel" />
          </div>
          <div>
            <label className={label}>Nascimento</label>
            <input type="date" value={inqNasc} onChange={e => setInqNasc(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Sexo</label>
            <div className="relative">
              <select value={inqSexo} onChange={e => setInqSexo(e.target.value as 'M' | 'F' | '')} className={`${input} appearance-none pr-8`}>
                <option value="">—</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Exigido só na contratação.</p>
          </div>
        </div>

        <h2 className="text-sm font-bold text-gray-900 pt-2 border-t border-gray-50">Proprietário (segurado)</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Nome <span className="text-red-500">*</span></label>
            <input value={propNome} onChange={e => setPropNome(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>CPF / CNPJ <span className="text-red-500">*</span></label>
            <input value={propDoc} onChange={e => setPropDoc(maskCpfCnpj(e.target.value))} className={input} inputMode="numeric" />
          </div>
        </div>
      </section>

      {erro && (
        <div className="rounded-lg bg-rose-50 ring-1 ring-rose-100 p-2.5 text-xs text-rose-700 flex items-start gap-2">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <button
        type="button"
        onClick={calcular}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 disabled:opacity-50 py-3.5 font-semibold text-white"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
        {isPending ? 'Calculando…' : 'Calcular prêmio'}
      </button>

      {valorAluguel > 0 && (
        <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1">
          <Flame size={11} /> O cálculo sai na hora e não gera compromisso —
          a contratação é o passo seguinte.
        </p>
      )}
    </div>
  )
}
