'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { situacaoAssinaturaAditivo, msgAditivoTravado } from '@/lib/crm/assinatura-lock'
import { lerClausulas, type ClausulaAditivo } from '@/lib/crm/aditivo-clausulas'

export type TipoAditivo = 'reajuste' | 'prorrogacao' | 'garantia' | 'valor' | 'clausula' | 'outro'

export interface AditivoInput {
  contrato_id: string
  tipo: TipoAditivo
  titulo?: string | null
  data_aditivo: string  // YYYY-MM-DD
  objeto: string
  /** Até 2 IDs em pessoas. Aparecem com nome e CPF na folha de assinatura. */
  testemunha_ids?: string[]
  /** Como citar o contrato originário. Vazio = regra automática (contrato-originario.ts). */
  contrato_originario_ref?: string | null
  /** Cláusulas da 2ª em diante. null = texto padrão (aditivo-clausulas.ts). */
  clausulas?: ClausulaAditivo[] | null
  /** Fechamento antes da data. null = padrão. */
  fechamento?: string | null
}

function validar(input: AditivoInput): string | null {
  if (!input.objeto?.trim()) return 'Descreva o que está sendo aditado.'
  if (!input.data_aditivo) return 'Informe a data do aditivo.'
  if ((input.testemunha_ids?.length ?? 0) > 2) return 'Máximo 2 testemunhas.'
  return null
}

export async function criarAditivo(input: AditivoInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const invalido = validar(input)
  if (invalido) return { error: invalido }

  // Confirma posse do contrato
  const { data: contrato } = await supabase
    .from('contratos_locacao')
    .select('id')
    .eq('id', input.contrato_id)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!contrato) return { error: 'Contrato não encontrado.' }

  // Próximo número (1º, 2º…) — conta os aditivos já existentes
  const { count } = await supabase
    .from('contratos_aditivos')
    .select('id', { count: 'exact', head: true })
    .eq('contrato_id', input.contrato_id)

  const { data: novo, error } = await supabase
    .from('contratos_aditivos')
    .insert({
      contrato_id: input.contrato_id,
      user_id: acesso.userId,
      numero: (count ?? 0) + 1,
      tipo: input.tipo,
      titulo: input.titulo?.trim() || null,
      data_aditivo: input.data_aditivo,
      objeto: input.objeto.trim(),
      testemunha_ids: input.testemunha_ids ?? [],
      contrato_originario_ref: input.contrato_originario_ref?.trim() || null,
      clausulas: lerClausulas(input.clausulas),
      fechamento: input.fechamento?.trim() || null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${input.contrato_id}`)
  return { ok: true, id: novo.id }
}

/**
 * Edita um aditivo já criado — inclusive o que o reajuste gera sozinho.
 *
 * O aditivo de locação não passa pela assinatura eletrônica: é impresso e
 * assinado. Então não há trava — o que vale é o PDF que as partes assinarem.
 * O número (1º, 2º…) não muda: é a ordem dos aditivos do contrato.
 */
export async function atualizarAditivo(id: string, input: AditivoInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const invalido = validar(input)
  if (invalido) return { error: invalido }

  const situacao = await situacaoAssinaturaAditivo(supabase, 'aditivo_locacao', id)
  if (situacao) return { error: msgAditivoTravado(situacao) }

  const { data, error } = await supabase
    .from('contratos_aditivos')
    .update({
      tipo: input.tipo,
      titulo: input.titulo?.trim() || null,
      data_aditivo: input.data_aditivo,
      objeto: input.objeto.trim(),
      testemunha_ids: input.testemunha_ids ?? [],
      contrato_originario_ref: input.contrato_originario_ref?.trim() || null,
      clausulas: lerClausulas(input.clausulas),
      fechamento: input.fechamento?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('contrato_id', input.contrato_id)
    .eq('user_id', acesso.userId)
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Aditivo não encontrado.' }

  revalidatePath(`/painel/contratos/${input.contrato_id}`)
  return { ok: true, id: data.id }
}

export async function excluirAditivo(id: string, contratoId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const situacao = await situacaoAssinaturaAditivo(supabase, 'aditivo_locacao', id)
  if (situacao) return { error: msgAditivoTravado(situacao) }
  const { error } = await supabase
    .from('contratos_aditivos')
    .delete()
    .eq('id', id)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${contratoId}`)
  return { ok: true }
}
