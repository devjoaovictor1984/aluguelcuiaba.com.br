import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { assinarUrlSelfie } from '@/lib/storage/selfies'
import type { CertificadoData } from './certificado-assinatura-pdf'

type Admin = ReturnType<typeof createAdminClient>

export interface ProcessoCertificado {
  id: string
  user_id: string
  tipo_contrato: 'locacao' | 'administracao'
  titulo: string | null
  concluido_em: string | null
}

/**
 * Monta os dados do certificado de assinatura a partir do processo.
 *
 * Usado nos dois caminhos — o certificado definitivo anexado ao PDF final e
 * a prévia que o corretor abre com o processo em andamento — pra que a
 * trilha exibida seja sempre a mesma e não haja duas versões da verdade.
 *
 * Devolve também o token do primeiro signatário, que a rota do PDF final usa
 * pra buscar o contrato sem sessão.
 */
export async function montarCertificado(
  admin: Admin,
  proc: ProcessoCertificado,
  opts: { hash: string | null; parcial: boolean },
): Promise<{ cert: CertificadoData; tokenInterno: string | null }> {
  const { data: signatarios } = await admin
    .from('contrato_assinatura_signatarios')
    .select('nome, email, celular, papel, status, assinado_em, otp_verificado_em, ip, geo, user_agent, selfie_path, selfie_b64, assinatura_b64, token')
    .eq('assinatura_id', proc.id)
    .order('ordem', { ascending: true })

  const linhas = signatarios ?? []

  // Selfies vivem em bucket privado (v82) → URL assinada curta, só pro render.
  // Assinaturas anteriores à v82 têm a imagem em base64: usa como fallback.
  const selfiesUrl = await Promise.all(
    linhas.map(async s => (await assinarUrlSelfie(admin, s.selfie_path, 300)) ?? s.selfie_b64 ?? null),
  )

  const { data: perfil } = await admin
    .from('perfis').select('razao_social, nome').eq('id', proc.user_id).maybeSingle()

  const cert: CertificadoData = {
    titulo: proc.titulo ?? 'Contrato',
    tipo_contrato: proc.tipo_contrato,
    emitente_nome: perfil?.razao_social || perfil?.nome || 'AluguelCuiabá',
    concluido_em: proc.concluido_em,
    hash: opts.hash,
    parcial: opts.parcial,
    signatarios: linhas.map((s, i) => ({
      nome: s.nome,
      email: s.email,
      celular: s.celular,
      papel: s.papel,
      assinado_em: s.assinado_em,
      otp_usado: !!s.otp_verificado_em,
      ip: s.ip,
      geo: s.geo,
      user_agent: s.user_agent,
      selfie_url: selfiesUrl[i],
      assinatura_b64: s.assinatura_b64,
      pendente: s.status !== 'assinado',
    })),
  }

  return { cert, tokenInterno: linhas[0]?.token ?? null }
}
