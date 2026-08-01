'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { consultarPrecos, contratar } from '@/lib/seguros'
import { statusAprovado } from '@/lib/seguros/tabelas'
import type { Coberturas, OpcaoPagamento, PlanosPreco } from '@/lib/seguros/tipos'

/**
 * Preços e contratação — o passo em que a apólice nasce.
 *
 * Duas travas que valem notar:
 *  · só parecer aprovado (1) ou aprovado com limite inferior (5) pode
 *    seguir. Os demais nem chegam aqui pela UI, mas server action é
 *    endpoint público;
 *  · nada de cartão de crédito. Trafegar PAN pelo nosso servidor nos
 *    coloca no escopo do PCI-DSS; fatura, boleto e ficha cobrem o caso.
 */

/** Carrega a análise e o parecer, checando posse e se dá pra contratar. */
async function carregarParaContratacao(
  analiseId: string,
  seguradoraSigla: string,
  userId: string,
) {
  const admin = createAdminClient()

  const { data: analise } = await admin
    .from('seguro_analises')
    .select('id, user_id, maximiza_id, contrato_id, imovel_id, payload')
    .eq('id', analiseId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!analise) return { error: 'Análise não encontrada.' }
  if (!analise.maximiza_id) return { error: 'Esta análise ainda não foi transmitida.' }

  const { data: parecer } = await admin
    .from('seguro_analise_pareceres')
    .select('codigo_status, limite_aprovado, seguradora_nome')
    .eq('analise_id', analiseId)
    .eq('seguradora_sigla', seguradoraSigla)
    .maybeSingle()

  if (!parecer) return { error: 'Parecer não encontrado para esta seguradora.' }
  if (!statusAprovado(parecer.codigo_status)) {
    return { error: 'Só dá pra contratar em seguradora que aprovou a análise.' }
  }

  return { admin, analise, parecer }
}

export interface EncargosInput {
  condominio?: number
  gas?: number
  iptu?: number
  energia?: number
  agua?: number
  danos?: boolean
  pinturaInterna?: boolean
  pinturaExterna?: boolean
  multa?: boolean
}

/**
 * Consulta os planos e formas de pagamento.
 *
 * Os encargos entram no cálculo: quanto mais o seguro cobre, maior o
 * prêmio. Por isso a consulta é refeita a cada mudança — não dá pra
 * cachear o preço de um conjunto de coberturas diferente.
 */
export async function consultarPrecosAnalise(
  analiseId: string,
  seguradoraSigla: string,
  encargos: EncargosInput,
): Promise<{ planos?: PlanosPreco; error?: string }> {
  const acesso = await exigirAcessoCRM()
  const ctx = await carregarParaContratacao(analiseId, seguradoraSigla, acesso.userId)
  if ('error' in ctx) return { error: ctx.error }

  const { admin, analise } = ctx

  try {
    const planos = await consultarPrecos(
      admin,
      analise.maximiza_id!,
      seguradoraSigla,
      {
        condominio: encargos.condominio ?? 0,
        gas: encargos.gas ?? 0,
        iptu: encargos.iptu ?? 0,
        energia: encargos.energia ?? 0,
        agua: encargos.agua ?? 0,
        danos: encargos.danos ? 1 : 0,
        pintura_int: encargos.pinturaInterna ? 1 : 0,
        pintura_ext: encargos.pinturaExterna ? 1 : 0,
        multa: encargos.multa ? 1 : 0,
      },
      { userId: acesso.userId, analiseId },
    )
    return { planos }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Falha ao consultar preços.' }
  }
}

export interface ContratarInput {
  analiseId: string
  seguradoraSigla: string
  opcao: OpcaoPagamento
  encargos: EncargosInput

  inicioVigencia: string          // ISO
  fimVigencia: string             // ISO
  indiceReajuste?: string | null

  imovel: { cep: string; endereco: string; bairro: string; cidade: string; uf: string }
  proprietario: {
    tipo: 'F' | 'J'
    nome: string
    cpfCnpj: string
    rg?: string | null
    dataNascimento?: string | null
    estadoCivil?: string | null
  }
  observacoes?: string | null
}

/**
 * Efetiva a contratação.
 *
 * Grava a linha ANTES da chamada externa, como nas análises: se a API
 * falhar, o corretor vê o erro no histórico em vez de a contratação sumir
 * sem rastro — e num fluxo que envolve dinheiro isso importa mais ainda.
 *
 * O retorno da API traz só uma mensagem, sem número de apólice: ela chega
 * depois pelo webhook de arquivos (codigo_tipo 9). Por isso o status
 * nasce 'enviada', não 'emitida'.
 */
export async function contratarSeguro(input: ContratarInput) {
  const acesso = await exigirAcessoCRM()
  const ctx = await carregarParaContratacao(input.analiseId, input.seguradoraSigla, acesso.userId)
  if ('error' in ctx) return { error: ctx.error }

  const { admin, analise } = ctx

  if (!input.inicioVigencia || !input.fimVigencia) return { error: 'Informe a vigência da apólice.' }
  if (new Date(input.fimVigencia) <= new Date(input.inicioVigencia)) {
    return { error: 'O fim da vigência precisa ser depois do início.' }
  }
  if (!input.proprietario.nome?.trim()) return { error: 'Informe o nome do proprietário.' }
  if (!input.proprietario.cpfCnpj?.replace(/\D/g, '')) return { error: 'Informe o CPF/CNPJ do proprietário.' }
  if (!input.imovel.cep?.replace(/\D/g, '')) return { error: 'Informe o CEP do imóvel.' }
  if (!input.imovel.endereco?.trim()) return { error: 'Informe o endereço do imóvel.' }

  const coberturas: Coberturas = {
    condominio: input.encargos.condominio ?? 0,
    gas: input.encargos.gas ?? 0,
    iptu: input.encargos.iptu ?? 0,
    energia: input.encargos.energia ?? 0,
    agua: input.encargos.agua ?? 0,
    danos: !!input.encargos.danos,
    pinturaInterna: !!input.encargos.pinturaInterna,
    pinturaExterna: !!input.encargos.pinturaExterna,
    multa: !!input.encargos.multa,
  }

  // A API não devolve o prêmio total; deriva da opção escolhida.
  const premioTotal = Number(
    (input.opcao.qtdParcelas * input.opcao.valorParcela).toFixed(2),
  )

  const { data: contratacao, error: eIns } = await admin
    .from('seguro_contratacoes')
    .insert({
      analise_id: input.analiseId,
      user_id: acesso.userId,
      seguradora_sigla: input.seguradoraSigla,
      tipo_plano: input.opcao.tipoPlano,
      forma_pagto: input.opcao.formaPagamento,
      qtd_parcelas: input.opcao.qtdParcelas,
      valor_parcela: input.opcao.valorParcela,
      premio_total: premioTotal,
      entrada_pagto: input.opcao.comEntrada ? 1 : 0,
      inicio_vigencia: input.inicioVigencia,
      fim_vigencia: input.fimVigencia,
      coberturas,
      proprietario: input.proprietario,
      status: 'enviada',
    })
    .select('id')
    .single()

  if (eIns || !contratacao) return { error: eIns?.message ?? 'Falha ao registrar contratação.' }

  try {
    const r = await contratar(admin, {
      idAnaliseExterno: analise.maximiza_id!,
      seguradoraSigla: input.seguradoraSigla,
      inicioVigencia: input.inicioVigencia,
      fimVigencia: input.fimVigencia,
      indiceReajuste: input.indiceReajuste ?? null,
      opcao: input.opcao,
      premioTotal,
      coberturas,
      imovel: input.imovel,
      proprietario: input.proprietario,
      observacoes: input.observacoes ?? null,
    }, { userId: acesso.userId, analiseId: input.analiseId })

    await admin.from('seguro_contratacoes')
      .update({ retorno_msg: r.msg, erro: null })
      .eq('id', contratacao.id)

    // Marca a garantia no contrato de locação, se houver vínculo. O número
    // da apólice entra depois, quando o webhook trouxer.
    if (analise.contrato_id) {
      await admin.from('contratos_locacao').update({
        garantia_tipo: 'seguro_fianca',
        seguro_fianca_seguradora: ctx.parecer.seguradora_nome ?? input.seguradoraSigla.toUpperCase(),
      }).eq('id', analise.contrato_id)
    }

    revalidatePath(`/painel/seguros/fianca/${input.analiseId}`)
    return { ok: true, id: contratacao.id, msg: r.msg }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao contratar.'
    await admin.from('seguro_contratacoes')
      .update({ status: 'erro', erro: msg })
      .eq('id', contratacao.id)
    revalidatePath(`/painel/seguros/fianca/${input.analiseId}`)
    return { error: msg, id: contratacao.id }
  }
}

export async function cancelarContratacao(contratacaoId: string) {
  const acesso = await exigirAcessoCRM()
  const admin = createAdminClient()

  const { data: c } = await admin
    .from('seguro_contratacoes')
    .select('id, analise_id, status')
    .eq('id', contratacaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()

  if (!c) return { error: 'Contratação não encontrada.' }
  if (c.status === 'emitida') {
    // Apólice emitida não se cancela por aqui — é processo da seguradora.
    return { error: 'Apólice já emitida. O cancelamento precisa ser feito junto à corretora.' }
  }

  const { error } = await admin
    .from('seguro_contratacoes')
    .update({ status: 'cancelada' })
    .eq('id', contratacaoId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/seguros/fianca/${c.analise_id}`)
  return { ok: true }
}
