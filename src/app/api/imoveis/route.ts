import { NextRequest, NextResponse } from 'next/server'
import { getImoveis } from '@/lib/supabase/queries'
import type { FiltrosBusca, TipoImovel, TipoUsuario, OrdenarPor } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const p = Object.fromEntries(request.nextUrl.searchParams)

    const filtros: FiltrosBusca = {
      tipo: (p.tipo as TipoImovel) || undefined,
      bairro_slug: p.bairro_slug || undefined,
      preco_min: p.preco_min ? Number(p.preco_min) : undefined,
      preco_max: p.preco_max ? Number(p.preco_max) : undefined,
      quartos_min: p.quartos_min ? Number(p.quartos_min) : undefined,
      aceita_pets: p.aceita_pets === 'true' ? true : undefined,
      mobiliado: p.mobiliado === 'true' ? true : undefined,
      taxa_condo_min: p.taxa_condo_min ? Number(p.taxa_condo_min) : undefined,
      taxa_condo_max: p.taxa_condo_max ? Number(p.taxa_condo_max) : undefined,
      iptu_min: p.iptu_min ? Number(p.iptu_min) : undefined,
      iptu_max: p.iptu_max ? Number(p.iptu_max) : undefined,
      tipo_anunciante: (p.tipo_anunciante as TipoUsuario) || undefined,
      ordenar: (p.ordenar as OrdenarPor) || undefined,
    }

    const pagina = p.pagina ? Number(p.pagina) : 1
    const { data, count, error } = await getImoveis(filtros, pagina, 24)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data, count })
  } catch (err) {
    console.error('[api/imoveis]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
