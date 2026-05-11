import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('site_config')
      .select('valor')
      .eq('chave', 'favicon_url')
      .single()
    const url = (data?.valor || '').split('?')[0]
    if (url) return NextResponse.redirect(url, { status: 302 })
  } catch {}
  return NextResponse.redirect(new URL('/favicon.ico', process.env.NEXT_PUBLIC_APP_URL || 'https://aluguelcuiaba.com.br'))
}
