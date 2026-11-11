/**
 * Diferença palavra a palavra entre dois textos de cláusula. Arquivo à
 * parte pra tela da biblioteca não carregar o modelo inteiro no navegador.
 */

// ── Diferença palavra a palavra (pra mostrar a atualização do modelo) ──

export type TrechoDiff = { tipo: 'igual' | 'removido' | 'incluido'; texto: string }

/**
 * Diferença por palavras (LCS). Texto de cláusula tem centenas de palavras,
 * então a tabela O(n·m) cabe folgada; acima de ~4 mil palavras de cada
 * lado devolve "tudo trocado" em vez de travar.
 */
export function diffPalavras(antes: string, depois: string): TrechoDiff[] {
  const a = antes.split(/(\s+)/).filter(Boolean)
  const b = depois.split(/(\s+)/).filter(Boolean)
  if (a.length * b.length > 16_000_000) {
    return [{ tipo: 'removido', texto: antes }, { tipo: 'incluido', texto: depois }]
  }
  const n = a.length, m = b.length
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: TrechoDiff[] = []
  const push = (tipo: TrechoDiff['tipo'], texto: string) => {
    const ult = out[out.length - 1]
    if (ult && ult.tipo === tipo) ult.texto += texto
    else out.push({ tipo, texto })
  }
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { push('igual', a[i]); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push('removido', a[i]); i++ }
    else { push('incluido', b[j]); j++ }
  }
  while (i < n) push('removido', a[i++])
  while (j < m) push('incluido', b[j++])
  return out
}
