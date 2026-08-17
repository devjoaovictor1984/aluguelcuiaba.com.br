import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { ambienteMaximiza, chamar } from '../maximiza/client'
import { registrarEvento } from '../index'
import {
  lerBoletos, lerCalculo, lerContratacaoIncendio, lerDocumentos,
  lerFaturamento, lerOcupacoes, lerPacotes, lerSeguradorasIncendio,
  montarCalculo, montarContratacaoIncendio,
} from './mapper'
import type {
  BoletoParcela, CalculoIncendioInput, ContratacaoIncendioInput,
  DocumentosProposta, Faturamento, Ocupacao, PacoteAssistencia,
  ResultadoCalculo, ResultadoContratacao, TipoSeguro, TipoVigencia,
} from './tipos'

/**
 * Fachada do seguro incêndio.
 *
 * Mesma regra da fiança: nenhuma rota ou action fala com a API direto.
 * A diferença é que aqui quase toda chamada carrega o header
 * `seguradora` — só `listarSeguradorasDisponiveis` dispensa.
 */

type Admin = ReturnType<typeof createAdminClient>

const P = 'incendio' as const

/** Envolve a chamada com log, igual à fiança. */
async function comLog<T>(
  admin: Admin,
  ctx: { userId?: string | null; endpoint: string; request?: unknown },
  fn: () => Promise<{ dados: T; httpStatus: number; duracaoMs: number }>,
): Promise<T> {
  const inicio = Date.now()
  try {
    const r = await fn()
    await registrarEvento(admin, {
      ...ctx, direcao: 'saida',
      httpStatus: r.httpStatus, duracaoMs: r.duracaoMs, response: r.dados,
    })
    return r.dados
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e)
    const httpStatus = (e as { httpStatus?: number })?.httpStatus ?? null
    // Mesma razão da fiança: sem o corpo, o log não diz o que foi recusado.
    await registrarEvento(admin, {
      ...ctx, direcao: 'saida', httpStatus, erro,
      response: (e as { corpo?: unknown })?.corpo ?? null,
      duracaoMs: Date.now() - inicio,
    })
    throw e
  }
}

/* ── Catálogo ──────────────────────────────────────────────────────── */

/** Hoje devolve ["Alfa", "Porto"] — array de strings, não de objetos. */
export async function listarSeguradorasIncendio(admin: Admin): Promise<string[]> {
  const dados = await comLog<unknown>(
    admin,
    { endpoint: '/incendioAlfaV2/listarSeguradorasDisponiveis' },
    () => chamar('/incendioAlfaV2/listarSeguradorasDisponiveis', { metodo: 'GET', produto: P }),
  )
  return lerSeguradorasIncendio(dados)
}

/**
 * Ocupações do imóvel (apartamento habitual, casa de veraneio, loja…).
 * A rubrica e o cdresp2 daqui entram no cálculo — não dá pra inventar.
 */
export async function listarOcupacoes(
  admin: Admin, seguradora: string, tipoSeguro: TipoSeguro, userId?: string,
): Promise<Ocupacao[]> {
  const caminho = `/incendioAlfaV2/ocupacoes/${tipoSeguro}`
  const dados = await comLog<unknown>(
    admin,
    { userId, endpoint: caminho },
    () => chamar(caminho, { metodo: 'GET', produto: P, seguradora }),
  )
  return lerOcupacoes(dados)
}

export async function listarPacotesAssistencia(
  admin: Admin, seguradora: string,
  tipoSeguro: TipoSeguro, tipoVigencia: TipoVigencia,
  userId?: string,
): Promise<PacoteAssistencia[]> {
  const corpo = { tipo_seguro: tipoSeguro, tipo_vigencia: String(tipoVigencia) }
  const dados = await comLog<unknown>(
    admin,
    { userId, endpoint: '/incendioAlfaV2/listaPacotesAssist24hs', request: corpo },
    () => chamar('/incendioAlfaV2/listaPacotesAssist24hs', { corpo, produto: P, seguradora }),
  )
  return lerPacotes(dados)
}

/* ── Cálculo e contratação ─────────────────────────────────────────── */

/**
 * Calcula as coberturas e as formas de pagamento.
 *
 * Diferente da fiança, é síncrono e não passa por análise de crédito —
 * o retorno já traz prêmio e parcelas.
 */
export async function calcularIncendio(
  admin: Admin, input: CalculoIncendioInput, userId?: string,
): Promise<ResultadoCalculo> {
  const corpo = montarCalculo(input, ambienteMaximiza())
  const dados = await comLog<unknown>(
    admin,
    { userId, endpoint: '/incendioAlfaV2/calculo', request: corpo },
    () => chamar('/incendioAlfaV2/calculo', { corpo, produto: P, seguradora: input.seguradora }),
  )
  return lerCalculo(dados)
}

/**
 * Contrata. O retorno traz `codigo_seguro` e `numero_proposta` na hora —
 * sem espera e sem webhook, ao contrário da fiança.
 *
 * O `codigo_seguro` é a chave de tudo depois: cancelar, imprimir proposta
 * e imprimir boleto. Perder esse número deixa a apólice órfã.
 */
export async function contratarIncendio(
  admin: Admin, input: ContratacaoIncendioInput, userId?: string,
): Promise<ResultadoContratacao> {
  const corpo = montarContratacaoIncendio(input, ambienteMaximiza())
  const dados = await comLog<unknown>(
    admin,
    { userId, endpoint: '/incendioAlfaV2/contratar', request: corpo },
    () => chamar('/incendioAlfaV2/contratar', { corpo, produto: P, seguradora: input.seguradora, criaRegistro: true }),
  )
  return lerContratacaoIncendio(dados)
}

/** Cancela a apólice. A fiança não tem equivalente na API. */
export async function cancelarIncendio(
  admin: Admin, seguradora: string, codigoSeguro: string, userId?: string,
): Promise<{ ok: boolean; mensagem: string }> {
  // Aqui `ambiente` vai como STRING; no cálculo vai como number.
  const corpo = { ambiente: String(ambienteMaximiza()), codigo_seguro: codigoSeguro }
  const dados = await comLog<{ status?: string; mensagem?: string }>(
    admin,
    { userId, endpoint: '/incendioAlfaV2/cancelar', request: corpo },
    () => chamar('/incendioAlfaV2/cancelar', { corpo, produto: P, seguradora, criaRegistro: true }),
  )
  return {
    ok: String(dados?.status ?? '') === '1',
    mensagem: String(dados?.mensagem ?? ''),
  }
}

/* ── Documentos ────────────────────────────────────────────────────── */

/** Certificado e proposta em base64. Sob demanda, não por webhook. */
export async function imprimirProposta(
  admin: Admin, seguradora: string, codigoSeguro: string, userId?: string,
): Promise<DocumentosProposta> {
  const corpo = { ambiente: String(ambienteMaximiza()), codigo_seguro: codigoSeguro }
  const dados = await comLog<unknown>(
    admin,
    { userId, endpoint: '/incendioAlfaV2/imprimirProposta', request: corpo },
    () => chamar('/incendioAlfaV2/imprimirProposta', { corpo, produto: P, seguradora }),
  )
  return lerDocumentos(dados)
}

/** Um boleto por parcela, com vencimento e pagamento. */
export async function imprimirBoletos(
  admin: Admin, seguradora: string, codigoSeguro: string, userId?: string,
): Promise<BoletoParcela[]> {
  const corpo = { ambiente: String(ambienteMaximiza()), codigo_seguro: codigoSeguro }
  const dados = await comLog<unknown>(
    admin,
    { userId, endpoint: '/incendioAlfaV2/imprimirBoleto', request: corpo },
    () => chamar('/incendioAlfaV2/imprimirBoleto', { corpo, produto: P, seguradora }),
  )
  return lerBoletos(dados)
}

/* ── Faturamento ───────────────────────────────────────────────────── */

/**
 * Faturas da imobiliária, por vigência e ramo.
 *
 * É o único endpoint de toda a integração — fiança inclusive — que dá
 * visão financeira. Sem mês/ano traz a fatura em aberto; com, traz a
 * fechada daquela competência.
 */
export async function listarFaturamento(
  admin: Admin,
  seguradora: string,
  cnpjImobiliaria: string,
  competencia?: { mes: number; ano: number },
  userId?: string,
): Promise<Faturamento[]> {
  const corpo: Record<string, unknown> = {
    ambiente: String(ambienteMaximiza()),
    cnpj_imob: cnpjImobiliaria,
  }
  if (competencia) {
    corpo.mes = competencia.mes
    corpo.ano = competencia.ano
  }

  const dados = await comLog<unknown>(
    admin,
    { userId, endpoint: '/incendioAlfaV2/listarFaturamento', request: corpo },
    () => chamar('/incendioAlfaV2/listarFaturamento', { corpo, produto: P, seguradora }),
  )
  return lerFaturamento(dados)
}

export * from './tipos'
