import { createAdminClient } from '@/lib/supabase/admin'
import { cartaoLinkImage, nomeCurto, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og/cartao-link'

export const alt = 'Termo de entrega de chaves'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let inquilino = ''
  let detalhe = ''
  let emitente = 'AluguelCuiabá'

  try {
    const admin = createAdminClient()
    const { data: termo } = await admin
      .from('termos_entrega_chaves')
      .select('user_id, contrato_id')
      .eq('token', token)
      .maybeSingle()

    if (termo) {
      const [{ data: perfil }, { data: contrato }] = await Promise.all([
        admin.from('perfis').select('razao_social, nome').eq('id', termo.user_id).maybeSingle(),
        admin.from('contratos_locacao')
          .select('codigo, inquilino:pessoas!inquilino_id(nome), imovel:imoveis(endereco_resumido)')
          .eq('id', termo.contrato_id).maybeSingle(),
      ])
      emitente = perfil?.razao_social || perfil?.nome || emitente
      if (contrato) {
        const pessoa = (Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino) as { nome: string } | null
        const imovel = (Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel) as { endereco_resumido: string | null } | null
        inquilino = nomeCurto(pessoa?.nome)
        detalhe = [contrato.codigo, imovel?.endereco_resumido].filter(Boolean).join('  ·  ')
      }
    }
  } catch {
    // Token inválido ou banco fora: versão genérica.
  }

  return cartaoLinkImage({
    rotulo: 'TERMO DE ENTREGA DE CHAVES',
    destaque: inquilino ? `${inquilino},` : 'Entrega de chaves',
    linha: inquilino ? 'confira o termo e assine o recebimento.' : 'confira o termo e assine.',
    detalhe: detalhe || undefined,
    acao: 'Toque para assinar',
    emitente,
  })
}
