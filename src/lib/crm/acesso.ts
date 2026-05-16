import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export interface AcessoCRM {
  userId: string
  email: string
  plano: 'free' | 'basico' | 'profissional' | string
  role: string | null
  crmAtivo: boolean
  liberado: boolean
}

/**
 * Verifica se o usuário pode acessar o CRM.
 * Regra: admin sempre passa. Caso contrário, precisa de plano básico/profissional
 * OU ter a flag crm_ativo (cortesia / beta).
 */
export async function checarAcessoCRM(): Promise<AcessoCRM | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: perfil } = await supabase
    .from('perfis')
    .select('plano, role, crm_ativo')
    .eq('id', user.id)
    .single()

  const plano = perfil?.plano ?? 'free'
  const role = perfil?.role ?? null
  const crmAtivo = !!perfil?.crm_ativo

  const liberado =
    role === 'admin' ||
    crmAtivo ||
    plano === 'basico' ||
    plano === 'profissional'

  return {
    userId: user.id,
    email: user.email ?? '',
    plano,
    role,
    crmAtivo,
    liberado,
  }
}

/**
 * Para usar no topo das pages do CRM. Redireciona se não tiver acesso.
 */
export async function exigirAcessoCRM(): Promise<AcessoCRM> {
  const acesso = await checarAcessoCRM()
  if (!acesso) redirect('/entrar?next=/painel/contratos')
  if (!acesso.liberado) redirect('/painel?upgrade=crm')
  return acesso
}
