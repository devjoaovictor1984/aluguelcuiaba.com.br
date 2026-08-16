'use server'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { mensagemDeErro } from '@/lib/seguros/erros'
import { limitePorIp } from '@/lib/rate-limit'
import { garantirImobiliaria } from '@/lib/seguros/imobiliaria'
import { segurosConfigurado } from '@/lib/seguros/acesso'
import { seguradorasElegiveis, motivoDeNenhumaElegivel } from '@/lib/seguros/elegiveis'
import { ambienteMaximiza, transmitirAnalise } from '@/lib/seguros'
import { gravarPareceres } from '@/lib/seguros/pareceres'
import { resumirStatus } from '@/lib/seguros/status-ui'
import type { AnaliseInput } from '@/lib/seguros/tipos'

/**
 * Preenchimento da análise pelo próprio pretenso inquilino.
 *
 * O token é a credencial — não há login. Tudo roda com service-role, então
 * cada função revalida o token do zero: nunca confiar no que o cliente
 * mandar além dele.
 *
 * O dado do inquilino é gravado em `pessoas` antes de ir pra corretora —
 * o lead é do corretor, não só do painel da seguradora.
 */

interface LinkAuth {
  id: string
  user_id: string
  imovel_id: string | null
  contrato_id: string | null
  pessoa_id: string | null
  dados_imovel: Record<string, unknown>
  tipo_analise: string
  expira_em: string
  preenchido_em: string | null
  revogado_em: string | null
}

async function carregarPorToken(token: string): Promise<{ link?: LinkAuth; error?: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('seguro_analise_links')
    .select('id, user_id, imovel_id, contrato_id, pessoa_id, dados_imovel, tipo_analise, expira_em, preenchido_em, revogado_em')
    .eq('token', token)
    .maybeSingle()

  // Falha de banco não pode dizer ao inquilino que o link dele é inválido:
  // ele desiste de preencher e o corretor perde o negócio.
  if (error) return { error: 'Erro ao abrir o formulário. Tente de novo em instantes.' }
  if (!data) return { error: 'Link inválido ou não encontrado.' }
  if (data.revogado_em) return { error: 'Este link foi cancelado pelo corretor.' }
  if (data.preenchido_em) return { error: 'Este formulário já foi enviado.' }
  if (new Date(data.expira_em).getTime() < Date.now()) {
    return { error: 'Link expirado. Peça um novo ao corretor.' }
  }
  return { link: data as LinkAuth }
}

/** Marca a 1ª abertura — o corretor vê que o inquilino recebeu. */
export async function registrarAbertura(token: string) {
  const { link } = await carregarPorToken(token)
  if (!link) return
  const admin = createAdminClient()
  await admin
    .from('seguro_analise_links')
    .update({ aberto_em: new Date().toISOString() })
    .eq('id', link.id)
    .is('aberto_em', null)
}

export interface PreenchimentoInput {
  nome: string
  cpfCnpj: string
  email: string
  celular: string
  dataNascimento?: string | null
  sexo?: 'M' | 'F' | null
  consentimento: boolean
}

export async function enviarAnalisePeloLink(token: string, input: PreenchimentoInput) {
  if (!await limitePorIp('seguro-link', 8, 60)) {
    return { error: 'Muitas tentativas. Aguarde um instante.' }
  }

  const { link, error } = await carregarPorToken(token)
  if (!link || error) return { error: error ?? 'Erro.' }

  // Ambiente sem credencial: `ambienteMaximiza()` mais abaixo é chamado
  // fora do try/catch e derrubaria a página, e o erro que sobe daqui cita
  // endpoint e variável de ambiente — coisas que um inquilino não pode
  // ver. Recado curto e nenhum dado gravado.
  if (!segurosConfigurado()) {
    return { error: 'Este formulário está indisponível no momento. Procure quem enviou o link.' }
  }

  if (!input.consentimento) return { error: 'É preciso aceitar o envio dos dados.' }
  if (!input.nome?.trim()) return { error: 'Informe seu nome completo.' }

  const doc = input.cpfCnpj.replace(/\D/g, '')
  if (doc.length !== 11 && doc.length !== 14) return { error: 'CPF ou CNPJ inválido.' }
  if (!input.email?.includes('@')) return { error: 'E-mail inválido.' }
  if (input.celular.replace(/\D/g, '').length < 10) return { error: 'Celular incompleto (com DDD).' }

  const completa = link.tipo_analise === 'completa'
  if (completa && !input.dataNascimento) return { error: 'Informe a data de nascimento.' }
  if (completa && !input.sexo) return { error: 'Informe o sexo.' }

  const admin = createAdminClient()
  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0].trim() ?? hdrs.get('x-real-ip') ?? null

  // 1. O lead vira cadastro no CRM do corretor, antes de qualquer chamada
  //    externa. Mesmo que a transmissão falhe, o contato não se perde.
  //    Se nem isso der certo, para aqui: seguir sem o cadastro produziria
  //    uma análise órfã e o corretor perderia o contato.
  let pessoaId: string | null
  try {
    pessoaId = await upsertPretensoInquilino(admin, link, input, doc)
  } catch (e) {
    return { error: mensagemDeErro(e, 'Falha ao registrar seus dados.') }
  }

  // 2. Transmite pra corretora.
  const dadosImovel = link.dados_imovel as {
    cep: string; endereco?: string | null; aluguel: number
    condominio?: number | null; iptu?: number | null
    agua?: number | null; energia?: number | null; gas?: number | null
    finalidade: 'R' | 'C'; tipo?: string | null; periodoContratoMeses: number
    pinturaNova: boolean
  }

  const dados: AnaliseInput = {
    produto: 'fianca',
    tipoAnalise: completa ? 'completa' : 'reduzida',
    pretendente: {
      tipo: doc.length === 14 ? 'J' : 'F',
      nome: input.nome.trim(),
      cpfCnpj: input.cpfCnpj,
      email: input.email.trim(),
      celular: input.celular,
      dataNascimento: input.dataNascimento || null,
      sexo: input.sexo || null,
    },
    imovel: {
      cep: dadosImovel.cep,
      endereco: dadosImovel.endereco ?? null,
      aluguel: Number(dadosImovel.aluguel) || 0,
      condominio: dadosImovel.condominio ?? null,
      iptu: dadosImovel.iptu ?? null,
      agua: dadosImovel.agua ?? null,
      energia: dadosImovel.energia ?? null,
      gas: dadosImovel.gas ?? null,
      finalidade: dadosImovel.finalidade ?? 'R',
      tipo: dadosImovel.tipo ?? null,
      periodoContratoMeses: Number(dadosImovel.periodoContratoMeses) || 30,
      pinturaNova: dadosImovel.pinturaNova ?? true,
    },
  }

  const { data: analise, error: eIns } = await admin
    .from('seguro_analises')
    .insert({
      user_id: link.user_id,
      produto: 'fianca',
      origem: 'link',
      contrato_id: link.contrato_id,
      imovel_id: link.imovel_id,
      inquilino_id: pessoaId,
      ambiente: ambienteMaximiza(),
      tipo_analise: dados.tipoAnalise,
      finalidade: dados.imovel.finalidade,
      payload: dados as unknown as Record<string, unknown>,
      valor_aluguel: dados.imovel.aluguel,
      // O consentimento aqui é do próprio titular — mais forte que o do
      // painel, onde o corretor declara em nome dele.
      consentimento_em: new Date().toISOString(),
      consentimento_ip: ip,
      status_resumo: 'enviando',
    })
    .select('id')
    .single()

  if (eIns || !analise) return { error: eIns?.message ?? 'Falha ao registrar a solicitação.' }

  // Fecha o link agora: evita reenvio por duplo clique ou link compartilhado.
  await admin.from('seguro_analise_links').update({
    preenchido_em: new Date().toISOString(),
    preenchido_ip: ip,
    pessoa_id: pessoaId,
    analise_id: analise.id,
  }).eq('id', link.id)

  try {
    const prov = await garantirImobiliaria(admin, link.user_id)
    if (prov.error || !prov.cnpjCpf) throw new Error(prov.error ?? 'Cadastro do corretor indisponível.')

    // Mesma trava do painel: lista vazia significa "todas" pra API, e
    // "todas" inclui seguradora que não aceita este tipo de análise —
    // 500 genérico, aqui na cara do inquilino.
    const eleg = await seguradorasElegiveis(admin, {
      tipoAnalise: dados.tipoAnalise,
      cnpjImobiliaria: prov.cnpjCpf,
      userId: link.user_id,
    })
    if (!eleg.siglas.length) throw new Error(motivoDeNenhumaElegivel(eleg, dados.tipoAnalise))
    dados.seguradoras = eleg.siglas

    const r = await transmitirAnalise(admin, dados, {
      userId: link.user_id,
      analiseId: analise.id,
      cnpjImobiliaria: prov.cnpjCpf,
    })

    await gravarPareceres(admin, analise.id, r.pareceres)
    await admin.from('seguro_analises').update({
      maximiza_id: r.idExterno || null,
      status_resumo: resumirStatus(r.pareceres),
      // Regrava com a lista resolvida — é este payload que o
      // `incluirSolidarios` reenvia depois.
      payload: dados as unknown as Record<string, unknown>,
    }).eq('id', analise.id)

    return { ok: true }
  } catch (e) {
    const msg = mensagemDeErro(e, 'Falha ao enviar para a seguradora.')
    await admin.from('seguro_analises')
      .update({ status_resumo: 'erro', erro: msg })
      .eq('id', analise.id)
    await admin.from('seguro_analise_links').update({ erro: msg }).eq('id', link.id)

    // Pro inquilino, deu certo: os dados chegaram ao corretor, que
    // reenvia pelo painel. Expor erro de integração aqui só assusta.
    return { ok: true, avisoInterno: msg }
  }
}

/**
 * Cria ou atualiza o pretenso inquilino em `pessoas`.
 *
 * Casa por CPF/CNPJ dentro da carteira do corretor pra não duplicar quem
 * já é cliente. Só preenche campo vazio — o que o corretor já cadastrou
 * tem precedência sobre o que o inquilino digita no formulário.
 */
async function upsertPretensoInquilino(
  admin: ReturnType<typeof createAdminClient>,
  link: LinkAuth,
  input: PreenchimentoInput,
  doc: string,
): Promise<string | null> {
  const existenteId = link.pessoa_id ?? await (async () => {
    const { data, error } = await admin
      .from('pessoas')
      .select('id')
      .eq('user_id', link.user_id)
      .eq('cpf_cnpj', doc)
      .is('deleted_at', null)
      .maybeSingle()
    // Falha na busca não pode virar "não existe": criaria um cadastro
    // duplicado pra quem já é cliente do corretor.
    if (error) throw new Error(`Falha ao procurar o cadastro: ${error.message}`)
    return data?.id ?? null
  })()

  if (existenteId) {
    const { data: atual } = await admin
      .from('pessoas')
      .select('email, telefone, whatsapp, data_nascimento')
      .eq('id', existenteId)
      .maybeSingle()

    const patch: Record<string, unknown> = {}
    if (!atual?.email && input.email) patch.email = input.email.trim()
    if (!atual?.telefone && input.celular) patch.telefone = input.celular
    if (!atual?.whatsapp && input.celular) patch.whatsapp = input.celular
    if (!atual?.data_nascimento && input.dataNascimento) patch.data_nascimento = input.dataNascimento

    if (Object.keys(patch).length) {
      await admin.from('pessoas').update(patch).eq('id', existenteId)
    }
    return existenteId
  }

  const { data, error } = await admin
    .from('pessoas')
    .insert({
      user_id: link.user_id,
      tipo: 'inquilino',
      nome: input.nome.trim(),
      cpf_cnpj: doc,
      email: input.email.trim(),
      telefone: input.celular,
      whatsapp: input.celular,
      data_nascimento: input.dataNascimento || null,
      observacoes: 'Cadastrado pelo formulário de análise de seguro fiança.',
    })
    .select('id')
    .single()

  // O lead é o ativo mais valioso deste fluxo. Se não deu pra gravar, a
  // análise não pode seguir em silêncio sem inquilino vinculado.
  if (error || !data) {
    throw new Error(`Falha ao gravar o cadastro: ${error?.message ?? 'sem retorno'}`)
  }
  return data.id
}
