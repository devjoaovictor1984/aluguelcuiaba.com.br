import { createAdminClient } from '@/lib/supabase/admin'
import { cartaoLinkImage, nomeCurto, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og/cartao-link'

export const alt = 'Contrato para assinatura eletrônica'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/**
 * Prévia do link de assinatura no WhatsApp.
 *
 * O nome sai na imagem de propósito: quem recebe o link já é a pessoa em
 * questão, e ver o próprio nome é justamente o que dá confiança de que o
 * link é legítimo.
 */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let nome = ''
  let papel = ''
  let titulo = ''
  let emitente = 'AluguelCuiabá'

  try {
    const admin = createAdminClient()
    const { data: sig } = await admin
      .from('contrato_assinatura_signatarios')
      .select('nome, papel, assinatura:contrato_assinaturas!inner(titulo, user_id)')
      .eq('token', token)
      .maybeSingle()

    if (sig) {
      const proc = (Array.isArray(sig.assinatura) ? sig.assinatura[0] : sig.assinatura) as
        { titulo: string | null; user_id: string } | undefined
      nome = nomeCurto(sig.nome)
      papel = sig.papel ?? ''
      titulo = proc?.titulo ?? ''
      if (proc?.user_id) {
        const { data: perfil } = await admin
          .from('perfis').select('razao_social, nome').eq('id', proc.user_id).maybeSingle()
        emitente = perfil?.razao_social || perfil?.nome || emitente
      }
    }
  } catch {
    // Token inválido ou banco fora: cai na versão genérica, sem vazar nada.
  }

  return cartaoLinkImage({
    rotulo: 'ASSINATURA ELETRÔNICA DE CONTRATO',
    destaque: nome ? `${nome},` : 'Contrato para assinar',
    linha: nome ? 'seu contrato está pronto para assinatura.' : 'toque para conferir e assinar.',
    detalhe: [titulo, papel].filter(Boolean).join('  ·  ') || undefined,
    acao: 'Toque para assinar',
    emitente,
  })
}
