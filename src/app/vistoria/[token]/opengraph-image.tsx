import { createAdminClient } from '@/lib/supabase/admin'
import { cartaoLinkImage, nomeCurto, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og/cartao-link'

export const alt = 'Vistoria do imóvel'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let inquilino = ''
  let detalhe = ''
  let tipo = ''
  let emitente = 'AluguelCuiabá'

  try {
    const admin = createAdminClient()
    const { data: vistoria } = await admin
      .from('vistorias')
      .select('user_id, contrato_id, tipo')
      .eq('token', token)
      .maybeSingle()

    if (vistoria) {
      tipo = vistoria.tipo === 'saida' ? 'saída' : 'entrada'
      const [{ data: perfil }, { data: contrato }] = await Promise.all([
        admin.from('perfis').select('razao_social, nome').eq('id', vistoria.user_id).maybeSingle(),
        admin.from('contratos_locacao')
          .select('codigo, inquilino:pessoas!inquilino_id(nome), imovel:imoveis(endereco_resumido)')
          .eq('id', vistoria.contrato_id).maybeSingle(),
      ])
      emitente = perfil?.razao_social || perfil?.nome || emitente
      if (contrato) {
        const pessoa = (Array.isArray(contrato.inquilino) ? contrato.inquilino[0] : contrato.inquilino) as { nome: string } | null
        const imovel = (Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel) as { endereco_resumido: string | null } | null
        inquilino = nomeCurto(pessoa?.nome)
        detalhe = imovel?.endereco_resumido ?? contrato.codigo ?? ''
      }
    }
  } catch {
    // Token inválido ou banco fora: versão genérica.
  }

  return cartaoLinkImage({
    rotulo: tipo ? `VISTORIA DE ${tipo.toUpperCase()}` : 'VISTORIA DO IMÓVEL',
    destaque: inquilino ? `${inquilino},` : 'Vistoria do imóvel',
    linha: 'confira o estado do imóvel e assine.',
    detalhe: detalhe || undefined,
    acao: 'Toque para conferir',
    emitente,
  })
}
