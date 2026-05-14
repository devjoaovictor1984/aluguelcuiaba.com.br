import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — retorna os IDs de imóveis ativos sem lat/lng. Restrito a admin.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: perfil } = await admin.from('perfis').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { data } = await admin
    .from('imoveis')
    .select('id')
    .is('lat', null)
    .eq('status', 'ativo')
    .order('created_at', { ascending: true })

  return NextResponse.json({ ids: (data ?? []).map(r => r.id) })
}
