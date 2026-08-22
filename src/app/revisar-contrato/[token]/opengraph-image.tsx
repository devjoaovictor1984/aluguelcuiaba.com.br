import { createAdminClient } from '@/lib/supabase/admin'
import { cartaoLinkImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og/cartao-link'

export const alt = 'Contrato para revisão'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/**
 * O link de revisão é do CONTRATO, não de uma pessoa — a tabela não guarda
 * nome de destinatário. Então o destaque aqui é o documento.
 */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let titulo = ''
  let emitente = 'AluguelCuiabá'

  try {
    const admin = createAdminClient()
    const { data: link } = await admin
      .from('contrato_revisao_links')
      .select('titulo, user_id')
      .eq('token', token)
      .maybeSingle()

    if (link) {
      titulo = link.titulo ?? ''
      const { data: perfil } = await admin
        .from('perfis').select('razao_social, nome').eq('id', link.user_id).maybeSingle()
      emitente = perfil?.razao_social || perfil?.nome || emitente
    }
  } catch {
    // Token inválido ou banco fora: versão genérica.
  }

  return cartaoLinkImage({
    rotulo: 'REVISÃO DE CONTRATO',
    destaque: titulo ? `Contrato ${titulo}` : 'Contrato para revisar',
    linha: 'leia com atenção antes da assinatura.',
    detalhe: 'Você pode enviar suas considerações',
    acao: 'Toque para revisar',
    emitente,
  })
}
