import 'server-only'
import { SeguroApiError } from '../tipos'
import { simular, simuladorAtivo } from './simulador'

/**
 * Cliente HTTP da API Maximiza (fiança v1).
 *
 * Três armadilhas da API que estão tratadas aqui:
 *
 *  1. O header é `Authorization: <token>` — SEM o prefixo "Bearer". Quase
 *     todo cliente HTTP assume Bearer e a chamada falha com 401 sem dizer
 *     por quê.
 *  2. A credencial é e-mail/senha (não API key) e o token vale ~7 dias.
 *     Autenticar a cada request é desperdício e convida a rate limit, então
 *     cacheamos até 5 min antes do `exp` do JWT.
 *  3. Produção e homologação usam a MESMA URL — o que separa as duas é o
 *     campo `ambiente` no corpo. Ver `ambienteMaximiza()`.
 */

const URL_AUTH = 'https://auth.api.seguro.imb.br'
const URL_API  = 'https://fianca.api.seguro.imb.br'

const TIMEOUT_MS = 30_000
const TENTATIVAS = 3

/**
 * 1 = Produção (emite seguro de verdade) · 2 = Homologação.
 *
 * Deriva de MAXIMIZA_AMBIENTE, e nunca de parâmetro ou input do usuário:
 * com a mesma URL nos dois ambientes, um valor errado emite apólice real
 * em cima de um teste. Sem a env var, falha — não assume.
 */
export function ambienteMaximiza(): 1 | 2 {
  const v = process.env.MAXIMIZA_AMBIENTE
  if (v === '1') return 1
  if (v === '2') return 2
  throw new Error(
    'MAXIMIZA_AMBIENTE não definida. Use 2 (homologação) ou 1 (produção). ' +
    'Sem isso não há como distinguir teste de emissão real.',
  )
}

/* ── Token ─────────────────────────────────────────────────────────── */

let cache: { token: string; expiraEm: number } | null = null

/** Lê o `exp` do JWT sem validar assinatura — só pra saber quando renovar. */
function expiracaoDoJwt(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = Buffer.from(payload, 'base64').toString('utf8')
    const exp = JSON.parse(json)?.exp
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

async function obterToken(): Promise<string> {
  if (cache && Date.now() < cache.expiraEm) return cache.token

  const email = process.env.MAXIMIZA_EMAIL
  const password = process.env.MAXIMIZA_SENHA
  if (!email || !password) {
    throw new Error('MAXIMIZA_EMAIL / MAXIMIZA_SENHA não configuradas.')
  }

  const resp = await fetch(`${URL_AUTH}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!resp.ok) {
    throw new SeguroApiError('Falha ao autenticar na Maximiza.', '/auth', resp.status)
  }

  const { accessToken } = (await resp.json()) as { accessToken?: string }
  if (!accessToken) {
    throw new SeguroApiError('Resposta de autenticação sem accessToken.', '/auth', resp.status)
  }

  // Margem de 5 min pra não usar token que expira no meio da requisição.
  // Se o JWT não trouxer `exp`, cai num TTL curto e conservador.
  const exp = expiracaoDoJwt(accessToken)
  cache = {
    token: accessToken,
    expiraEm: exp ? exp - 5 * 60_000 : Date.now() + 60 * 60_000,
  }
  return accessToken
}

/** Descarta o token em cache. Usado quando a API responde 401. */
export function invalidarToken(): void {
  cache = null
}

/* ── Requisição ────────────────────────────────────────────────────── */

export interface RespostaApi<T> {
  dados: T
  httpStatus: number
  duracaoMs: number
}

/**
 * Chama a API já autenticada. Repete em erro transitório (rede, 5xx, 429)
 * com backoff; num 401 renova o token e tenta de novo uma vez.
 *
 * Não repete em 4xx de negócio: se o payload está inválido, insistir só
 * gera consulta duplicada no CPF do inquilino.
 */
export async function chamar<T>(
  caminho: string,
  opcoes: { metodo?: 'GET' | 'POST'; corpo?: unknown } = {},
): Promise<RespostaApi<T>> {
  const { metodo = 'POST', corpo } = opcoes
  const inicio = Date.now()
  let ultimoErro: unknown

  // Demonstração: troca só o transporte. Mapper, persistência e telas
  // continuam sendo os de produção — é o que faz o vídeo mostrar o
  // sistema de verdade, e o que garante que o caminho já esteja
  // exercitado quando a credencial chegar.
  if (simuladorAtivo()) {
    const dados = await simular(caminho, corpo) as T
    return { dados, httpStatus: 200, duracaoMs: Date.now() - inicio }
  }

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const token = await obterToken()

      const resp = await fetch(`${URL_API}${caminho}`, {
        method: metodo,
        headers: {
          // Sem "Bearer" — a API rejeita o formato padrão.
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (resp.status === 401 && tentativa < TENTATIVAS) {
        invalidarToken()
        continue
      }

      const texto = await resp.text()
      let dados: unknown = null
      if (texto) {
        try { dados = JSON.parse(texto) } catch { dados = texto }
      }

      if (!resp.ok) {
        const transitorio = resp.status >= 500 || resp.status === 429
        if (transitorio && tentativa < TENTATIVAS) {
          await espera(tentativa)
          continue
        }
        throw new SeguroApiError(
          `Maximiza respondeu ${resp.status} em ${caminho}.`,
          caminho,
          resp.status,
          dados,
        )
      }

      return { dados: dados as T, httpStatus: resp.status, duracaoMs: Date.now() - inicio }
    } catch (e) {
      ultimoErro = e
      // Erro de negócio não se resolve repetindo.
      if (e instanceof SeguroApiError && e.httpStatus && e.httpStatus < 500 && e.httpStatus !== 429) {
        throw e
      }
      if (tentativa < TENTATIVAS) {
        await espera(tentativa)
        continue
      }
    }
  }

  if (ultimoErro instanceof SeguroApiError) throw ultimoErro
  throw new SeguroApiError(
    `Falha ao chamar ${caminho}: ${ultimoErro instanceof Error ? ultimoErro.message : 'erro desconhecido'}`,
    caminho,
  )
}

/** Backoff exponencial com jitter: 500ms, 1s, 2s (±25%). */
function espera(tentativa: number): Promise<void> {
  const base = 500 * 2 ** (tentativa - 1)
  const jitter = base * 0.25 * (Math.random() * 2 - 1)
  return new Promise(r => setTimeout(r, base + jitter))
}

/* ── Sanitização pro log ───────────────────────────────────────────── */

const CAMPOS_SENSIVEIS = new Set([
  'password', 'senha', 'accessToken', 'authorization',
  'cartao_numero', 'cartao_validade', 'cpf_cartao_titular', 'cartao_titular',
  'base64',
])

/**
 * Remove segredo e binário antes de gravar em seguro_eventos.
 * Cartão nunca é logado (PCI-DSS) e base64 de PDF estouraria a linha.
 */
export function sanitizarParaLog(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 6 || valor === null || valor === undefined) return valor
  if (Array.isArray(valor)) return valor.map(v => sanitizarParaLog(v, profundidade + 1))
  if (typeof valor !== 'object') return valor

  const saida: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    if (CAMPOS_SENSIVEIS.has(k) || CAMPOS_SENSIVEIS.has(k.toLowerCase())) {
      saida[k] = '[omitido]'
    } else {
      saida[k] = sanitizarParaLog(v, profundidade + 1)
    }
  }
  return saida
}
