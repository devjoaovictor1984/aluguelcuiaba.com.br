// Resolução de módulos pros testes rodarem no Node puro (node --test),
// sem bundler nem dependência nova: traduz o alias "@/..." pra src/,
// completa imports sem extensão (".ts"/".tsx"), como o Next faz no build,
// e transpila .tsx (JSX) com o TypeScript que o projeto já tem.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const RAIZ_SRC = new URL('../src/', import.meta.url)
const ts = createRequire(import.meta.url)('typescript')

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

export async function load(url, contexto, proximo) {
  if (url.startsWith('file:') && url.endsWith('.tsx')) {
    const arquivo = fileURLToPath(url)
    const { outputText } = ts.transpileModule(readFileSync(arquivo, 'utf8'), {
      fileName: arquivo,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    })
    return { format: 'module', source: outputText, shortCircuit: true }
  }
  return proximo(url, contexto)
}
