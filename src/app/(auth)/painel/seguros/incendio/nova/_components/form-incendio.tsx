'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, AlertCircle, Calculator, ChevronDown, Sparkles, Flame, Info,
} from 'lucide-react'
import { maskCep, maskCpfCnpj, maskMoney, maskTelefone, parseMoney } from '@/lib/formatters'
import {
  COBERTURA_LABEL, VIGENCIA_LABEL,
  type CalculoIncendioInput, type Ocupacao, type PacoteAssistencia,
  type TipoCobertura, type TipoSeguro, type TipoVigencia,
} from '@/lib/seguros/incendio/tipos'
import { sugerirOpcional, sugerirValores } from '@/lib/seguros/incendio/sugestoes'
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
  endereco: { cep: string; endereco: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string }
  inquilino: { id: string; nome: string; cpfCnpj: string; email: string; telefone: string; dataNascimento: string } | null
  proprietario: { id: string; nome: string; cpfCnpj: string } | null
}

/**
 * Uma cotação anterior servindo de ponto de partida.
 *
 * `dados` é o `payload` guardado no cálculo — a entrada exata que foi
 * mandada à seguradora. Refazer é preencher a tela com ela; o registro
 * novo nasce do botão calcular, como qualquer outro.
 */
export interface BaseCotacao {
  dados: CalculoIncendioInput
  controle: string
  contratoId: string | null
  imovelId: string | null
  inquilinoId: string | null
  proprietarioId: string | null
  pacoteAssist: number | null
}

interface Props {
  contratos: ContratoOpcao[]
  contratoInicial: string | null
  base?: BaseCotacao | null
}

/** Centavos vindos do banco no formato mascarado da tela. */
const centavos = (n?: number | null) =>
  n && n > 0 ? maskMoney(String(Math.round(n * 100))) : ''

/**
 * Teto de cada cobertura acessória, como fração do LMI de incêndio.
 *
 * Medido contra a API em 08/09/2026, em produção, residencial: perda de
 * aluguel a 30% do LMI passa e a 35% volta
 * `"IS da Cobertura: Perda ou Pagamento de Aluguel fora do limite"`. Testado
 * com LMI de 144.000 e de 60.000 — quebra no mesmo ponto nos dois, então é
 * proporção e não valor absoluto.
 *
 * Em comercial o teto é MENOR: em 17/08 o vendaval a 30% foi recusado e a
 * 25% passou, com o mesmo payload. Onde exatamente ele fica em comercial
 * ainda não foi medido — por isso a checagem abaixo avisa em vez de
 * bloquear, e a mensagem diz de onde vem o número.
 */
const TETO_SOBRE_INCENDIO = 0.30

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

export function FormIncendio({ contratos, contratoInicial, base }: Props) {
  const d = base?.dados
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState('')

  const [seguradoras, setSeguradoras] = useState<string[]>([])
  /**
   * O que aconteceu com a busca das seguradoras.
   *
   * Existe porque "lista vazia" tinha dois significados na tela: ainda
   * carregando, e falhou. Os dois mostravam "Carregando seguradoras…" —
   * então uma queda da corretora virava uma tela que carrega para sempre,
   * sem dizer nada a ninguém. Em 08/09/2026, com a API deles respondendo em
   * 90s, foi exatamente o que o corretor viu.
   */
  const [buscaSeguradoras, setBuscaSeguradoras] =
    useState<'carregando' | 'ok' | 'falhou'>('carregando')
  const [erroSeguradoras, setErroSeguradoras] = useState('')
  const [seguradora, setSeguradora] = useState(d?.seguradora ?? '')
  const [ocupacoes, setOcupacoes] = useState<Ocupacao[]>([])
  const [pacotes, setPacotes] = useState<PacoteAssistencia[]>([])
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(false)

  const [contratoId, setContratoId] = useState(base?.contratoId ?? contratoInicial ?? '')
  const [tipoSeguro, setTipoSeguro] = useState<TipoSeguro>(d?.tipoSeguro ?? 'R')
  // Anual por padrão, como no painel da corretora — lá a cotação nasce com
  // 365 dias e o mensalizado é escolha. O catálogo de assistência muda com
  // a vigência (códigos 8 a 12 no anual, 1 a 5 no mensalizado), então o
  // padrão errado também trocava a lista de pacotes por baixo.
  const [tipoVigencia, setTipoVigencia] = useState<TipoVigencia>(d?.tipoVigencia ?? 0)
  const [tipoCobertura, setTipoCobertura] = useState<TipoCobertura>(d?.tipoCobertura ?? 2)
  const [ocupacao, setOcupacao] = useState(d?.ocupacao?.rubrica ?? '')
  const [pacote, setPacote] = useState(
    base?.pacoteAssist != null ? String(base.pacoteAssist) : '',
  )

  const [aluguel, setAluguel] = useState(centavos(d?.aluguel))
  const [inicio, setInicio] = useState(d?.inicioVigencia ?? hoje())
  const [fim, setFim] = useState(d?.fimVigencia ?? somarMeses(hoje(), 12))

  const [cep, setCep] = useState(d?.endereco?.cep ? maskCep(d.endereco.cep) : '')
  const [endereco, setEndereco] = useState(d?.endereco?.endereco ?? '')
  const [numero, setNumero] = useState(d?.endereco?.numero ?? '')
  const [complemento, setComplemento] = useState(d?.endereco?.complemento ?? '')
  /** Referência interna da imobiliária — "Controle / CTRL-PASTA" no painel deles. */
  const [controle, setControle] = useState(base?.controle ?? '')
  const [bairro, setBairro] = useState(d?.endereco?.bairro ?? '')
  const [cidade, setCidade] = useState(d?.endereco?.cidade ?? 'Cuiabá')
  const [uf, setUf] = useState(d?.endereco?.uf ?? 'MT')

  const [inqNome, setInqNome] = useState(d?.inquilino?.nome ?? '')
  const [inqDoc, setInqDoc] = useState(
    d?.inquilino?.cpfCnpj ? maskCpfCnpj(d.inquilino.cpfCnpj) : '',
  )
  const [inqEmail, setInqEmail] = useState(d?.inquilino?.email ?? '')
  const [inqFone, setInqFone] = useState(
    d?.inquilino?.telefone ? maskTelefone(d.inquilino.telefone) : '',
  )
  const [inqNasc, setInqNasc] = useState(d?.inquilino?.dataNascimento ?? '')
  const [inqSexo, setInqSexo] = useState<'M' | 'F' | ''>(d?.inquilino?.sexo ?? '')

  const [propNome, setPropNome] = useState(d?.proprietario?.nome ?? '')
  const [propDoc, setPropDoc] = useState(
    d?.proprietario?.cpfCnpj ? maskCpfCnpj(d.proprietario.cpfCnpj) : '',
  )

  // Limites das coberturas, em centavos mascarados.
  const [vIncendio, setVIncendio] = useState(centavos(d?.valores?.incendio))
  const [vPerdaAluguel, setVPerdaAluguel] = useState(centavos(d?.valores?.perdaAluguel))
  const [vVendaval, setVVendaval] = useState(centavos(d?.valores?.vendaval))
  const [vDanosEletricos, setVDanosEletricos] = useState(centavos(d?.valores?.danosEletricos))
  const [vVazamento, setVVazamento] = useState(centavos(d?.valores?.vazamento))
  const [vRespCivil, setVRespCivil] = useState(centavos(d?.valores?.respCivil))
  const [vConteudo, setVConteudo] = useState(centavos(d?.valores?.conteudo))

  /**
   * Quais coberturas adicionais estão marcadas.
   *
   * Antes isto era deduzido do valor: marcada = valor > 0. Funcionava nas
   * duas que têm sugestão (responsabilidade civil e danos elétricos, que
   * nascem preenchidas), e não funcionava em nenhuma das outras — vendaval,
   * vazamento e conteúdo entram em branco de propósito, então a caixa
   * marcava e desmarcava sozinha no mesmo clique. Parecia restrição da
   * seguradora e era só o estado errado.
   */
  const [extras, setExtras] = useState<Record<string, boolean>>(() => ({
    vendaval: (d?.valores?.vendaval ?? 0) > 0,
    respCivil: (d?.valores?.respCivil ?? 0) > 0,
    danosEletricos: (d?.valores?.danosEletricos ?? 0) > 0,
    vazamento: (d?.valores?.vazamento ?? 0) > 0,
    conteudo: (d?.valores?.conteudo ?? 0) > 0,
  }))

  const [idsCrm, setIdsCrm] = useState<{
    imovelId: string | null; inquilinoId: string | null; proprietarioId: string | null
  }>({
    imovelId: base?.imovelId ?? null,
    inquilinoId: base?.inquilinoId ?? null,
    proprietarioId: base?.proprietarioId ?? null,
  })

  const cent = (n: number) => (n > 0 ? maskMoney(String(Math.round(n * 100))) : '')

  /* ── Seguradoras ── */
  /**
   * Contador de tentativa: é o que o botão "tentar de novo" incrementa
   * para o efeito rodar outra vez. Mesmo formato do efeito de catálogo
   * logo abaixo — a busca vive DENTRO do efeito, e não numa função
   * chamada por ele.
   */
  const [tentativaSeguradoras, setTentativaSeguradoras] = useState(0)

  useEffect(() => {
    let cancelado = false

    void (async () => {
      try {
        const r = await listarSeguradorasDoIncendio()
        if (cancelado) return
        if ('error' in r && r.error) {
          setBuscaSeguradoras('falhou')
          setErroSeguradoras(r.error)
          return
        }
        const lista = r.seguradoras ?? []
        if (lista.length === 0) {
          setBuscaSeguradoras('falhou')
          setErroSeguradoras('A corretora não devolveu nenhuma seguradora habilitada.')
          return
        }
        setSeguradoras(lista)
        setSeguradora(s => s || lista[0])
        setBuscaSeguradoras('ok')
      } catch (e) {
        // A action pode REJEITAR, e não só devolver { error }: timeout da
        // função, queda de rede, deploy no meio. Sem este catch a promessa
        // morria em silêncio e a tela ficava carregando para sempre — foi
        // o que se viu em 08/09/2026, com a API da corretora em 90s.
        if (cancelado) return
        setBuscaSeguradoras('falhou')
        setErroSeguradoras(
          e instanceof Error && e.message
            ? e.message
            : 'Não foi possível falar com a corretora.',
        )
      }
    })()

    return () => { cancelado = true }
  }, [tentativaSeguradoras])

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
    // A vigência do seguro é de 12 meses, e não a do contrato de locação:
    // copiar `dataTermino` mandava 30 meses ao `/calculo` num contrato de
    // 30. Mesma conta da digitação manual, logo abaixo no campo "Início".
    setFim(somarMeses(c.dataInicio || hoje(), 12))
    setCep(c.endereco.cep ? maskCep(c.endereco.cep) : '')
    setEndereco(c.endereco.endereco)
    setNumero(c.endereco.numero)
    setComplemento(c.endereco.complemento)
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

  // Desde 11/09/2026 a tela oferece só a Alfa (SEGURADORAS_INCENDIO_ATIVAS),
  // então isto não dispara. Fica porque as regras da Porto foram medidas
  // contra a API, e apagá-las custaria remedi-las quando ela voltar.
  const ehPorto = seguradora.toLowerCase().startsWith('porto')
  const inqEhPJ = inqDoc.replace(/\D/g, '').length > 11

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
    // A seguradora exige a data para PF e PJ. Medido: sem ela, ou com ela
    // vazia, o cálculo volta 400 "data_inquilino não informado" — inclusive
    // para empresa, onde a data não tem significado óbvio.
    if (!inqNasc) {
      return setErro(inqEhPJ
        ? 'Informe a data de abertura da empresa — a seguradora exige a data também para PJ.'
        : 'Informe a data de nascimento do inquilino.')
    }
    if (!propNome.trim()) return setErro('Informe o nome do proprietário.')
    if (!nomeCompleto(propNome)) return setErro('Informe o nome COMPLETO do proprietário — a seguradora recusa só o primeiro nome.')
    if (propDoc.replace(/\D/g, '').length < 11) return setErro('CPF/CNPJ do proprietário incompleto.')
    if (!inicio || !fim) return setErro('Informe a vigência.')
    if (parseMoney(vIncendio) <= 0) return setErro('Informe o valor da cobertura de incêndio.')

    /**
     * Teto das acessórias sobre o LMI de incêndio.
     *
     * A seguradora recusa com "IS da Cobertura: <nome> fora do limite", que
     * não diz qual é o limite nem sobre o que ele incide — e o corretor fica
     * mexendo no valor no escuro. Medido em 08/09/2026: 30% passa, 35% não,
     * e o corte acompanha o LMI (mesmo ponto com 144.000 e com 60.000).
     *
     * Avisa em vez de bloquear: em comercial o teto é menor (vendaval a 30%
     * foi recusado em 17/08) e não foi medido onde fica. Barrar com um
     * número que talvez não valha ali seria trocar uma recusa por outra.
     */
    /**
     * Cobertura marcada sem valor não é cobertura: a API recebe zero e a
     * apólice sai sem ela, calada. Melhor barrar aqui do que o corretor
     * descobrir na emissão.
     */
    const semValor = ([
      ['vendaval', 'Vendaval', vVendaval],
      ['respCivil', 'Responsabilidade civil', vRespCivil],
      ['danosEletricos', 'Danos elétricos', vDanosEletricos],
      ['vazamento', 'Vazamento', vVazamento],
      ['conteudo', 'Conteúdo', vConteudo],
    ] as const).filter(([id, , v]) => extras[id] && parseMoney(v) <= 0)

    if (semValor.length) {
      return setErro(
        `${semValor.map(([, n]) => n).join(', ')} ${semValor.length > 1 ? 'estão marcadas' : 'está marcada'} ` +
        'sem valor. Informe o limite de cada uma ou desmarque a cobertura.',
      )
    }

    const lmi = parseMoney(vIncendio)
    const acima = ([
      ['Perda de aluguel', parseMoney(vPerdaAluguel)],
      ['Vendaval', parseMoney(vVendaval)],
      ['Danos elétricos', parseMoney(vDanosEletricos)],
      ['Vazamento', parseMoney(vVazamento)],
      ['Responsabilidade civil', parseMoney(vRespCivil)],
    ] as const).filter(([, v]) => v > lmi * TETO_SOBRE_INCENDIO)

    if (acima.length) {
      return setErro(
        `${acima.map(([n]) => n).join(', ')} ${acima.length > 1 ? 'passam' : 'passa'} de ` +
        `30% do limite de incêndio (máx. ${maskMoney(String(Math.round(lmi * TETO_SOBRE_INCENDIO * 100)))}). ` +
        'A seguradora recusa acima disso — em imóvel comercial o teto costuma ser ainda menor.',
      )
    }
    // A Porto exige conteúdo mesmo quando a cobertura é "somente prédio", e
    // trata zero como não informado.
    if (ehPorto && parseMoney(vConteudo) <= 0) {
      return setErro('A Porto exige um valor para a cobertura de conteúdo, mesmo em "somente prédio".')
    }

    startTransition(async () => {
      const r = await calcularApoliceIncendio({
        controle: controle.trim() || null,
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
          endereco: { cep, endereco, numero, complemento, bairro, cidade, uf },
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
          {buscaSeguradoras === 'carregando' && (
            <p className="text-xs text-gray-400 py-2">Carregando seguradoras…</p>
          )}
        </div>

        {buscaSeguradoras === 'ok' && seguradoras.length === 1 && (
          <p className="text-[11px] text-gray-400">
            Hoje a plataforma cota só na {seguradoras[0]}.
          </p>
        )}

        {buscaSeguradoras === 'falhou' && (
          <div className="rounded-xl bg-amber-50 ring-1 ring-amber-300 px-3.5 py-3 space-y-2">
            <p className="text-[11px] text-amber-900 leading-snug">
              <strong>A corretora não respondeu.</strong> Sem a lista de
              seguradoras não dá para cotar — e isso costuma ser lentidão do
              lado deles, não erro seu.
              {erroSeguradoras && (
                <> <span className="text-amber-800">({erroSeguradoras})</span></>
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                setBuscaSeguradoras('carregando')
                setErroSeguradoras('')
                setTentativaSeguradoras(n => n + 1)
              }}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700"
            >
              Tentar de novo
            </button>
          </div>
        )}

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
          {/* O painel da corretora avisa isso numa caixa amarela e a API não
              devolve o dado. Descobrir na recusa é tarde: a cotação inteira
              já foi preenchida. */}
          <p className="text-[11px] text-gray-500 mt-1 leading-snug">
            Construção inferior ou mista não é aceita pelas seguradoras — só
            alvenaria. Confirme antes de cotar.
          </p>
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

        {/*
          Duas listas separadas, e a separação é o assunto.

          O painel da corretora sugere DUAS coberturas — incêndio e perda de
          aluguel — e deixa as outras em zero, desmarcadas. Quando
          sugeríamos as seis, a mesma casa saía 2,8x mais cara aqui do que
          lá, e a diferença parecia tarifa quando era escolha nossa.
        */}
        <div className="grid sm:grid-cols-2 gap-3 pt-1 border-t border-gray-50">
          {([
            ['Valor do imóvel — incêndio, raio e explosão *', vIncendio, setVIncendio],
            ['Perda de aluguel', vPerdaAluguel, setVPerdaAluguel],
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
          Estes dois saem do aluguel, na mesma conta do painel da corretora.
          Ajuste o de incêndio se conhecer o valor de reconstrução do imóvel —
          é ele que manda no prêmio.
        </p>

        {/*
          Opcionais por caixa, como no painel da corretora: desmarcadas, e o
          valor sugerido só aparece quando o corretor marca. Campo aberto e
          vazio convida a inventar número; caixa desmarcada não.
        */}
        <div className="rounded-xl bg-gray-50 ring-1 ring-gray-100 px-3.5 py-3 space-y-2.5">
          <p className="text-xs font-semibold text-gray-700">
            Coberturas adicionais{' '}
            <span className="font-normal text-gray-400">— opcionais, como no painel da corretora</span>
          </p>

          {([
            ['vendaval', 'Vendaval, furacão, ciclone, tornado, granizo', vVendaval, setVVendaval, null],
            ['respCivil', 'Responsabilidade civil', vRespCivil, setVRespCivil, 'respCivil'],
            ['danosEletricos', 'Danos elétricos', vDanosEletricos, setVDanosEletricos, 'danosEletricos'],
            ['vazamento', 'Vazamento', vVazamento, setVVazamento, null],
            ...(tipoCobertura !== 3
              ? [['conteudo', 'Conteúdo', vConteudo, setVConteudo, null] as const]
              : []),
          ] as const).map(([id, rotulo, valor, setter, chave]) => {
            // Digitar um valor também marca: quem já sabe o número não
            // precisa clicar na caixa antes.
            const marcada = extras[id] || parseMoney(valor) > 0
            const faltaValor = marcada && parseMoney(valor) <= 0
            return (
              <div key={id} className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={marcada}
                  onChange={e => {
                    setExtras(m => ({ ...m, [id]: e.target.checked }))
                    if (!e.target.checked) { setter(''); return }
                    const base = parseMoney(vIncendio)
                    if (chave && base > 0) setter(cent(sugerirOpcional(chave, base)))
                  }}
                  className="w-4 h-4 shrink-0 accent-orange-600"
                />
                <span className="flex-1 min-w-0 text-xs text-gray-700">{rotulo}</span>
                {/*
                  O campo vai DENTRO de um invólucro de largura fixa em vez de
                  receber `w-36` na própria classe: `input` já traz `w-full`, e
                  as duas larguras têm a mesma especificidade — quem ganha é a
                  ordem no CSS gerado, não a ordem na string. O `w-full` venceu,
                  o campo tomou a linha inteira e o nome da cobertura foi
                  espremido até desaparecer.
                */}
                <div className="w-36 shrink-0">
                  <input
                    value={valor}
                    onChange={e => {
                      setter(maskMoney(e.target.value))
                      if (parseMoney(e.target.value) > 0) setExtras(m => ({ ...m, [id]: true }))
                    }}
                    className={`${input} ${marcada ? '' : 'opacity-40'} ${faltaValor ? 'ring-2 ring-amber-400' : ''}`}
                    inputMode="numeric"
                    placeholder={faltaValor ? 'informe o valor' : '0,00'}
                  />
                </div>
              </div>
            )
          })}

          <p className="text-[11px] text-gray-500 leading-snug pt-0.5">
            O painel sugere <strong>10%</strong> do valor do imóvel para
            responsabilidade civil e <strong>1%</strong> para danos elétricos.
            Vendaval, vazamento e conteúdo entram em branco: não vimos o valor
            que eles sugerem, e chutar aqui é o que nos tirou do lugar antes.
            Marque a caixa e digite o limite. Cada cobertura é limitada a 30%
            do valor de incêndio.
          </p>

          <p className="text-[11px] text-amber-800 leading-snug">
            <strong>Danos elétricos sai caro:</strong> a taxa da API é 1,69%,
            contra 0,72% na tabela do painel da corretora. Está perguntado a eles.
          </p>
        </div>
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
            <label className={label}>Complemento</label>
            <input
              value={complemento}
              onChange={e => setComplemento(e.target.value)}
              placeholder="Apto 302, bloco B"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Controle</label>
            <input
              value={controle}
              onChange={e => setControle(e.target.value)}
              placeholder="nº da pasta, referência interna"
              className={input}
            />
            <p className="text-[11px] text-gray-400 mt-1 leading-snug">
              Só pra você achar depois. Não vai pra seguradora.
            </p>
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
            <label className={label}>
              {inqEhPJ ? 'Abertura da empresa' : 'Nascimento'} <span className="text-red-500">*</span>
            </label>
            <input type="date" value={inqNasc} onChange={e => setInqNasc(e.target.value)} className={input} />
            {inqEhPJ && (
              <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                A seguradora exige a data também para empresa.
              </p>
            )}
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
