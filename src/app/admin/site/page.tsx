import { createAdminClient } from '@/lib/supabase/admin'
import { SiteForm } from './_components/site-form'

export default async function AdminSitePage() {
  const supabase = createAdminClient()
  const { data: configs } = await supabase.from('site_config').select('chave, valor')
  const cfg = Object.fromEntries((configs ?? []).map(c => [c.chave, c.valor ?? '']))
  return <SiteForm cfg={cfg} />
}
