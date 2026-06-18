import type { createAdminClient } from '@/lib/supabase/admin'

// Subconjunto do ReciboData referente ao EMITENTE (corretor/imobiliária).
// Compartilhado entre o recibo mensal e o recibo consolidado (pagamento à vista).
export interface DadosEmitenteRecibo {
  emitente_nome: string
  emitente_cpf_cnpj: string | null
  emitente_endereco: string | null
  emitente_telefone: string | null
  cidade: string
  logo_url: string | null
  assinatura_url: string | null
  assinatura_nome: string | null
  mostrar_linha_assinatura: boolean
  assinatura_sobre_linha: boolean
}

type PerfilRow = {
  nome?: string | null; cpf?: string | null; telefone?: string | null
  endereco_logradouro?: string | null; endereco_numero?: string | null
  endereco_bairro?: string | null; endereco_cidade?: string | null
  endereco_estado?: string | null; endereco_uf?: string | null
  recibo_logo_url?: string | null; recibo_emitente_nome?: string | null
  recibo_assinatura_url?: string | null
  recibo_mostrar_linha?: boolean | null
  recibo_assinatura_sobre_linha?: boolean | null
}

// Remove cache-buster (?v=...) — confunde o @react-pdf/renderer em alguns casos.
function limparUrl(u: string | null | undefined): string | null {
  if (!u) return null
  const idx = u.indexOf('?')
  return idx === -1 ? u : u.slice(0, idx)
}

export async function montarEmitenteRecibo(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  userEmail: string | null,
): Promise<DadosEmitenteRecibo> {
  // Garante a row em perfis (cobre user criado via SQL sem trigger).
  const fallbackNome = (userEmail?.split('@')[0] ?? 'Usuário').slice(0, 100)
  await admin
    .from('perfis')
    .upsert(
      { id: userId, nome: fallbackNome, tipo: 'proprietario', plano: 'free' },
      { onConflict: 'id', ignoreDuplicates: true },
    )

  const { data: perfilRaw } = await admin.from('perfis').select('*').eq('id', userId).maybeSingle()
  const perfil = perfilRaw as PerfilRow | null
  const ufPerfil = perfil?.endereco_estado ?? perfil?.endereco_uf ?? null

  const { data: configs } = await admin
    .from('site_config')
    .select('chave, valor')
    .in('chave', ['logo_url'])
  const logoUrl = perfil?.recibo_logo_url
    ?? configs?.find(c => c.chave === 'logo_url')?.valor
    ?? null

  const endereco = [
    perfil?.endereco_logradouro && perfil.endereco_numero
      ? `${perfil.endereco_logradouro}, ${perfil.endereco_numero}` : perfil?.endereco_logradouro,
    perfil?.endereco_bairro,
    perfil?.endereco_cidade && ufPerfil
      ? `${perfil.endereco_cidade}/${ufPerfil}` : perfil?.endereco_cidade,
  ].filter(Boolean).join(' - ')

  const nomeHeader = perfil?.recibo_emitente_nome?.trim() || perfil?.nome?.trim() || 'AluguelCuiabá'

  return {
    emitente_nome: nomeHeader,
    emitente_cpf_cnpj: perfil?.cpf ?? null,
    emitente_endereco: endereco || null,
    emitente_telefone: perfil?.telefone ?? null,
    cidade: perfil?.endereco_cidade ?? 'Cuiabá',
    logo_url: limparUrl(logoUrl),
    assinatura_url: limparUrl(perfil?.recibo_assinatura_url),
    assinatura_nome: perfil?.recibo_emitente_nome ?? null,
    mostrar_linha_assinatura: perfil?.recibo_mostrar_linha ?? true,
    assinatura_sobre_linha: perfil?.recibo_assinatura_sobre_linha ?? true,
  }
}
