// Resolução de módulos pros testes rodarem no Node puro (node --test),
// sem bundler nem dependência nova: traduz o alias "@/..." pra src/ e
// completa imports sem extensão (".ts"), como o Next faz no build.
const RAIZ_SRC = new URL('../src/', import.meta.url)

export async function resolve(especificador, contexto, proximo) {
  let spec = especificador
  if (spec.startsWith('@/')) spec = new URL(spec.slice(2), RAIZ_SRC).href
  try {
    return await proximo(spec, contexto)
  } catch (erro) {
    const relativo = spec.startsWith('.') || spec.startsWith('file:')
    if (!relativo || /\.[cm]?[jt]sx?$/.test(spec)) throw erro
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      try { return await proximo(spec + ext, contexto) } catch { /* tenta a próxima */ }
    }
    throw erro
  }
}
