import { createAdminClient } from '@/lib/supabase/admin'
import { EntrarForm } from './_components/entrar-form'

export default async function EntrarPage() {
  let logoUrl = '/logo.png'
  try {
    const supabase = createAdminClient()
    const { data } = await supabase.from('site_config').select('valor').eq('chave', 'logo_url').single()
    if (data?.valor) logoUrl = data.valor.split('?')[0]
  } catch {}

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
      <EntrarForm logoUrl={logoUrl} />
    </main>
  )
}
