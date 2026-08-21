import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { assinarUrlSelfie } from '@/lib/storage/selfies'

/**
 * Carrega os processos de assinatura de um contrato PRA EXIBIR NO PAINEL,
 * já com a trilha de auditoria de quem assinou (data/hora, IP, localização,
 * dispositivo, OTP) e a selfie resolvida em URL assinada.
 *
 * A selfie mora em bucket privado (v82), então precisa do service-role pra
 * assinar a URL — por isso o admin client aqui. O filtro por userId é o que
 * garante o isolamento: quem chama já passou por exigirAcessoCRM().
 */

export interface SignatarioPainel {
  id: string
  nome: string
  email: string
  papel: string | null
  status: string
  token: string
  assinado_em: string | null
  ip: string | null
  geo: string | null
  user_agent: string | null
  otp_verificado: boolean
  selfie_url: string | null
}

export interface ProcessoPainel {
  id: string
  status: string
  created_at: string
  signatarios: SignatarioPainel[]
}

interface SigRow {
  id: string
  nome: string
  email: string
  papel: string | null
  status: string
  token: string
  ordem: number | null
  assinado_em: string | null
  ip: string | null
  geo: string | null
  user_agent: string | null
  otp_verificado_em: string | null
  selfie_path: string | null
  selfie_b64: string | null
}

export async function carregarProcessosAssinatura(
  userId: string,
  tipoContrato: 'locacao' | 'administracao',
  contratoId: string,
): Promise<ProcessoPainel[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('contrato_assinaturas')
    .select(
      'id, status, created_at, signatarios:contrato_assinatura_signatarios(' +
      'id, nome, email, papel, status, token, ordem, assinado_em, ip, geo, user_agent, otp_verificado_em, selfie_path, selfie_b64)',
    )
    .eq('user_id', userId)
    .eq('tipo_contrato', tipoContrato)
    .eq('contrato_id', contratoId)
    .order('created_at', { ascending: false })

  const processos = (data ?? []) as unknown as Array<{
    id: string; status: string; created_at: string; signatarios: SigRow[] | null
  }>

  return Promise.all(
    processos.map(async p => ({
      id: p.id,
      status: p.status,
      created_at: p.created_at,
      signatarios: await Promise.all(
        [...(p.signatarios ?? [])]
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
          .map(async s => ({
            id: s.id,
            nome: s.nome,
            email: s.email,
            papel: s.papel,
            status: s.status,
            token: s.token,
            assinado_em: s.assinado_em,
            ip: s.ip,
            geo: s.geo,
            user_agent: s.user_agent,
            otp_verificado: !!s.otp_verificado_em,
            // URL curta só pro render do painel; base64 é fallback pré-v82.
            selfie_url: (await assinarUrlSelfie(admin, s.selfie_path, 900)) ?? s.selfie_b64 ?? null,
          })),
      ),
    })),
  )
}
