import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { ambienteMaximiza, chamar, sanitizarParaLog } from './maximiza/client'
import {
  lerArquivos, lerPlanos, lerResultadoAnalise, lerSeguradoras,
  montarAnalise, montarContratacao,
} from './maximiza/mapper'
import type {
  AnaliseInput, ArquivoRecebido, ContratacaoInput, PlanosPreco,
  ResultadoAnalise, Seguradora,
} from './tipos'

/**
 * Fachada de seguros usada pelo app.
 *
 * Nenhuma rota, action ou componente fala com a Maximiza direto — tudo
 * passa por aqui. É o que permite trocar ou somar corretora sem mexer em
 * tela, e o que garante que toda chamada caia em seguro_eventos.
 */

type Admin = ReturnType<typeof createAdminClient>

/* ── Log ───────────────────────────────────────────────────────────── */

interface LogInput {
  userId?: string | null
  analiseId?: string | null
  direcao: 'saida' | 'entrada'
  endpoint: string
  httpStatus?: number | null
  duracaoMs?: number | null
  request?: unknown
  response?: unknown
  erro?: string | null
}

/**
 * Grava a trilha de auditoria. Nunca lança: log que derruba a operação
 * que deveria auditar é pior que log ausente.
 */
export async function registrarEvento(admin: Admin, e: LogInput): Promise<void> {
  try {
    await admin.from('seguro_eventos').insert({
      user_id: e.userId ?? null,
      analise_id: e.analiseId ?? null,
      direcao: e.direcao,
      endpoint: e.endpoint,
      http_status: e.httpStatus ?? null,
      duracao_ms: e.duracaoMs ?? null,
      request: e.request === undefined ? null : sanitizarParaLog(e.request),
      response: e.response === undefined ? null : sanitizarParaLog(e.response),
      erro: e.erro ?? null,
    })
  } catch {
    /* silencioso de propósito */
  }
}

/** Envolve uma chamada à API com log de sucesso e de falha. */
async function comLog<T>(
  admin: Admin,
  ctx: { userId?: string | null; analiseId?: string | null; endpoint: string; request?: unknown },
  fn: () => Promise<{ dados: T; httpStatus: number; duracaoMs: number }>,
): Promise<T> {
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
    await registrarEvento(admin, { ...ctx, direcao: 'saida', httpStatus, erro })
    throw e
  }
}

/* ── Catálogo ──────────────────────────────────────────────────────── */

/** Seguradoras habilitadas e quais aceitam análise reduzida. */
export async function listarSeguradoras(admin: Admin): Promise<Seguradora[]> {
  const dados = await comLog<unknown>(
    admin,
    { endpoint: '/apiFiancaAnalise/seguradorasAnalise' },
    () => chamar('/apiFiancaAnalise/seguradorasAnalise', { metodo: 'GET' }),
  )
  return lerSeguradoras(dados)
}

/** Atividades CNAE — só necessário em imóvel comercial. Lista grande e estável. */
export async function listarCnae(admin: Admin): Promise<{ id: string; descricao: string }[]> {
  const dados = await comLog<unknown>(
    admin,
    { endpoint: '/apiFiancaAnalise/listarCNAE' },
    () => chamar('/apiFiancaAnalise/listarCNAE', { metodo: 'GET' }),
  )
  const lista = Array.isArray(dados) ? dados : []
  return lista.map((c: Record<string, unknown>) => ({
    id: String(c.id ?? ''),
    descricao: String(c.descricao ?? '').trim(),
  })).filter(c => c.id)
}

/* ── Imobiliária ───────────────────────────────────────────────────── */

export interface ImobiliariaDados {
  pessoa: 'F' | 'J'
  cpfCnpj: string
  razao: string
  fantasia: string
  responsavelNome: string
  responsavelCpf: string
  responsavelRg?: string | null
  responsavelOrgao?: string | null
  dataNascimento?: string | null      // ISO
  cep: string
  endereco: string
  numero: string
  complemento?: string | null
  bairro: string
  cidade: string
  uf: string
  ddd: string
  fone: string
  email: string
}

/** O corretor já existe do lado da corretora? */
export async function consultarImobiliaria(
  admin: Admin, cnpjCpf: string, userId?: string,
): Promise<Record<string, unknown> | null> {
  try {
    const dados = await comLog<Record<string, unknown>>(
      admin,
      { userId, endpoint: '/apiImobiliaria/consultarImobiliaria', request: { cnpj_cpf: cnpjCpf } },
      () => chamar('/apiImobiliaria/consultarImobiliaria', { corpo: { cnpj_cpf: cnpjCpf } }),
    )
    return dados && Object.keys(dados).length > 0 ? dados : null
  } catch {
    // Não encontrado costuma vir como erro. Quem chama trata como "cadastrar".
    return null
  }
}

export async function cadastrarImobiliaria(
  admin: Admin, d: ImobiliariaDados, userId?: string,
): Promise<{ id: number; msg: string }> {
  const corpo = {
    pessoa: d.pessoa,
    cpf: d.cpfCnpj,
    razao: d.razao,
    fantasia: d.fantasia,
    responsavel_imob: d.responsavelNome,
    cpf_responsavel_imob: d.responsavelCpf,
    rg_responsavel_imob: d.responsavelRg ?? undefined,
    orgao_responsavel_imob: d.responsavelOrgao ?? undefined,
    data_nasc: d.dataNascimento
      ? String(d.dataNascimento).slice(0, 10).split('-').reverse().join('/')
      : undefined,
    cep: d.cep,
    endereco: d.endereco,
    numero: d.numero,
    complemento: d.complemento ?? '',
    bairro: d.bairro,
    cidade: d.cidade,
    uf: d.uf,
    ddd_fone1: d.ddd,
    fone: d.fone,
    email: d.email,
  }

  const dados = await comLog<{ id?: number; msg?: string }>(
    admin,
    { userId, endpoint: '/apiImobiliaria/cadastrarImobiliaria', request: corpo },
    () => chamar('/apiImobiliaria/cadastrarImobiliaria', { corpo }),
  )
  return { id: Number(dados?.id ?? 0), msg: String(dados?.msg ?? '') }
}

/* ── Análise ───────────────────────────────────────────────────────── */

export async function transmitirAnalise(
  admin: Admin,
  input: AnaliseInput,
  ctx: { userId: string; analiseId: string; cnpjImobiliaria: string },
): Promise<ResultadoAnalise> {
  const corpo = montarAnalise(input, {
    ambiente: ambienteMaximiza(),
    cnpjImobiliaria: ctx.cnpjImobiliaria,
  })

  const dados = await comLog<unknown>(
    admin,
    { userId: ctx.userId, analiseId: ctx.analiseId, endpoint: '/apiFiancaAnalise/transmitirAnalise', request: corpo },
    () => chamar('/apiFiancaAnalise/transmitirAnalise', { corpo }),
  )
  return lerResultadoAnalise(dados)
}

/** Nova tentativa numa análise existente — recusa não é fim de linha. */
export async function transmitirReanalise(
  admin: Admin,
  idExterno: number,
  seguradoras: string[],
  ctx: { userId: string; analiseId: string },
): Promise<ResultadoAnalise> {
  const corpo = {
    seguradorasAnalise: seguradoras,
    codigo: idExterno,
    ambiente: ambienteMaximiza(),
  }

  const dados = await comLog<unknown>(
    admin,
    { ...ctx, endpoint: '/apiFiancaAnalise/transmitirReanalise', request: corpo },
    () => chamar('/apiFiancaAnalise/transmitirReanalise', { corpo }),
  )
  return lerResultadoAnalise(dados)
}

/**
 * Estado completo da análise, com os PDFs.
 *
 * É também a fonte de verdade depois de um webhook: o payload que eles
 * enviam não é autenticado, então usamos ele só como aviso de mudança e
 * confirmamos aqui, com nosso token.
 */
export async function consultarAnalise(
  admin: Admin,
  idExterno: number,
  ctx?: { userId?: string; analiseId?: string },
): Promise<{ resultado: ResultadoAnalise; arquivos: ArquivoRecebido[] }> {
  const dados = await comLog<Record<string, unknown>>(
    admin,
    { ...ctx, endpoint: `/apiFiancaAnalise/${idExterno}` },
    () => chamar(`/apiFiancaAnalise/${idExterno}`, { metodo: 'GET' }),
  )

  const resultado = lerResultadoAnalise(dados)
  const arquivos: ArquivoRecebido[] = []
  const analises = (dados?.analises ?? []) as Record<string, unknown>[]
  for (const a of analises) {
    const sigla = a.sigla ? String(a.sigla).toLowerCase() : null
    arquivos.push(...lerArquivos(a.base64Pdf, sigla))
  }

  return { resultado, arquivos }
}

/* ── Preços e contratação ──────────────────────────────────────────── */

export async function consultarPrecos(
  admin: Admin,
  idExterno: number,
  seguradoraSigla: string,
  encargos: Record<string, number>,
  ctx?: { userId?: string; analiseId?: string },
): Promise<PlanosPreco> {
  const corpo = { id_analise: idExterno, seguradora: seguradoraSigla, ...encargos }

  const dados = await comLog<unknown>(
    admin,
    { ...ctx, endpoint: '/apiFiancaAnalise/consultarPrecosApi', request: corpo },
    () => chamar('/apiFiancaAnalise/consultarPrecosApi', { corpo }),
  )
  return lerPlanos(dados)
}

/**
 * Efetiva a contratação.
 *
 * O retorno traz só uma mensagem — sem número de apólice. A apólice chega
 * depois pelo webhook de arquivos (codigo_tipo 9), então quem chama deve
 * gravar como 'enviada' e esperar.
 */
export async function contratar(
  admin: Admin,
  input: ContratacaoInput,
  ctx: { userId: string; analiseId: string },
): Promise<{ msg: string }> {
  const corpo = montarContratacao(input)

  const dados = await comLog<{ msg?: string }>(
    admin,
    { ...ctx, endpoint: '/apiFiancaAnalise/contratar', request: corpo },
    () => chamar('/apiFiancaAnalise/contratar', { corpo }),
  )
  return { msg: String(dados?.msg ?? '') }
}

export { ambienteMaximiza } from './maximiza/client'
export * from './tipos'
