/**
 * Ligação entre a biblioteca de cada usuário (contrato_clausulas) e o
 * modelo publicado no código (seed-modelo.ts).
 *
 * Cada cláusula do modelo tem um CÓDIGO estável e uma VERSÃO. A cópia na
 * biblioteca do usuário guarda o código e a versão do modelo de que veio
 * (v105). Assim:
 *  - a seleção automática acha a variante certa pelo código, mesmo que o
 *    usuário tenha renomeado o título;
 *  - quando o modelo publica versão nova, a biblioteca mostra a diferença
 *    e o usuário decide. Nada é sobrescrito sozinho.
 */
import { SEED_CLAUSULAS, type ClausulaSeed } from './seed-modelo'

/** "Pet — aceita (com autorização)" → "pet-aceita-com-autorizacao". */
export function slug(texto: string): string {
  return texto
    .normalize('NFD').replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function codigoDoSeed(c: ClausulaSeed): string {
  return c.codigo ?? `${c.tipo}.${slug(c.titulo)}`
}

export function versaoDoSeed(c: ClausulaSeed): number {
  return c.versao ?? 1
}

export const MODELO_POR_CODIGO: ReadonlyMap<string, ClausulaSeed> =
  new Map(SEED_CLAUSULAS.map(c => [codigoDoSeed(c), c]))

/** Texto normalizado pra comparar sem ligar pra espaço e quebra de linha. */
export const normalizarTexto = (t: string) => t.replace(/\s+/g, ' ').trim()

/**
 * Acha a cláusula do modelo correspondente a uma linha antiga da biblioteca
 * (sem código): mesmo tipo e mesmo título. É o mesmo critério que o
 * "importar cláusulas faltantes" sempre usou.
 */
export function modeloDaLinha(row: { tipo: string; titulo: string }): ClausulaSeed | null {
  const alvo = slug(row.titulo)
  return SEED_CLAUSULAS.find(c => c.tipo === row.tipo && slug(c.titulo) === alvo) ?? null
}

/**
 * Versão do modelo em que uma linha antiga se baseia: se o texto é igual ao
 * modelo atual, é a versão atual; senão, considera-se a versão 1 (a única
 * que existia antes do versionamento) — e a biblioteca oferece a diferença.
 */
export function versaoBaseDaLinha(row: { corpo: string }, modelo: ClausulaSeed): number {
  return normalizarTexto(row.corpo) === normalizarTexto(modelo.corpo) ? versaoDoSeed(modelo) : 1
}

/** Linha pronta pra inserir na biblioteca a partir do modelo. */
export function linhaDoModelo(c: ClausulaSeed, userId: string) {
  return {
    user_id: userId,
    tipo: c.tipo,
    categoria: c.categoria,
    titulo: c.titulo,
    numero: c.numero,
    corpo: c.corpo,
    ativa: true,
    codigo: codigoDoSeed(c),
    modelo_versao: versaoDoSeed(c),
  }
}

/** Título original no modelo — é contra ele que as regras de seleção casam. */
export function tituloDeReferencia(row: { codigo?: string | null; titulo: string }): string {
  if (row.codigo) {
    const m = MODELO_POR_CODIGO.get(row.codigo)
    if (m) return m.titulo
  }
  return row.titulo
}

// Diferença palavra a palavra: em diff.ts, que a tela usa sem puxar o modelo.
export { diffPalavras, type TrechoDiff } from './diff'
