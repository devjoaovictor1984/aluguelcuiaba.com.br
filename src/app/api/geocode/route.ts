import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { geocodificar } from '@/lib/geocoding'
import { limitePorIp } from '@/lib/rate-limit'

// POST /api/geocode  { imovel_id: string }
// Lê o endereço do imóvel, geocoda via Nominatim e salva lat/lng.
// Chamado pelo form ao criar/editar um anúncio (fire-and-forget).
export async function POST(request: NextRequest) {
  try {
    // Auth: só usuário logado (a rota grava via service-role e bate no Nominatim).
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Rate limit: protege o Nominatim de abuso (e nosso IP de bloqueio).
    if (!await limitePorIp('geocode', 30, 60)) {
      return NextResponse.json({ ok: false, error: 'Muitas requisições. Tente em instantes.' }, { status: 429 })
    }

    const { imovel_id } = await request.json()
    if (!imovel_id) return NextResponse.json({ ok: false, error: 'imovel_id obrigatório' }, { status: 400 })

    const admin = createAdminClient()

    const { data: imovel } = await admin
      .from('imoveis')
      .select('id, user_id, endereco_resumido, bairro:bairros(id, nome, lat, lng)')
      .eq('id', imovel_id)
      .single()

    if (!imovel) return NextResponse.json({ ok: false, error: 'Imóvel não encontrado' }, { status: 404 })

    // Ownership: só o dono do imóvel (ou admin) pode disparar o geocode dele.
    if (imovel.user_id !== user.id) {
      const { data: perfil } = await supabase.from('perfis').select('role').eq('id', user.id).single()
      if (perfil?.role !== 'admin') {
        return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
      }
    }

    // endereco_resumido = "Rua X, 123, Apto 4"  → pegamos só rua+numero
    const partes = ((imovel.endereco_resumido ?? '') as string).split(',').map((s: string) => s.trim()).filter(Boolean)
    const rua = partes[0] ?? null
    const numero = partes[1] ?? null
    const bairroRaw = Array.isArray(imovel.bairro) ? imovel.bairro[0] : imovel.bairro
    const bairro = bairroRaw as { id?: string; nome?: string; lat?: number | null; lng?: number | null } | null

    // 1ª tentativa: endereço completo
    let result = rua ? await geocodificar({ rua, numero, bairro: bairro?.nome }) : null

    // 2ª tentativa: fallback para coordenadas do bairro
    let fonte: 'endereco' | 'bairro' = 'endereco'
    if (!result && bairro?.lat != null && bairro?.lng != null) {
      result = { lat: bairro.lat, lng: bairro.lng }
      fonte = 'bairro'
    }

    // 3ª tentativa: geocodar o bairro agora (caso ainda não tenha coords)
    if (!result && bairro?.nome && bairro.id) {
      const bairroGeo = await geocodificar({ bairro: bairro.nome })
      if (bairroGeo) {
        await admin.from('bairros').update({ lat: bairroGeo.lat, lng: bairroGeo.lng }).eq('id', bairro.id)
        result = bairroGeo
        fonte = 'bairro'
      }
    }

    if (!result) return NextResponse.json({ ok: false, error: 'Endereço não encontrado' }, { status: 200 })

    await admin.from('imoveis').update({ lat: result.lat, lng: result.lng }).eq('id', imovel_id)

    return NextResponse.json({ ok: true, lat: result.lat, lng: result.lng, fonte })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[api/geocode]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
