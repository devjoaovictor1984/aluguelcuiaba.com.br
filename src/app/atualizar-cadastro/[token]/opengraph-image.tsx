import { createAdminClient } from '@/lib/supabase/admin'
import { cartaoLinkImage, nomeCurto, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og/cartao-link'
import { resumirTiposDoc } from '@/lib/crm/tipos-documento'

export const alt = 'Atualização de cadastro'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/**
 * Prévia do link de atualização de cadastro no WhatsApp.
 *
 * O nome sai na imagem de propósito, como no link de assinatura: quem recebe
 * já é a pessoa em questão, e ver o próprio nome junto do nome da
 * administradora é o que separa isto de um golpe pedindo documento.
 *
 * Os tipos de documento também saem, a pedido: a pessoa já vê pela prévia o
 * que vai precisar separar antes de abrir o link. São só os tipos ("RG",
 * "Comprovante de renda"), nunca conteúdo de documento.
 */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let nome = ''
  let detalhe = ''
  let emitente = 'AluguelCuiabá'

  try {
    const admin = createAdminClient()
    const { data: sol } = await admin
      .from('solicitacoes_cadastro')
      .select('user_id, pessoa_id, campos, tipos_documento')
      .eq('token', token)
      .maybeSingle()

    if (sol) {
      const [{ data: perfil }, { data: pessoa }] = await Promise.all([
        admin.from('perfis').select('razao_social, nome').eq('id', sol.user_id).maybeSingle(),
        admin.from('pessoas').select('nome').eq('id', sol.pessoa_id).maybeSingle(),
      ])
      emitente = perfil?.razao_social || perfil?.nome || emitente
      nome = nomeCurto(pessoa?.nome)

      // Cabe uma linha só no cartão: os tipos de documento mandam, porque
      // são o que dá trabalho separar. Sem documento pedido, mostra quantos
      // dados são.
      const docs = resumirTiposDoc((sol.tipos_documento as string[] | null) ?? [])
      const qtdCampos = ((sol.campos as string[] | null) ?? []).length
      detalhe = docs || (qtdCampos > 0
        ? `${qtdCampos} ${qtdCampos === 1 ? 'informação' : 'informações'}`
        : '')
    }
  } catch {
    // Token inválido ou banco fora: cai na versão genérica, sem vazar nada.
  }

  return cartaoLinkImage({
    rotulo: 'ATUALIZAÇÃO DE CADASTRO',
    destaque: nome ? `${nome},` : 'Atualize seu cadastro',
    linha: nome ? 'faltam alguns dados no seu cadastro.' : 'toque para completar seus dados.',
    detalhe: detalhe || undefined,
    acao: 'Toque para atualizar',
    emitente,
  })
}
