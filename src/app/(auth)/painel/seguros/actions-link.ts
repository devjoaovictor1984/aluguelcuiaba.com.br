'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoSeguros } from '@/lib/seguros/acesso'
import { verificarPerfilParaSeguros } from '@/lib/seguros/imobiliaria'

/**
 * Links de análise — o corretor manda pro pretenso inquilino preencher.
 *
 * A geração de link é NOSSA: a API da corretora não expõe esse recurso
 * (existe só no painel deles). Ganhamos com isso — o inquilino vê a marca
 * do corretor e o cadastro nasce em `pessoas`.
 */

function gerarToken(): string {
  return randomBytes(24).toString('base64url')
}

export interface CriarLinkInput {
  imovelId?: string | null
  contratoId?: string | null
  pessoaId?: string | null
  titulo?: string | null
  mensagem?: string | null
  tipoAnalise: 'reduzida' | 'completa'
  diasValidade?: number
  dadosImovel: {
    cep: string
    endereco?: string | null
    aluguel: number
    condominio?: number | null
    iptu?: number | null
    // Compõem o valor coberto: sem eles a seguradora aprova um limite
    // que não cobre a obrigação real do inquilino.
    agua?: number | null
    energia?: number | null
    gas?: number | null
    finalidade: 'R' | 'C'
    tipo?: string | null
    periodoContratoMeses: number
    pinturaNova: boolean
  }
}

export async function criarLinkAnalise(input: CriarLinkInput) {
  const acesso = await exigirAcessoSeguros()
  const admin = createAdminClient()

  // Falha cedo: sem perfil completo a análise não transmite depois, e o
  // inquilino teria preenchido à toa.
  const perfil = await verificarPerfilParaSeguros(admin, acesso.userId)
  if (!perfil.pronto) {
    return { error: `Complete seu perfil antes: falta ${perfil.faltando?.join(', ')}.` }
  }

  if (!input.dadosImovel.cep?.replace(/\D/g, '')) return { error: 'Informe o CEP do imóvel.' }
  if (!(input.dadosImovel.aluguel > 0)) return { error: 'Informe o valor do aluguel.' }

  // Locação comercial exige CNAE, capitais, ramo e tipo de empresa — dados
  // do pretendente PJ, que o corretor levanta na negociação. Pedir isso num
  // formulário de celular sem login é garantir abandono.
  if (input.dadosImovel.finalidade === 'C') {
    return { error: 'Locação comercial precisa da cotação direta — o formulário de link não coleta os dados da empresa.' }
  }

  const dias = Math.max(1, Math.min(30, input.diasValidade ?? 7))
  const token = gerarToken()

  const { data, error } = await admin
    .from('seguro_analise_links')
    .insert({
      user_id: acesso.userId,
      produto: 'fianca',
      token,
      imovel_id: input.imovelId ?? null,
      contrato_id: input.contratoId ?? null,
      pessoa_id: input.pessoaId ?? null,
      dados_imovel: input.dadosImovel,
      tipo_analise: input.tipoAnalise,
      titulo: input.titulo?.trim() || null,
      mensagem: input.mensagem?.trim() || null,
      expira_em: new Date(Date.now() + dias * 86400000).toISOString(),
    })
    .select('id, token, expira_em')
    .single()

  if (error || !data) return { error: error?.message ?? 'Falha ao gerar link.' }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  revalidatePath('/painel/seguros/fianca/links')
  return {
    ok: true,
    id: data.id,
    url: `${baseUrl}/seguro-fianca/${data.token}`,
    expiraEm: data.expira_em,
  }
}

export async function revogarLinkAnalise(linkId: string) {
  const acesso = await exigirAcessoSeguros()
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('seguro_analise_links')
    .select('id, preenchido_em')
    .eq('id', linkId)
    .eq('user_id', acesso.userId)
    .maybeSingle()

  if (!link) return { error: 'Link não encontrado.' }
  if (link.preenchido_em) return { error: 'Este link já foi preenchido.' }

  const { error } = await admin
    .from('seguro_analise_links')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', linkId)
  if (error) return { error: error.message }

  revalidatePath('/painel/seguros/fianca/links')
  return { ok: true }
}

export async function excluirLinkAnalise(linkId: string) {
  const acesso = await exigirAcessoSeguros()
  const admin = createAdminClient()

  const { error } = await admin
    .from('seguro_analise_links')
    .delete()
    .eq('id', linkId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath('/painel/seguros/fianca/links')
  return { ok: true }
}
