'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

/**
 * Sinistro do seguro fiança (v102).
 *
 * O locatário parou de pagar, a seguradora assumiu. Da porta pra dentro
 * do CRM isso não é "parcela em aberto": o proprietário recebe e o
 * repasse acontece igual. O que muda é DE QUEM veio o dinheiro — e, por
 * consequência, que o recibo não sai em nome do locatário, porque ele
 * passou a dever à seguradora.
 *
 * Encerrar não desfaz nada do que já foi coberto: o que a seguradora
 * pagou continua sendo dela para cobrar. O encerramento só devolve as
 * PRÓXIMAS parcelas para o locatário.
 */

async function contratoDoUsuario(contratoId: string, userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('contratos_locacao')
    .select('id, status')
    .eq('id', contratoId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export interface AbrirSinistroInput {
  contrato_id: string
  seguradora?: string | null
  numero?: string | null
  aberto_em: string          // YYYY-MM-DD
  motivo?: string | null
  observacoes?: string | null
}

export async function abrirSinistro(input: AbrirSinistroInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const contrato = await contratoDoUsuario(input.contrato_id, acesso.userId)
  if (!contrato) return { error: 'Contrato não encontrado.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.aberto_em)) return { error: 'Informe a data de abertura.' }

  // O índice parcial já impede dois abertos, mas o erro do banco chega
  // como violação de unique — feio na tela e sem dizer o que houve.
  const { data: jaAberto } = await supabase
    .from('contrato_sinistros')
    .select('id')
    .eq('contrato_id', input.contrato_id)
    .eq('status', 'aberto')
    .maybeSingle()
  if (jaAberto) return { error: 'Este contrato já tem um sinistro aberto. Encerre o atual antes de abrir outro.' }

  const { data: sinistro, error } = await supabase
    .from('contrato_sinistros')
    .insert({
      contrato_id: input.contrato_id,
      user_id: acesso.userId,
      seguradora: input.seguradora?.trim() || null,
      numero: input.numero?.trim() || null,
      aberto_em: input.aberto_em,
      motivo: input.motivo?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Sinistro aberto é, por definição, inadimplência do locatário: o
  // contrato passa a 'inadimplente' pra aparecer assim em toda listagem.
  // Contrato já encerrado ou rescindido não volta atrás por causa disso.
  if (contrato.status === 'ativo') {
    await supabase
      .from('contratos_locacao')
      .update({ status: 'inadimplente', status_data: new Date().toISOString() })
      .eq('id', input.contrato_id)
      .eq('user_id', acesso.userId)
  }

  revalidatePath(`/painel/contratos/${input.contrato_id}`)
  revalidatePath('/painel/contratos')
  revalidatePath('/painel/financeiro')
  return { ok: true, id: sinistro.id }
}

export async function atualizarSinistro(
  sinistroId: string,
  dados: { seguradora?: string | null; numero?: string | null; observacoes?: string | null },
) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: sinistro } = await supabase
    .from('contrato_sinistros')
    .select('id, contrato_id')
    .eq('id', sinistroId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!sinistro) return { error: 'Sinistro não encontrado.' }

  const { error } = await supabase
    .from('contrato_sinistros')
    .update({
      seguradora: dados.seguradora?.trim() || null,
      numero: dados.numero?.trim() || null,
      observacoes: dados.observacoes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sinistroId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${sinistro.contrato_id}`)
  return { ok: true }
}

export interface EncerrarSinistroInput {
  sinistro_id: string
  encerrado_em: string       // YYYY-MM-DD
  motivo?: string | null
}

export async function encerrarSinistro(input: EncerrarSinistroInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.encerrado_em)) return { error: 'Informe a data de encerramento.' }

  const { data: sinistro } = await supabase
    .from('contrato_sinistros')
    .select('id, contrato_id, status, aberto_em')
    .eq('id', input.sinistro_id)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!sinistro) return { error: 'Sinistro não encontrado.' }
  if (sinistro.status === 'encerrado') return { error: 'Este sinistro já está encerrado.' }
  if (input.encerrado_em < sinistro.aberto_em) {
    return { error: 'A data de encerramento é anterior à de abertura.' }
  }

  const { error } = await supabase
    .from('contrato_sinistros')
    .update({
      status: 'encerrado',
      encerrado_em: input.encerrado_em,
      motivo: input.motivo?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.sinistro_id)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  // As parcelas já cobertas ficam como estão — a seguradora cobra do
  // locatário por fora. O contrato volta a 'ativo' porque, daqui pra
  // frente, quem paga é ele de novo.
  const { data: contrato } = await supabase
    .from('contratos_locacao')
    .select('status')
    .eq('id', sinistro.contrato_id)
    .eq('user_id', acesso.userId)
    .maybeSingle()

  if (contrato?.status === 'inadimplente') {
    await supabase
      .from('contratos_locacao')
      .update({ status: 'ativo', status_data: new Date().toISOString() })
      .eq('id', sinistro.contrato_id)
      .eq('user_id', acesso.userId)
  }

  revalidatePath(`/painel/contratos/${sinistro.contrato_id}`)
  revalidatePath('/painel/contratos')
  revalidatePath('/painel/financeiro')
  return { ok: true }
}

/**
 * Apaga o sinistro — para quando ele foi aberto por engano.
 *
 * As parcelas que apontavam pra ele continuam marcadas como pagas pela
 * seguradora (o sinistro_id vira NULL pelo ON DELETE SET NULL). Se a
 * ideia era desfazer a cobertura, é o pagamento de cada parcela que
 * precisa ser desfeito, um a um — apagar o episódio não devolve dinheiro
 * nenhum pra ninguém.
 */
export async function excluirSinistro(sinistroId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: sinistro } = await supabase
    .from('contrato_sinistros')
    .select('id, contrato_id')
    .eq('id', sinistroId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!sinistro) return { error: 'Sinistro não encontrado.' }

  const { error } = await supabase
    .from('contrato_sinistros')
    .delete()
    .eq('id', sinistroId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${sinistro.contrato_id}`)
  return { ok: true }
}
