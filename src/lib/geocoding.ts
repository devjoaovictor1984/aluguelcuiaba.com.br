// Geocoding via Nominatim (OpenStreetMap) — gratuito, sem cadastro.
// Limite: 1 requisição/segundo. Para uso pesado, ver "Política de Uso" em:
// https://operations.osmfoundation.org/policies/nominatim/

interface GeocodeInput {
  rua?: string | null
  numero?: string | number | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
}

export interface GeocodeResult {
  lat: number
  lng: number
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'AluguelCuiaba/1.0 (contato@aluguelcuiaba.com.br)'

function montarQuery(input: GeocodeInput): string {
  const partes = [
    input.rua,
    input.numero ? String(input.numero) : null,
    input.bairro,
    input.cidade ?? 'Cuiabá',
    input.estado ?? 'Mato Grosso',
    'Brasil',
  ].filter(Boolean) as string[]
  return partes.join(', ')
}

export async function geocodificar(input: GeocodeInput): Promise<GeocodeResult | null> {
  const q = montarQuery(input)
  if (!q.trim()) return null

  const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'pt-BR',
      },
    })
    if (!res.ok) {
      console.error('[geocoding] HTTP', res.status, await res.text().catch(() => ''))
      return null
    }
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (!data.length) return null
    const lat = parseFloat(data[0].lat)
    const lng = parseFloat(data[0].lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  } catch (err) {
    console.error('[geocoding] erro:', err)
    return null
  }
}
