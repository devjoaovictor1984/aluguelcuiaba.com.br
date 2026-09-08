import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { consultarImobiliaria } from '../index'
import { ambienteMaximiza } from '../maximiza/client'
import {
  calcularIncendio, listarOcupacoes, listarPacotesAssistencia,
  listarSeguradorasIncendio,
} from './index'
import { sugerirValores } from './sugestoes'
import type {
  Ocupacao, PacoteAssistencia, PessoaIncendio, ResultadoCalculo,
  TipoCobertura, TipoSeguro, TipoVigencia,
} from './tipos'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Cotação de incêndio passo a passo, com o resultado de cada chamada.
 *
 * Para que existe: quando a cotação falha, a tela do corretor diz "não deu"
 * e ponto. Quem precisa consertar está na corretora, não aqui, e o que ele
 * recebe é um print. Isto troca o print por uma sequência — qual passo
 * passou, em quantos segundos, com que status e que corpo — que pode ser
 * lida por quem não é técnico e conferida por quem é.
 *
 * O que ele NÃO faz, e é o ponto principal: nada aqui cria registro do lado
 * da corretora. Só consulta e cálculo. `cadastrarImobiliaria`, `contratar` e
 * `cancelar` não são importados neste arquivo de propósito — é o que permite
 * mandar o link para fora e deixar rodarem à vontade.
 */

export type EstadoPasso = 'ok' | 'lento' | 'falhou' | 'pulado'

export interface PassoDiagnostico {
  chave: string
  titulo: string
  /** O que este passo faz, em uma frase, para quem não é técnico. */
  explicacao: string
  estado: EstadoPasso
  /** Resultado em português — é o que o leigo lê. */
  mensagem: string
  duracaoMs: number
  httpStatus: number | null
  /** Para quem é técnico. */
  endpoint: string
  detalheTecnico?: string
}

export interface ResultadoDiagnostico {
  passos: PassoDiagnostico[]
  ambiente: 1 | 2
  cnpjImobiliaria: string
  /** Preenchido só quando o cálculo fecha. */
  calculo?: ResultadoCalculo
  /** O que o diagnóstico escolheu sozinho dos catálogos. */
  escolhas?: { ocupacao?: Ocupacao; assistencia?: PacoteAssistencia }
}

export interface EntradaDiagnostico {
  seguradora: string
  tipoSeguro: TipoSeguro
  tipoVigencia: TipoVigencia
  tipoCobertura: TipoCobertura
  aluguel: number
  inquilino: PessoaIncendio
  proprietario: PessoaIncendio
  endereco: {
    cep: string; endereco: string; numero: string
    complemento?: string; bairro: string; cidade: string; uf: string
  }
}

/**
 * Acima disto o passo sai amarelo em vez de verde.
 *
 * 5s não é capricho: em 30/08/2026 estes mesmos endpoints respondiam em
 * ~1s, e em 08/09 passaram a levar de 28 a 90s. Um passo que "funciona"
 * em 40 segundos é um passo que vai estourar o timeout do próximo
 * corretor, e quem lê o relatório precisa ver isso antes de acontecer.
 */
const LIMITE_LENTO_MS = 5_000

function estadoPorTempo(ms: number): 'ok' | 'lento' {
  return ms > LIMITE_LENTO_MS ? 'lento' : 'ok'
}

function mensagemDeErro(e: unknown): string {
  const bruto = e instanceof Error ? e.message : String(e)
  if (/aborted due to timeout|timeout/i.test(bruto)) {
    return 'A corretora não respondeu dentro do tempo limite.'
  }
  return bruto
}

function statusDoErro(e: unknown): number | null {
  const s = (e as { httpStatus?: number })?.httpStatus
  return typeof s === 'number' ? s : null
}

/** Roda um passo medindo tempo e capturando a falha em vez de propagá-la. */
async function passo<T>(
  base: Omit<PassoDiagnostico, 'estado' | 'mensagem' | 'duracaoMs' | 'httpStatus'>,
  fn: () => Promise<T>,
  descreverOk: (v: T) => string,
): Promise<{ passo: PassoDiagnostico; valor?: T }> {
  const inicio = Date.now()
  try {
    const valor = await fn()
    const duracaoMs = Date.now() - inicio
    return {
      passo: {
        ...base,
        estado: estadoPorTempo(duracaoMs),
        mensagem: descreverOk(valor),
        duracaoMs,
        httpStatus: 200,
      },
      valor,
    }
  } catch (e) {
    return {
      passo: {
        ...base,
        estado: 'falhou',
        mensagem: mensagemDeErro(e),
        duracaoMs: Date.now() - inicio,
        httpStatus: statusDoErro(e),
        detalheTecnico: e instanceof Error ? e.stack?.split('\n')[0] : undefined,
      },
    }
  }
}

function pulado(
  base: Omit<PassoDiagnostico, 'estado' | 'mensagem' | 'duracaoMs' | 'httpStatus'>,
  porque: string,
): PassoDiagnostico {
  return { ...base, estado: 'pulado', mensagem: porque, duracaoMs: 0, httpStatus: null }
}

export async function diagnosticarIncendio(
  admin: Admin,
  cnpjImobiliaria: string,
  entrada: EntradaDiagnostico,
  userId?: string,
): Promise<ResultadoDiagnostico> {
  const passos: PassoDiagnostico[] = []
  const ambiente = ambienteMaximiza()

  /* 1 · Cadastro — também é o primeiro contato, então mede a autenticação */
  const baseCadastro = {
    chave: 'cadastro',
    titulo: 'Cadastro da imobiliária',
    explicacao:
      'Confere se o CNPJ da imobiliária existe na base da corretora e em quais ' +
      'seguradoras ele está habilitado. É a primeira chamada, então também mede o login.',
    endpoint: 'POST /apiImobiliaria/consultarImobiliaria',
  }
  const inicioCad = Date.now()
  const consulta = await consultarImobiliaria(admin, cnpjImobiliaria, userId)
  const msCad = Date.now() - inicioCad

  if (consulta.estado === 'encontrada') {
    const d = consulta.dados
    passos.push({
      ...baseCadastro,
      estado: estadoPorTempo(msCad),
      httpStatus: 201,
      duracaoMs: msCad,
      mensagem:
        `Encontrado: ${String(d.razao ?? '—')} · Alfa ${String(d.cod_alfa ?? '—')} · ` +
        `Porto ${String(d.cod_porto ?? '—')}`,
      detalheTecnico:
        `alfa_incendio: ${String(d.alfa_incendio)} · porto_incendio: ${String(d.porto_incendio)}`,
    })
  } else if (consulta.estado === 'ausente') {
    passos.push({
      ...baseCadastro,
      estado: 'falhou',
      httpStatus: 400,
      duracaoMs: msCad,
      mensagem: 'A corretora não encontrou este CNPJ na base dela.',
    })
  } else {
    passos.push({
      ...baseCadastro,
      estado: 'falhou',
      httpStatus: null,
      duracaoMs: msCad,
      mensagem: consulta.erro,
    })
  }

  /* 2 · Seguradoras disponíveis */
  const r2 = await passo(
    {
      chave: 'seguradoras',
      titulo: 'Seguradoras disponíveis',
      explicacao: 'Pergunta quais seguradoras estão liberadas para cotar incêndio.',
      endpoint: 'GET /incendioAlfaV2/listarSeguradorasDisponiveis',
    },
    () => listarSeguradorasIncendio(admin),
    (l) => (l.length ? `${l.length} seguradora(s): ${l.join(', ')}` : 'A lista veio vazia.'),
  )
  passos.push(r2.passo)

  /* 3 · Ocupações */
  const baseOcup = {
    chave: 'ocupacoes',
    titulo: 'Catálogo de ocupações',
    explicacao:
      'Busca os tipos de imóvel aceitos (apartamento habitual, casa, loja…). ' +
      'Sem este catálogo não há como cotar: o código da ocupação entra no cálculo.',
    endpoint: `GET /incendioAlfaV2/ocupacoes/${entrada.tipoSeguro}`,
  }
  const r3 = await passo(
    baseOcup,
    () => listarOcupacoes(admin, entrada.seguradora, entrada.tipoSeguro, userId),
    (l) => (l.length ? `${l.length} ocupação(ões). Usando "${l[0].nome}".` : 'O catálogo veio vazio.'),
  )
  passos.push(r3.passo)
  const ocupacao = r3.valor?.[0]

  /* 4 · Assistência 24h */
  const r4 = await passo(
    {
      chave: 'assistencia',
      titulo: 'Pacotes de assistência 24h',
      explicacao:
        'Busca os pacotes de assistência. O catálogo muda conforme a vigência ' +
        'seja anual ou mensalizada — código de uma não vale na outra.',
      endpoint: 'POST /incendioAlfaV2/listaPacotesAssist24hs',
    },
    () => listarPacotesAssistencia(
      admin, entrada.seguradora, entrada.tipoSeguro, entrada.tipoVigencia, userId,
    ),
    (l) => (l.length ? `${l.length} pacote(s). Usando o código ${l[0].codigo}.` : 'Nenhum pacote.'),
  )
  passos.push(r4.passo)
  const assistencia = r4.valor?.[0]

  /* 5 · Cálculo */
  const baseCalc = {
    chave: 'calculo',
    titulo: 'Cálculo do prêmio',
    explicacao:
      'Manda a cotação e recebe o prêmio, as coberturas e as formas de pagamento. ' +
      'É consulta de preço: não emite apólice nem gera cobrança.',
    endpoint: 'POST /incendioAlfaV2/calculo',
  }

  if (!ocupacao) {
    passos.push(pulado(baseCalc, 'Não rodou: o catálogo de ocupações não veio, e o cálculo depende dele.'))
    return { passos, ambiente, cnpjImobiliaria }
  }

  const valores = sugerirValores(entrada.aluguel, entrada.tipoCobertura)
  const hoje = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const daquiUmAno = new Date(hoje)
  daquiUmAno.setFullYear(daquiUmAno.getFullYear() + 1)

  const r5 = await passo(
    baseCalc,
    () => calcularIncendio(admin, {
      seguradora: entrada.seguradora,
      cnpjImobiliaria,
      aluguel: entrada.aluguel,
      tipoSeguro: entrada.tipoSeguro,
      tipoCobertura: entrada.tipoCobertura,
      tipoVigencia: entrada.tipoVigencia,
      ocupacao: { rubrica: ocupacao.rubrica, cdresp2: ocupacao.cdresp2 },
      pacoteAssistencia: assistencia?.codigo ?? 0,
      inquilino: entrada.inquilino,
      proprietario: entrada.proprietario,
      endereco: entrada.endereco,
      inicioVigencia: iso(hoje),
      fimVigencia: iso(daquiUmAno),
      valores,
    }, userId),
    (c) => `Prêmio R$ ${c.premio.toFixed(2)} · líquido R$ ${c.premioLiquido.toFixed(2)} · ` +
           `IOF R$ ${c.iof.toFixed(2)} · ${c.coberturas.length} coberturas`,
  )
  passos.push(r5.passo)

  return {
    passos,
    ambiente,
    cnpjImobiliaria,
    calculo: r5.valor,
    escolhas: { ocupacao, assistencia },
  }
}
