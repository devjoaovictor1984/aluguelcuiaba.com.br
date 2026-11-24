/**
 * "Jd. Itália", "JARDIM ITALIA" e "Jardim Itália" são o mesmo bairro.
 * Cada sistema escreve de um jeito; aqui o nome vira uma chave comparável
 * e é procurado na lista de bairros do site. O que não casar sozinho, o
 * anunciante escolhe na tela (e a escolha fica salva em importacao_bairros).
 */

const ABREVIACOES: Array<[RegExp, string]> = [
  [/\bjd\b/g, 'jardim'],
  [/\bjard\b/g, 'jardim'],
  [/\bres\b/g, 'residencial'],
  [/\bresid\b/g, 'residencial'],
  [/\bcond\b/g, 'condominio'],
  [/\bconj\b/g, 'conjunto'],
  [/\bcj\b/g, 'conjunto'],
  [/\bpq\b/g, 'parque'],
  [/\bpque\b/g, 'parque'],
  [/\bvl\b/g, 'vila'],
  [/\bst\b/g, 'setor'],
  [/\bns\b/g, 'nossa senhora'],
  [/\bsta\b/g, 'santa'],
  [/\bsto\b/g, 'santo'],
  [/\bsao\b/g, 'sao'],
  [/\bdr\b/g, 'doutor'],
  [/\bprof\b/g, 'professor'],
  [/\bloteam\b/g, 'loteamento'],
  [/\blot\b/g, 'loteamento'],
  [/\bhab\b/g, 'habitacional'],
]

const ROMANOS: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' }

/** Chave de comparação: sem acento, minúsculo, abreviação expandida, romano → número. */
export function normalizarBairro(nome: string | null | undefined): string {
  if (!nome) return ''
  let s = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[.\-_/,()'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  for (const [re, por] of ABREVIACOES) s = s.replace(re, por)
  s = s.replace(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/g, (m) => ROMANOS[m] ?? m)
  // "CPA 1" e "CPA-I" e "CPA I" → "cpa 1"
  s = s.replace(/([a-z])(\d)/g, '$1 $2').replace(/\s+/g, ' ').trim()
  return s
}

/** Sem as palavras genéricas — "Residencial Paiaguás" casa com "Paiaguás". */
function nucleo(chave: string) {
  return chave
    .replace(/\b(bairro|jardim|residencial|condominio|conjunto|parque|vila|setor|loteamento|habitacional|recanto|chacara|chacaras|portal|nucleo)\b/g, ' ')
    .replace(/\b(de|da|do|das|dos|e)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface BairroSite { id: string; nome: string }

export function criarBuscaBairros(bairros: BairroSite[], mapaSalvo: Map<string, string> = new Map()) {
  const porChave = new Map<string, string>()
  const porNucleo = new Map<string, string[]>()
  for (const b of bairros) {
    const k = normalizarBairro(b.nome)
    if (!porChave.has(k)) porChave.set(k, b.id)
    const n = nucleo(k)
    if (n) porNucleo.set(n, [...(porNucleo.get(n) ?? []), b.id])
  }

  /** id do bairro, ou null quando não dá pra ter certeza. */
  return function acharBairro(nome: string | null | undefined): string | null {
    const k = normalizarBairro(nome)
    if (!k) return null
    const salvo = mapaSalvo.get(k)
    if (salvo) return salvo
    const exato = porChave.get(k)
    if (exato) return exato
    const n = nucleo(k)
    const candidatos = n ? porNucleo.get(n) : undefined
    // Só aceita pelo núcleo quando é inequívoco (um bairro só).
    if (candidatos && new Set(candidatos).size === 1) return candidatos[0]
    return null
  }
}

export function normalizarCidade(c: string | null | undefined) {
  return (c ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
}
