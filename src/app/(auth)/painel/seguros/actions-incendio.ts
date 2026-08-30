'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { mensagemDeErro } from '@/lib/seguros/erros'
import { exigirAcessoSeguros } from '@/lib/seguros/acesso'
import { garantirImobiliaria } from '@/lib/seguros/imobiliaria'
import { cancelarComissao, registrarComissao } from '@/lib/seguros/comissoes'
import { ambienteMaximiza } from '@/lib/seguros'
import { salvarArquivoIncendio } from '@/lib/seguros/incendio/arquivos'
import {
  calcularIncendio, cancelarIncendio, contratarIncendio, imprimirBoletos,
  imprimirProposta, listarOcupacoes, listarPacotesAssistencia,
  listarSeguradorasIncendio, listarFaturamento,
} from '@/lib/seguros/incendio'
import type {
  CalculoIncendioInput, ContratacaoIncendioInput, TipoSeguro, TipoVigencia,
} from '@/lib/seguros/incendio/tipos'

/**
 * Seguro incêndio.
 *
 * Fluxo diferente da fiança: sem análise de crédito, sem espera. Calcula
 * e contrata. Por isso a apólice nasce como 'rascunho', vira 'calculada'
 * e depois 'contratada' — tudo na mesma sessão do corretor.
 */

/** Lança em erro de consulta — null aqui significa "não é sua". */
async function checarPosse(apoliceId: string, userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('seguro_incendio_apolices')
    .select('id, user_id, seguradora, codigo_seguro, status, contrato_id, inquilino_id')
    .eq('id', apoliceId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`Falha ao consultar a apólice: ${error.message}`)
  return data
}

/* ── Catálogo ──────────────────────────────────────────────────────── */

export async function carregarCatalogoIncendio(
  seguradora: string,
  tipoSeguro: TipoSeguro,
  tipoVigencia: TipoVigencia,
) {
  const acesso = await exigirAcessoSeguros()
  const admin = createAdminClient()

  try {
    const [ocupacoes, pacotes] = await Promise.all([
      listarOcupacoes(admin, seguradora, tipoSeguro, acesso.userId),
      listarPacotesAssistencia(admin, seguradora, tipoSeguro, tipoVigencia, acesso.userId),
    ])
    return { ocupacoes, pacotes }
  } catch (e) {
    return { error: mensagemDeErro(e, 'Falha ao carregar opções da seguradora.') }
  }
}

export async function listarSeguradorasDoIncendio() {
  await exigirAcessoSeguros()
  const admin = createAdminClient()
  try {
    return { seguradoras: await listarSeguradorasIncendio(admin) }
  } catch (e) {
    return { error: mensagemDeErro(e, 'Falha ao listar seguradoras.') }
  }
}

/* ── Cálculo ───────────────────────────────────────────────────────── */

export interface NovaApoliceInput {
  /** Referência interna da imobiliária. Não vai pra seguradora. */
  controle?: string | null
  contratoId?: string | null
  imovelId?: string | null
  inquilinoId?: string | null
  proprietarioId?: string | null
  dados: Omit<CalculoIncendioInput, 'cnpjImobiliaria'>
}

/**
 * Calcula e guarda o resultado.
 *
 * A linha é criada aqui, no cálculo, e não só na contratação: o corretor
 * costuma cotar, mostrar ao proprietário e voltar depois. Sem isso ele
 * teria que redigitar tudo.
 */
export async function calcularApoliceIncendio(input: NovaApoliceInput) {
  const acesso = await exigirAcessoSeguros()
  const admin = createAdminClient()

  const prov = await garantirImobiliaria(admin, acesso.userId)
  if (prov.error || !prov.cnpjCpf) return { error: prov.error ?? 'Cadastro na corretora indisponível.' }

  const d = input.dados
  if (!d.seguradora) return { error: 'Escolha a seguradora.' }
  if (!(d.aluguel > 0)) return { error: 'Informe o valor do aluguel.' }
  if (!d.ocupacao?.rubrica) return { error: 'Escolha a ocupação do imóvel.' }
  if (!d.endereco?.cep?.replace(/\D/g, '')) return { error: 'Informe o CEP.' }
  if (!d.inquilino?.nome?.trim()) return { error: 'Informe o inquilino.' }
  if (!d.proprietario?.nome?.trim()) return { error: 'Informe o proprietário.' }
  if (!d.inicioVigencia || !d.fimVigencia) return { error: 'Informe a vigência.' }

  const completo: CalculoIncendioInput = { ...d, cnpjImobiliaria: prov.cnpjCpf }

  const { data: apolice, error: eIns } = await admin
    .from('seguro_incendio_apolices')
    .insert({
      user_id: acesso.userId,
      controle: input.controle?.trim() || null,
      contrato_id: input.contratoId ?? null,
      imovel_id: input.imovelId ?? null,
      inquilino_id: input.inquilinoId ?? null,
      proprietario_id: input.proprietarioId ?? null,
      seguradora: d.seguradora,
      ambiente: ambienteMaximiza(),
      tipo_seguro: d.tipoSeguro,
      tipo_cobertura: d.tipoCobertura,
      tipo_vigencia: d.tipoVigencia,
      ocupacao_rubrica: d.ocupacao.rubrica,
      ocupacao_cdresp2: d.ocupacao.cdresp2,
      pacote_assist: d.pacoteAssistencia,
      valor_aluguel: d.aluguel,
      coberturas_valores: d.valores,
      inicio_vigencia: d.inicioVigencia,
      fim_vigencia: d.fimVigencia,
      inquilino: d.inquilino,
      proprietario: d.proprietario,
      endereco: d.endereco,
      payload: completo as unknown as Record<string, unknown>,
      status: 'rascunho',
    })
    .select('id')
    .single()

  if (eIns || !apolice) return { error: eIns?.message ?? 'Falha ao registrar cotação.' }

  try {
    const calculo = await calcularIncendio(admin, completo, acesso.userId)

    await admin.from('seguro_incendio_apolices').update({
      calculo,
      calculo_em: new Date().toISOString(),
      premio_total: calculo.premio,
      valor_iof: calculo.iof,
      valor_assistencia: calculo.valorAssistencia,
      status: 'calculada',
      erro: null,
    }).eq('id', apolice.id)

    revalidatePath('/painel/seguros/incendio')
    return { ok: true, id: apolice.id, calculo }
  } catch (e) {
    const msg = mensagemDeErro(e, 'Falha ao calcular.')
    await admin.from('seguro_incendio_apolices')
      .update({ status: 'erro', erro: msg }).eq('id', apolice.id)
    revalidatePath('/painel/seguros/incendio')
    return { error: msg, id: apolice.id }
  }
}

/* ── Contratação ───────────────────────────────────────────────────── */

export async function contratarApoliceIncendio(apoliceId: string, escolha: {
  formaPagtoCodigo: string
  formaPagtoDescricao: string
  qtdParcelas: number
  valorParcela: number
  /**
   * Aceite explícito de que a emissão é real. Só é exigido em produção.
   *
   * Vive no servidor e não na tela porque a tela pode estar velha: uma aba
   * aberta antes do deploy que virou o ambiente não tem a caixa de
   * confirmação, e sem esta trava emitiria apólice de verdade achando que
   * ainda estava em homologação.
   */
  confirmaEmissaoReal?: boolean
}) {
  const acesso = await exigirAcessoSeguros()
  const admin = createAdminClient()

  const apolice = await checarPosse(apoliceId, acesso.userId)
  if (!apolice) return { error: 'Cotação não encontrada.' }
  if (apolice.status === 'contratada') return { error: 'Esta apólice já foi contratada.' }
  if (apolice.status !== 'calculada') return { error: 'Calcule antes de contratar.' }

  if (ambienteMaximiza() === 1 && !escolha.confirmaEmissaoReal) {
    return {
      error: 'Esta plataforma está em produção: contratar aqui emite apólice ' +
        'de verdade. Recarregue a página e confirme a emissão real antes de continuar.',
    }
  }

  const { data: linha } = await admin
    .from('seguro_incendio_apolices')
    .select('payload').eq('id', apoliceId).maybeSingle()

  const base = (linha?.payload ?? {}) as unknown as CalculoIncendioInput
  if (!base?.seguradora) return { error: 'Não foi possível recuperar os dados da cotação.' }

  // A contratação exige o que o cálculo dispensa: endereço completo.
  if (!base.endereco?.endereco?.trim()) return { error: 'Informe o endereço completo do imóvel antes de contratar.' }
  if (!base.inquilino?.sexo) return { error: 'Informe o sexo do inquilino antes de contratar.' }

  const entrada: ContratacaoIncendioInput = {
    ...base,
    qtdParcelas: escolha.qtdParcelas,
    formaPagtoCodigo: escolha.formaPagtoCodigo,
    formaPagtoDescricao: escolha.formaPagtoDescricao,
  }

  try {
    const r = await contratarIncendio(admin, entrada, acesso.userId)

    await admin.from('seguro_incendio_apolices').update({
      codigo_seguro: r.codigoSeguro,
      numero_proposta: r.numeroProposta,
      forma_pagto_codigo: escolha.formaPagtoCodigo,
      forma_pagto_descricao: escolha.formaPagtoDescricao,
      qtd_parcelas: escolha.qtdParcelas,
      valor_parcela: escolha.valorParcela,
      status: 'contratada',
      contratada_em: new Date().toISOString(),
      erro: null,
    }).eq('id', apoliceId)

    // A venda aconteceu: registra a comissão. Nunca lança — comissão que
    // derruba a contratação que deveria remunerar é troca ruim.
    await registrarComissao(admin, {
      userId: acesso.userId,
      produto: 'incendio',
      apoliceIncendioId: apoliceId,
      pessoaId: apolice.inquilino_id ?? null,
      contratoId: apolice.contrato_id ?? null,
      seguradoraSigla: base.seguradora,
      apoliceNumero: r.codigoSeguro,
      premioTotal: escolha.valorParcela * escolha.qtdParcelas,
    })

    // Registra no contrato de locação, se houver vínculo.
    if (apolice.contrato_id) {
      const anual = base.tipoVigencia === 0
      await admin.from('contratos_locacao').update({
        valor_seguro_incendio_anual: anual
          ? escolha.valorParcela * escolha.qtdParcelas
          : null,
        seguro_incendio_data: base.inicioVigencia,
      }).eq('id', apolice.contrato_id)
    }

    revalidatePath(`/painel/seguros/incendio/${apoliceId}`)
    return { ok: true, ...r }
  } catch (e) {
    const msg = mensagemDeErro(e, 'Falha ao contratar.', { podeTerCriado: true })
    await admin.from('seguro_incendio_apolices').update({ erro: msg }).eq('id', apoliceId)
    return { error: msg }
  }
}

/* ── Pós-contratação ───────────────────────────────────────────────── */

export async function cancelarApoliceIncendio(apoliceId: string) {
  const acesso = await exigirAcessoSeguros()
  const admin = createAdminClient()

  const apolice = await checarPosse(apoliceId, acesso.userId)
  if (!apolice) return { error: 'Apólice não encontrada.' }
  if (apolice.status !== 'contratada') return { error: 'Só apólice contratada pode ser cancelada.' }
  if (!apolice.codigo_seguro) return { error: 'Apólice sem código na seguradora.' }

  try {
    const r = await cancelarIncendio(admin, apolice.codigo_seguro, acesso.userId)
    if (!r.ok) return { error: r.mensagem || 'A seguradora recusou o cancelamento.' }

    await admin.from('seguro_incendio_apolices').update({
      status: 'cancelada',
      cancelada_em: new Date().toISOString(),
      cancelamento_msg: r.mensagem,
    }).eq('id', apoliceId)

    // A apólice caiu: a comissão deixa de ser esperada. O que já constava
    // como recebido é preservado — aí é estorno, e alguém precisa olhar.
    await cancelarComissao(admin, { apoliceIncendioId: apoliceId })

    revalidatePath(`/painel/seguros/incendio/${apoliceId}`)
    return { ok: true, mensagem: r.mensagem }
  } catch (e) {
    return { error: mensagemDeErro(e, 'Falha ao cancelar.', { podeTerCriado: true }) }
  }
}

/**
 * Baixa certificado, proposta e boletos.
 *
 * Diferente da fiança, os PDFs não chegam por webhook — pedimos. Guardamos
 * no bucket pra não repetir a chamada a cada visualização.
 */
export async function baixarDocumentosIncendio(apoliceId: string) {
  const acesso = await exigirAcessoSeguros()
  const admin = createAdminClient()

  const apolice = await checarPosse(apoliceId, acesso.userId)
  if (!apolice) return { error: 'Apólice não encontrada.' }
  if (!apolice.codigo_seguro) return { error: 'Apólice ainda não contratada.' }

  const ctx = { userId: acesso.userId, apoliceId }
  let baixados = 0

  try {
    const docs = await imprimirProposta(admin, apolice.codigo_seguro, acesso.userId)

    if (docs.certificadoBase64) {
      await salvarArquivoIncendio(admin, ctx, { tipo: 'certificado', base64: docs.certificadoBase64 })
      baixados++
    }
    if (docs.propostaBase64) {
      await salvarArquivoIncendio(admin, ctx, { tipo: 'proposta', base64: docs.propostaBase64 })
      baixados++
    }
  } catch (e) {
    return { error: mensagemDeErro(e, 'Falha ao baixar o certificado.') }
  }

  /**
   * O boleto tem try próprio porque ele ATRASA em relação ao certificado.
   * Medido: minutos depois da contratação, `imprimirProposta` devolve o
   * certificado e `imprimirBoleto` responde "Fatura não encontrada" — a
   * fatura da imobiliária só existe depois do fechamento do lote deles.
   *
   * Num try só, esse erro esperado descartava o certificado que já tinha
   * sido salvo e a tela dizia "falha ao baixar documentos", quando dois
   * documentos estavam ali.
   */
  let avisoBoleto: string | null = null
  try {
    const boletos = await imprimirBoletos(admin, apolice.codigo_seguro, acesso.userId)
    for (const b of boletos) {
      await salvarArquivoIncendio(admin, ctx, {
        tipo: 'boleto',
        base64: b.base64,
        numParcela: b.numParcela,
        dataVencimento: b.dataVencimento,
        dataPagamento: b.dataPagamento,
      })
      baixados++
    }
  } catch (e) {
    // A frase da corretora chega traduzida por mensagemDeErro, que já
    // repassa o corpo do 4xx — é nela que "Fatura não encontrada" aparece.
    const msg = mensagemDeErro(e, 'O boleto não pôde ser baixado agora.')
    avisoBoleto = /fatura n[aã]o encontrada/i.test(msg)
      ? 'O certificado foi baixado. O boleto ainda não foi gerado pela seguradora — tente de novo mais tarde.'
      : msg
  }

  revalidatePath(`/painel/seguros/incendio/${apoliceId}`)
  return { ok: true, baixados, aviso: avisoBoleto }
}

export async function excluirApoliceIncendio(apoliceId: string) {
  const acesso = await exigirAcessoSeguros()
  const admin = createAdminClient()

  const apolice = await checarPosse(apoliceId, acesso.userId)
  if (!apolice) return { error: 'Apólice não encontrada.' }
  if (apolice.status === 'contratada') {
    return { error: 'Cancele a apólice antes de excluir — ela existe na seguradora.' }
  }

  const { error } = await admin.from('seguro_incendio_apolices').delete().eq('id', apoliceId)
  if (error) return { error: error.message }

  revalidatePath('/painel/seguros/incendio')
  return { ok: true }
}

/* ── Faturamento ───────────────────────────────────────────────────── */

/**
 * Sincroniza as faturas da imobiliária.
 *
 * É o único endpoint de toda a integração com visão financeira — a base
 * pra conferir o que a corretora cobra e o que a plataforma recebe.
 */
export async function sincronizarFaturamento(
  seguradora: string,
  competencia?: { mes: number; ano: number },
) {
  const acesso = await exigirAcessoSeguros()
  const admin = createAdminClient()

  const prov = await garantirImobiliaria(admin, acesso.userId)
  if (prov.error || !prov.cnpjCpf) return { error: prov.error ?? 'Cadastro na corretora indisponível.' }

  const ambiente = ambienteMaximiza()

  try {
    const grupos = await listarFaturamento(admin, seguradora, prov.cnpjCpf, competencia, acesso.userId)

    const linhas = grupos.flatMap(g =>
      g.itens.map(i => ({
        user_id: acesso.userId,
        ambiente,
        cnpj_imobiliaria: prov.cnpjCpf!,
        competencia: competencia
          ? `${competencia.ano}-${String(competencia.mes).padStart(2, '0')}-01`
          : null,
        vigencia: g.vigencia,
        ramo: g.ramo,
        codigo: i.codigo,
        numero_proposta: i.numeroProposta,
        cdconseg: i.cdconseg,
        cdemi: i.cdemi,
        data_cobertura: i.dataCobertura,
        inquilino_nome: i.inquilino,
        proprietario_nome: i.proprietario,
        local_risco: i.localRisco,
        parcelas: i.parcelas,
        valor_parcela: i.valorParcela,
        premio_total: i.premioTotal,
        sincronizado_em: new Date().toISOString(),
      })),
    )

    if (linhas.length) {
      await admin.from('seguro_incendio_faturas')
        .upsert(linhas, { onConflict: 'ambiente,cnpj_imobiliaria,vigencia,ramo,codigo' })
    }

    revalidatePath('/painel/seguros/incendio/faturamento')
    return { ok: true, itens: linhas.length }
  } catch (e) {
    return { error: mensagemDeErro(e, 'Falha ao consultar faturamento.') }
  }
}
