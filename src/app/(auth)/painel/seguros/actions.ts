'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { mensagemDeErro } from '@/lib/seguros/erros'
import { seguradorasElegiveis, motivoDeNenhumaElegivel } from '@/lib/seguros/elegiveis'
import { exigirAcessoSeguros } from '@/lib/seguros/acesso'
import { garantirImobiliaria } from '@/lib/seguros/imobiliaria'
import { salvarArquivo, removerArquivosDaAnalise } from '@/lib/seguros/arquivos'
import {
  ambienteMaximiza, consultarAnalise, transmitirAnalise, transmitirReanalise,
} from '@/lib/seguros'
import type { AnaliseInput, TipoAnalise } from '@/lib/seguros/tipos'
import { gravarPareceres, resumirStatus } from '@/lib/seguros/pareceres'
import { lerEstadoAnterior, notificarMudancas } from '@/lib/seguros/notificar'
import { buscarCnae } from '@/lib/seguros/cnae'

/**
 * Ações do módulo de seguros.
 *
 * Toda chamada externa passa por `@/lib/seguros` — aqui só ficam posse,
 * validação e persistência.
 */

/**
 * Devolve a análise se for do usuário.
 *
 * Lança em erro de consulta em vez de devolver null: null aqui significa
 * "não é sua", e uma falha de banco não deve se passar por isso.
 */
async function checarPosseAnalise(analiseId: string, userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('seguro_analises')
    .select('id, user_id, maximiza_id, status_resumo, tipo_analise')
    .eq('id', analiseId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`Falha ao consultar a análise: ${error.message}`)
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
  const acesso = await exigirAcessoSeguros()
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
    // A lista NUNCA vai vazia: vazio significa "todas" pra API, e "todas"
    // inclui seguradora que não aceita este tipo de análise — o que volta
    // como 500 genérico e derruba as outras junto.
    const eleg = await seguradorasElegiveis(admin, {
      tipoAnalise: input.dados.tipoAnalise,
      cnpjImobiliaria: prov.cnpjCpf,
      escolhidas: input.seguradoras ?? input.dados.seguradoras,
      userId: acesso.userId,
    })
    if (!eleg.siglas.length) {
      throw new Error(motivoDeNenhumaElegivel(eleg, input.dados.tipoAnalise))
    }

    const dados = { ...input.dados, seguradoras: eleg.siglas }

    const r = await transmitirAnalise(admin, dados, {
      userId: acesso.userId,
      analiseId: analise.id,
      cnpjImobiliaria: prov.cnpjCpf,
    })

    await gravarPareceres(admin, analise.id, r.pareceres)
    await admin.from('seguro_analises').update({
      maximiza_id: r.idExterno || null,
      status_resumo: resumirStatus(r.pareceres),
      erro: null,
      // Guarda a lista resolvida: é ela que `incluirSolidarios` reenvia.
      payload: dados as unknown as Record<string, unknown>,
    }).eq('id', analise.id)

    revalidatePath('/painel/seguros/fianca')
    return { ok: true, id: analise.id }
  } catch (e) {
    const msg = mensagemDeErro(e, 'Falha ao transmitir análise.')
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
  const acesso = await exigirAcessoSeguros()
  const admin = createAdminClient()

  const analise = await checarPosseAnalise(analiseId, acesso.userId)
  if (!analise) return { error: 'Análise não encontrada.' }
  if (!analise.maximiza_id) return { error: 'Esta análise ainda não foi transmitida.' }

  const antes = await lerEstadoAnterior(admin, analiseId)

  try {
    const { resultado, arquivos } = await consultarAnalise(admin, analise.maximiza_id, {
      userId: acesso.userId,
      analiseId,
    })

    await gravarPareceres(admin, analiseId, resultado.pareceres)
    await notificarMudancas(admin, { userId: acesso.userId, analiseId }, antes, resultado.pareceres)

    for (const arq of arquivos) {
      await salvarArquivo(admin, arq, { userId: acesso.userId, analiseId })
    }

    await admin.from('seguro_analises')
      .update({ status_resumo: resumirStatus(resultado.pareceres), erro: null })
      .eq('id', analiseId)

    revalidatePath(`/painel/seguros/fianca/${analiseId}`)
    return { ok: true, pareceres: resultado.pareceres.length, arquivos: arquivos.length }
  } catch (e) {
    return { error: mensagemDeErro(e, 'Falha ao consultar a corretora.') }
  }
}

/**
 * Reenvia a análise com locatários solidários incluídos.
 *
 * Diferente de `reanalisar`: `transmitirReanalise` só aceita o código e as
 * seguradoras — não dá pra mudar dado nenhum por lá. Pra ALTERAR a
 * análise, a API manda usar `transmitirAnalise` com o campo `codigo`
 * preenchido ("Id da análise caso seja uma reanálise/alteração").
 *
 * É a saída da aprovação com limite inferior: a própria seguradora
 * responde que "será necessário incluir um locatário solidário".
 */
export async function incluirSolidarios(
  analiseId: string,
  solidarios: { nome: string; cpf: string; dataNascimento: string }[],
) {
  const acesso = await exigirAcessoSeguros()
  const admin = createAdminClient()

  const analise = await checarPosseAnalise(analiseId, acesso.userId)
  if (!analise) return { error: 'Análise não encontrada.' }
  if (!analise.maximiza_id) return { error: 'Esta análise ainda não foi transmitida.' }
  if (!solidarios.length) return { error: 'Inclua ao menos um locatário solidário.' }
  if (solidarios.length > 3) return { error: 'No máximo 3 locatários solidários.' }

  const { data: linha } = await admin
    .from('seguro_analises')
    .select('payload')
    .eq('id', analiseId)
    .maybeSingle()

  const anterior = (linha?.payload ?? {}) as unknown as AnaliseInput
  if (!anterior?.pretendente || !anterior?.imovel) {
    return { error: 'Não foi possível recuperar os dados originais desta análise.' }
  }

  const dados: AnaliseInput = { ...anterior, solidarios }

  const prov = await garantirImobiliaria(admin, acesso.userId)
  if (prov.error || !prov.cnpjCpf) return { error: prov.error ?? 'Cadastro na corretora indisponível.' }

  try {
    const r = await transmitirAnalise(admin, dados, {
      userId: acesso.userId,
      analiseId,
      cnpjImobiliaria: prov.cnpjCpf,
      alterarCodigo: analise.maximiza_id,
    })

    await gravarPareceres(admin, analiseId, r.pareceres)
    await admin.from('seguro_analises').update({
      payload: dados as unknown as Record<string, unknown>,
      status_resumo: resumirStatus(r.pareceres),
      erro: null,
    }).eq('id', analiseId)

    revalidatePath(`/painel/seguros/fianca/${analiseId}`)
    return { ok: true }
  } catch (e) {
    return { error: mensagemDeErro(e, 'Falha ao reenviar com solidários.') }
  }
}

/** Nova tentativa — recusa não é fim de linha. */
export async function reanalisar(analiseId: string, seguradoras: string[]) {
  const acesso = await exigirAcessoSeguros()
  const admin = createAdminClient()

  const analise = await checarPosseAnalise(analiseId, acesso.userId)
  if (!analise) return { error: 'Análise não encontrada.' }
  if (!analise.maximiza_id) return { error: 'Esta análise ainda não foi transmitida.' }
  if (!seguradoras.length) return { error: 'Escolha ao menos uma seguradora.' }

  // A escolha vem da tela, então pode incluir seguradora que não aceita
  // este tipo de análise. Mesma trava do envio inicial, pelo mesmo motivo.
  const prov = await garantirImobiliaria(admin, acesso.userId)
  if (prov.error || !prov.cnpjCpf) return { error: prov.error ?? 'Cadastro na corretora indisponível.' }

  const tipoAnalise: TipoAnalise = analise.tipo_analise === 'completa' ? 'completa' : 'reduzida'
  const eleg = await seguradorasElegiveis(admin, {
    tipoAnalise,
    cnpjImobiliaria: prov.cnpjCpf,
    escolhidas: seguradoras,
    userId: acesso.userId,
  })
  if (!eleg.siglas.length) return { error: motivoDeNenhumaElegivel(eleg, tipoAnalise) }

  try {
    const r = await transmitirReanalise(admin, analise.maximiza_id, eleg.siglas, {
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
    return { error: mensagemDeErro(e, 'Falha ao reanalisar.') }
  }
}

/**
 * Amarra uma análise ao contrato de locação.
 *
 * Chamado pelo wizard quando o corretor vincula uma cotação aprovada na
 * etapa de garantia. É esse vínculo que faz o número da apólice descer
 * sozinho pro contrato quando a seguradora emitir (webhook de arquivos).
 */
export async function vincularAnaliseAoContrato(analiseId: string, contratoId: string) {
  const acesso = await exigirAcessoSeguros()
  const admin = createAdminClient()

  const analise = await checarPosseAnalise(analiseId, acesso.userId)
  if (!analise) return { error: 'Cotação não encontrada.' }

  // O contrato também precisa ser do mesmo dono.
  const { data: contrato } = await admin
    .from('contratos_locacao')
    .select('id')
    .eq('id', contratoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!contrato) return { error: 'Contrato não encontrado.' }

  const { error } = await admin
    .from('seguro_analises')
    .update({ contrato_id: contratoId })
    .eq('id', analiseId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/seguros/fianca/${analiseId}`)
  revalidatePath(`/painel/contratos/${contratoId}`)
  return { ok: true }
}

/** Busca atividades CNAE — usada pelo seletor do formulário comercial. */
export async function buscarAtividadesCnae(termo: string) {
  await exigirAcessoSeguros()
  const admin = createAdminClient()
  try {
    return { itens: await buscarCnae(admin, termo) }
  } catch (e) {
    return { error: mensagemDeErro(e, 'Falha ao buscar atividades.') }
  }
}

export async function excluirAnalise(analiseId: string) {
  const acesso = await exigirAcessoSeguros()
  const admin = createAdminClient()

  const analise = await checarPosseAnalise(analiseId, acesso.userId)
  if (!analise) return { error: 'Análise não encontrada.' }

  // Apaga os documentos ANTES da linha: sem a linha, ninguém mais sabe
  // que aqueles PDFs existem no bucket.
  try {
    await removerArquivosDaAnalise(admin, acesso.userId, analiseId)
  } catch (e) {
    return { error: mensagemDeErro(e, 'Falha ao remover os documentos.') }
  }

  const { error } = await admin.from('seguro_analises').delete().eq('id', analiseId)
  if (error) return { error: error.message }

  revalidatePath('/painel/seguros/fianca')
  return { ok: true }
}
