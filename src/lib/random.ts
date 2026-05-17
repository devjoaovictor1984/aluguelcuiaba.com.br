// Seed estável por dia (timezone Cuiabá): mesma data → mesmo seed.
// Usado pra random determinístico na listagem de imóveis: ordem muda diariamente
// mas é consistente entre páginas/refresh dentro do mesmo dia.

export function seedDoDia(): number {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Cuiaba',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const data = fmt.format(new Date()) // "YYYY-MM-DD"
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0
  }
  return hash >>> 0
}

// PRNG mulberry32 — rápido, determinístico, 32 bits de seed
function mulberry32(seed: number): () => number {
  let t = seed
  return () => {
    t = (t + 0x6D2B79F5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffleSeeded<T>(arr: T[], seed: number): T[] {
  const rnd = mulberry32(seed)
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
