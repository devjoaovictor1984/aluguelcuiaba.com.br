'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { garantirImobiliaria } from '@/lib/seguros/imobiliaria'
import { salvarArquivo, removerArquivosDaAnalise } from '@/lib/seguros/arquivos'
import {
  ambienteMaximiza, consultarAnalise, transmitirAnalise, transmitirReanalise,
} from '@/lib/seguros'
import type { AnaliseInput } from '@/lib/seguros/tipos'
import { gravarPareceres, resumirStatus } from '@/lib/seguros/pareceres'

/**
 * Ações do módulo de seguros.
 *
 * Toda chamada externa passa por `@/lib/seguros` — aqui só ficam posse,
 * validação e persistência.
 */

async function checarPosseAnalise(analiseId: string, userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('seguro_analises')
    .select('id, user_id, maximiza_id, status_resumo')
    .eq('id', analiseId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export interface NovaAnaliseInput {
  contratoId?: string | null
  imovelId?: string | null
  inquilinoId?: string | null
  seguradoras?: string[]
  consentimento: boolean
  dados: AnaliseInput
}

/**
 * Cria a análise e transmite pra corretora.
 *
 * Grava a linha ANTES de chamar a API: se a chamada falhar, o corretor vê
 * o erro no histórico em vez de a solicitação sumir sem rastro.
 */
export async function criarAnalise(input: NovaAnaliseInput) {
  const acesso = await exigirAcessoCRM()
  const admin = createAdminClient()

  if (!input.consentimento) {
    return { error: 'É preciso o aceite do inquilino pra enviar os dados à seguradora.' }
  }

  const prov = await garantirImobiliaria(admin, acesso.userId)
  if (prov.error || !prov.cnpjCpf) return { error: prov.error ?? 'Cadastro na corretora indisponível.' }

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0].trim() ?? hdrs.get('x-real-ip') ?? null
  const ambiente = ambienteMaximiza()

  const { data: analise, error: eIns } = await admin
    .from('seguro_analises')
    .insert({
      user_id: acesso.userId,
      produto: 'fianca',
      contrato_id: input.contratoId ?? null,
      imovel_id: input.imovelId ?? null,
      inquilino_id: input.inquilinoId ?? null,
      ambiente,
      tipo_analise: input.dados.tipoAnalise,
      finalidade: input.dados.imovel.finalidade,
      payload: input.dados as unknown as Record<string, unknown>,
      valor_aluguel: input.dados.imovel.aluguel,
      consentimento_em: new Date().toISOString(),
      consentimento_ip: ip,
      status_resumo: 'enviando',
    })
    .select('id')
    .single()

  if (eIns || !analise) return { error: eIns?.message ?? 'Falha ao criar análise.' }

  try {
    const r = await transmitirAnalise(admin, input.dados, {
      userId: acesso.userId,
      analiseId: analise.id,
      cnpjImobiliaria: prov.cnpjCpf,
    })

    await gravarPareceres(admin, analise.id, r.pareceres)
    await admin.from('seguro_analises').update({
      maximiza_id: r.idExterno || null,
      status_resumo: resumirStatus(r.pareceres),
      erro: null,
    }).eq('id', analise.id)

    revalidatePath('/painel/seguros/fianca')
    return { ok: true, id: analise.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao transmitir análise.'
    await admin.from('seguro_analises')
      .update({ status_resumo: 'erro', erro: msg })
      .eq('id', analise.id)
    revalidatePath('/painel/seguros/fianca')
    return { error: msg, id: analise.id }
  }
}

/**
 * Puxa o estado atual da corretora e atualiza pareceres e documentos.
 *
 * Também é o que roda depois de um webhook: como o webhook não é
 * autenticado, ele serve só de aviso e a verdade vem daqui.
 */
export async function sincronizarAnalise(analiseId: string) {
  const acesso = await exigirAcessoCRM()
  const admin = createAdminClient()

  const analise = await checarPosseAnalise(analiseId, acesso.userId)
  if (!analise) return { error: 'Análise não encontrada.' }
  if (!analise.maximiza_id) return { error: 'Esta análise ainda não foi transmitida.' }

  try {
    const { resultado, arquivos } = await consultarAnalise(admin, analise.maximiza_id, {
      userId: acesso.userId,
      analiseId,
    })

    await gravarPareceres(admin, analiseId, resultado.pareceres)

    for (const arq of arquivos) {
      await salvarArquivo(admin, arq, { userId: acesso.userId, analiseId })
    }

    await admin.from('seguro_analises')
      .update({ status_resumo: resumirStatus(resultado.pareceres), erro: null })
      .eq('id', analiseId)

    revalidatePath(`/painel/seguros/fianca/${analiseId}`)
    return { ok: true, pareceres: resultado.pareceres.length, arquivos: arquivos.length }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Falha ao consultar a corretora.' }
  }
}

/** Nova tentativa — recusa não é fim de linha. */
export async function reanalisar(analiseId: string, seguradoras: string[]) {
  const acesso = await exigirAcessoCRM()
  const admin = createAdminClient()

  const analise = await checarPosseAnalise(analiseId, acesso.userId)
  if (!analise) return { error: 'Análise não encontrada.' }
  if (!analise.maximiza_id) return { error: 'Esta análise ainda não foi transmitida.' }
  if (!seguradoras.length) return { error: 'Escolha ao menos uma seguradora.' }

  try {
    const r = await transmitirReanalise(admin, analise.maximiza_id, seguradoras, {
      userId: acesso.userId,
      analiseId,
    })
    await gravarPareceres(admin, analiseId, r.pareceres)
    await admin.from('seguro_analises')
      .update({ status_resumo: resumirStatus(r.pareceres), erro: null })
      .eq('id', analiseId)

    revalidatePath(`/painel/seguros/fianca/${analiseId}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Falha ao reanalisar.' }
  }
}

export async function excluirAnalise(analiseId: string) {
  const acesso = await exigirAcessoCRM()
  const admin = createAdminClient()

  const analise = await checarPosseAnalise(analiseId, acesso.userId)
  if (!analise) return { error: 'Análise não encontrada.' }

  await removerArquivosDaAnalise(admin, acesso.userId, analiseId)
  const { error } = await admin.from('seguro_analises').delete().eq('id', analiseId)
  if (error) return { error: error.message }

  revalidatePath('/painel/seguros/fianca')
  return { ok: true }
}
