import 'server-only'
import http from 'node:http'
import https from 'node:https'
import dns from 'node:dns'
import net from 'node:net'
import zlib from 'node:zlib'

/**
 * Download de URL informada pelo usuário (o XML e as fotos dele).
 *
 * É SSRF em potencial: o servidor busca o endereço que alguém digitou. Por
 * isso só sai para a internet pública — localhost, rede interna e o
 * endereço de metadados da nuvem (169.254.169.254) são recusados NA HORA DA
 * CONEXÃO (lookup próprio), o que também barra DNS que muda de IP entre a
 * checagem e o acesso. Redirecionamento é seguido à mão (máx. 5), cada salto
 * passando pela mesma regra. Tamanho e tempo têm teto.
 */

export class ErroDownload extends Error {
  status?: number
  constructor(msg: string, status?: number) { super(msg); this.status = status }
}

function ipv4Privado(ip: string) {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some(n => !Number.isInteger(n))) return true
  const [a, b] = p
  return a === 0 || a === 10 || a === 127
    || (a === 100 && b >= 64 && b <= 127)     // CGNAT
    || (a === 169 && b === 254)               // link-local / metadados
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224                                // multicast / reservado
}

export function ipProibido(ip: string): boolean {
  if (net.isIPv4(ip)) return ipv4Privado(ip)
  if (net.isIPv6(ip)) {
    const s = ip.toLowerCase()
    const v4 = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (v4) return ipv4Privado(v4[1])
    return s === '::' || s === '::1' || s.startsWith('fc') || s.startsWith('fd')
      || s.startsWith('fe8') || s.startsWith('fe9') || s.startsWith('fea') || s.startsWith('feb')
      || s.startsWith('ff') || s.startsWith('64:ff9b')
  }
  return true
}

const lookupSeguro: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, enderecos) => {
    if (err) return callback(err, '', 4)
    const lista = (enderecos as unknown as dns.LookupAddress[]) ?? []
    const ok = lista.find(e => !ipProibido(e.address))
    if (!ok || lista.some(e => ipProibido(e.address))) {
      return callback(new ErroDownload('Endereço de rede interna não é permitido.'), '', 4)
    }
    if ((options as dns.LookupOptions).all) {
      return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, [ok])
    }
    callback(null, ok.address, ok.family)
  })
}

export interface OpcoesDownload {
  maxBytes: number
  timeoutMs: number
  /** Cabeçalho Accept. */
  aceitar?: string
}

export interface Baixado {
  bytes: Buffer
  tipo: string | null
  urlFinal: string
}

function validarUrl(bruta: string): URL {
  let u: URL
  try { u = new URL(bruta) } catch { throw new ErroDownload('URL inválida.') }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new ErroDownload('A URL precisa começar com http:// ou https://')
  if (u.username || u.password) throw new ErroDownload('URL com usuário/senha embutidos não é aceita.')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(host) && ipProibido(host)) throw new ErroDownload('Endereço de rede interna não é permitido.')
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new ErroDownload('Endereço de rede interna não é permitido.')
  return u
}

function umaVez(u: URL, op: OpcoesDownload): Promise<{ status: number; local?: string; bytes?: Buffer; tipo: string | null }> {
  return new Promise((resolve, reject) => {
    const mod = u.protocol === 'https:' ? https : http
    const req = mod.request(u, {
      method: 'GET',
      lookup: lookupSeguro,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImportadorImoveis/1.0)',
        'Accept': op.aceitar ?? '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      timeout: op.timeoutMs,
    }, (res) => {
      const status = res.statusCode ?? 0
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume()
        return resolve({ status, local: res.headers.location, tipo: null })
      }
      if (status < 200 || status >= 300) {
        res.resume()
        return resolve({ status, tipo: null })
      }
      const declarado = Number(res.headers['content-length'] ?? 0)
      const enc = String(res.headers['content-encoding'] ?? '').toLowerCase()
      if (!enc && declarado > op.maxBytes) {
        res.destroy()
        return reject(new ErroDownload(`Arquivo grande demais (${Math.round(declarado / 1048576)} MB).`))
      }
      let corpo: NodeJS.ReadableStream = res
      if (enc === 'gzip' || enc === 'x-gzip') corpo = res.pipe(zlib.createGunzip())
      else if (enc === 'deflate') corpo = res.pipe(zlib.createInflate())
      else if (enc === 'br') corpo = res.pipe(zlib.createBrotliDecompress())

      const partes: Buffer[] = []
      let total = 0
      corpo.on('data', (c: Buffer) => {
        total += c.length
        if (total > op.maxBytes) {
          req.destroy()
          reject(new ErroDownload(`Arquivo grande demais (mais de ${Math.round(op.maxBytes / 1048576)} MB).`))
          return
        }
        partes.push(c)
      })
      corpo.on('end', () => resolve({ status, bytes: Buffer.concat(partes), tipo: (res.headers['content-type'] as string | undefined) ?? null }))
      corpo.on('error', (e: Error) => reject(new ErroDownload(`Falha ao ler a resposta: ${e.message}`)))
    })
    // Teto de tempo TOTAL (o `timeout` do request é só de ociosidade).
    const relogio = setTimeout(() => req.destroy(new ErroDownload('Tempo esgotado ao baixar.')), op.timeoutMs)
    req.on('close', () => clearTimeout(relogio))
    req.on('timeout', () => req.destroy(new ErroDownload('O servidor não respondeu a tempo.')))
    req.on('error', (e) => reject(e instanceof ErroDownload ? e : new ErroDownload(traduzirErroRede(e))))
    req.end()
  })
}

function traduzirErroRede(e: Error & { code?: string }) {
  switch (e.code) {
    case 'ENOTFOUND': return 'Endereço não encontrado (o domínio não existe ou está fora do ar).'
    case 'ECONNREFUSED': return 'O servidor recusou a conexão.'
    case 'ECONNRESET': return 'A conexão caiu no meio do download.'
    case 'ETIMEDOUT': return 'O servidor não respondeu a tempo.'
    case 'CERT_HAS_EXPIRED': return 'O certificado HTTPS do servidor está vencido.'
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE': return 'O certificado HTTPS do servidor não é válido.'
    default: return e.message || 'Falha de rede.'
  }
}

export async function baixar(url: string, op: OpcoesDownload): Promise<Baixado> {
  let atual = validarUrl(url)
  for (let salto = 0; salto <= 5; salto++) {
    const r = await umaVez(atual, op)
    if (r.local) {
      atual = validarUrl(new URL(r.local, atual).href)
      continue
    }
    if (r.bytes) return { bytes: r.bytes, tipo: r.tipo, urlFinal: atual.href }
    const msg =
      r.status === 401 || r.status === 403 ? `O servidor negou o acesso (${r.status}). A URL pode exigir login ou estar bloqueada para robôs.`
        : r.status === 404 ? 'Não encontrado (404). Confira a URL.'
          : r.status === 429 ? 'O servidor pediu para esperar (429). Tente de novo mais tarde.'
            : r.status >= 500 ? `O servidor de origem está com erro (${r.status}).`
              : `Resposta inesperada (${r.status}).`
    throw new ErroDownload(msg, r.status)
  }
  throw new ErroDownload('Redirecionamentos demais.')
}
