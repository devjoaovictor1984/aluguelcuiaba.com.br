import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { geocodificar } from '@/lib/geocoding'

// POST — geocoda todos os bairros sem lat/lng. Restrito a admin.
// Como são poucos (~70 em Cuiabá), processa tudo numa única chamada
// respeitando o rate limit de 1 req/seg do Nominatim.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: perfil } = await admin.from('perfis').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { data: bairros } = await admin
    .from('bairros')
    .select('id, nome')
    .or('lat.is.null,lng.is.null')

  if (!bairros?.length) return NextResponse.json({ ok: true, processados: 0, encontrados: 0 })

  let encontrados = 0
  const erros: string[] = []

  for (const b of bairros) {
    const r = await geocodificar({ bairro: b.nome })
    if (r) {
      await admin.from('bairros').update({ lat: r.lat, lng: r.lng }).eq('id', b.id)
      encontrados++
    } else {
      erros.push(b.nome)
    }
    // Rate limit Nominatim: 1 req/seg
    await new Promise(r => setTimeout(r, 1100))
  }

  return NextResponse.json({ ok: true, processados: bairros.length, encontrados, erros })
}
