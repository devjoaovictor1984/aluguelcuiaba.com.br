'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { situacaoAssinaturaDocumento, msgDocumentoTravado } from '@/lib/crm/assinatura-lock'
import { lerClausulas, type ClausulaAditivo } from '@/lib/crm/aditivo-clausulas'
import type { MotivoDistrato } from '@/lib/crm/distrato-clausulas'

/**
 * Distrato do contrato de locação (v98).
 *
 * Mesmo desenho das actions do termo aditivo: o documento trava assim que
 * entra em assinatura, porque o texto que cada parte lê — e que o hash do
 * certificado prende — tem que ser o mesmo do primeiro ao último signatário.
 *
 * O distrato NÃO encerra o contrato sozinho. Encerrar baixa parcelas
 * futuras, libera o imóvel e mexe no financeiro; é a ação "Encerrar
 * contrato", que o corretor dispara quando a saída de fato acontece. Aqui
 * se produz o documento — as duas coisas costumam andar juntas, mas a
 * ordem varia (às vezes assina-se o distrato semanas antes da mudança).
 */

export interface DistratoInput {
  contrato_id: string
  data_distrato: string            // YYYY-MM-DD
  data_desocupacao?: string | null // YYYY-MM-DD
  motivo: MotivoDistrato
  titulo?: string | null
  objeto: string

  // Acerto de contas
  multa_valor?: number | null
  multa_dispensada?: boolean
  debitos_valor?: number | null
  caucao_devolver?: number | null
  acerto_observacao?: string | null
  quitacao_reciproca?: boolean

  /** Até 2 IDs em pessoas. Aparecem com nome, CPF e RG na folha de assinatura. */
  testemunha_ids?: string[]
  /** Como citar o contrato originário. Vazio = regra automática (contrato-originario.ts). */
  contrato_originario_ref?: string | null
  /** Cláusulas da 3ª em diante. null = texto padrão (distrato-clausulas.ts). */
  clausulas?: ClausulaAditivo[] | null
  /** Fechamento antes da data. null = padrão. */
  fechamento?: string | null
}

function validar(input: DistratoInput): string | null {
  if (!input.objeto?.trim()) return 'Descreva o que está sendo distratado.'
  if (!input.data_distrato) return 'Informe a data do distrato.'
  if ((input.testemunha_ids?.length ?? 0) > 2) return 'Máximo 2 testemunhas.'
  if (input.data_desocupacao && input.data_desocupacao < input.data_distrato.slice(0, 10)) {
    // Não é erro: acontece de o inquilino já ter saído e o documento só
    // formalizar depois. Só não deixa passar data claramente digitada errada.
    const anos = (new Date(input.data_distrato).getTime() - new Date(input.data_desocupacao).getTime()) / 31536000000
    if (anos > 5) return 'A data de desocupação está muito distante da data do distrato — confira.'
  }
  return null
}

/** Campos que valem tanto pra criar quanto pra editar. */
function payloadDe(input: DistratoInput) {
  const naoNegativo = (v: number | null | undefined) =>
    typeof v === 'number' && isFinite(v) && v > 0 ? v : null
  return {
    data_distrato: input.data_distrato,
    data_desocupacao: input.data_desocupacao || null,
    motivo: input.motivo,
    titulo: input.titulo?.trim() || null,
    objeto: input.objeto.trim(),
    multa_valor: naoNegativo(input.multa_valor),
    multa_dispensada: input.multa_dispensada ?? false,
    debitos_valor: naoNegativo(input.debitos_valor),
    caucao_devolver: naoNegativo(input.caucao_devolver),
    acerto_observacao: input.acerto_observacao?.trim() || null,
    quitacao_reciproca: input.quitacao_reciproca ?? true,
    testemunha_ids: input.testemunha_ids ?? [],
    contrato_originario_ref: input.contrato_originario_ref?.trim() || null,
    clausulas: lerClausulas(input.clausulas),
    fechamento: input.fechamento?.trim() || null,
  }
}

export async function criarDistrato(input: DistratoInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const invalido = validar(input)
  if (invalido) return { error: invalido }

  const { data: contrato } = await supabase
    .from('contratos_locacao')
    .select('id')
    .eq('id', input.contrato_id)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!contrato) return { error: 'Contrato não encontrado.' }

  const { data: novo, error } = await supabase
    .from('contratos_distratos')
    .insert({
      contrato_id: input.contrato_id,
      user_id: acesso.userId,
      ...payloadDe(input),
    })
    .select('id')
    .single()

  if (error) {
    // UNIQUE (contrato_id): o contrato se dissolve uma vez só.
    if (error.code === '23505') return { error: 'Este contrato já tem um distrato. Edite o que existe ou exclua antes de refazer.' }
    return { error: error.message }
  }

  revalidatePath(`/painel/contratos/${input.contrato_id}`)
  return { ok: true, id: novo.id }
}

export async function atualizarDistrato(id: string, input: DistratoInput) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const invalido = validar(input)
  if (invalido) return { error: invalido }

  const situacao = await situacaoAssinaturaDocumento(supabase, 'distrato_locacao', id)
  if (situacao) return { error: msgDocumentoTravado(situacao, 'distrato') }

  const { data, error } = await supabase
    .from('contratos_distratos')
    .update({ ...payloadDe(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('contrato_id', input.contrato_id)
    .eq('user_id', acesso.userId)
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Distrato não encontrado.' }

  revalidatePath(`/painel/contratos/${input.contrato_id}`)
  return { ok: true, id: data.id }
}

export async function excluirDistrato(id: string, contratoId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const situacao = await situacaoAssinaturaDocumento(supabase, 'distrato_locacao', id)
  if (situacao) return { error: msgDocumentoTravado(situacao, 'distrato') }

  const { error } = await supabase
    .from('contratos_distratos')
    .delete()
    .eq('id', id)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${contratoId}`)
  return { ok: true }
}
