import { createAdminClient } from '@/lib/supabase/admin'
import { cartaoLinkImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og/cartao-link'

export const alt = 'Análise de seguro fiança'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/**
 * Aqui o link vai pro pretendente ANTES de a gente ter os dados dele — não há
 * nome pra mostrar. O destaque fica no que ele precisa fazer.
 */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let detalhe = ''
  let emitente = 'AluguelCuiabá'

  try {
    const admin = createAdminClient()
    const { data: link } = await admin
      .from('seguro_analise_links')
      .select('user_id, titulo, imovel:imoveis(endereco_resumido)')
      .eq('token', token)
      .maybeSingle()

    if (link) {
      const imovel = (Array.isArray(link.imovel) ? link.imovel[0] : link.imovel) as { endereco_resumido: string | null } | null
      detalhe = imovel?.endereco_resumido || link.titulo || ''
      const { data: perfil } = await admin
        .from('perfis').select('razao_social, nome').eq('id', link.user_id).maybeSingle()
      emitente = perfil?.razao_social || perfil?.nome || emitente
    }
  } catch {
    // Token inválido ou banco fora: versão genérica.
  }

  return cartaoLinkImage({
    rotulo: 'ANÁLISE DE SEGURO FIANÇA',
    destaque: 'Preencha seus dados',
    linha: 'para a seguradora analisar sua locação.',
    detalhe: detalhe || undefined,
    acao: 'Toque para preencher',
    emitente,
  })
}
