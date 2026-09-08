import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { cadastrarImobiliaria, consultarImobiliaria, type ImobiliariaDados } from './index'
import { ambienteMaximiza } from './maximiza/client'
import { separarDdd } from './maximiza/mapper'

/**
 * Provisionamento do corretor do lado da corretora.
 *
 * A API exige `imobiliaria.cnpj` em toda análise de produção — ou seja,
 * cada usuário do CRM precisa existir lá como "imobiliária", com o próprio
 * CPF/CNPJ. Este módulo faz a ponte entre `perfis` e esse cadastro,
 * guardando o vínculo em `seguro_imobiliarias`.
 *
 * Roda uma vez, no primeiro uso do módulo de seguros.
 */

type Admin = ReturnType<typeof createAdminClient>

interface Perfil {
  nome: string | null
  cpf: string | null
  cnpj: string | null
  razao_social: string | null
  telefone: string | null
  endereco_cep: string | null
  endereco_logradouro: string | null
  endereco_numero: string | null
  endereco_bairro: string | null
  endereco_cidade: string | null
  endereco_uf: string | null
}

// `perfis` NÃO tem coluna email — ele vive em auth.users e é lido à parte.
const CAMPOS_PERFIL =
  'nome, cpf, cnpj, razao_social, telefone, ' +
  'endereco_cep, endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_uf'

/** Rótulos pra mensagem de erro apontar o campo que falta no perfil. */
const OBRIGATORIOS: [keyof Perfil, string][] = [
  ['nome', 'nome'],
  ['telefone', 'telefone'],
  ['endereco_cep', 'CEP'],
  ['endereco_logradouro', 'endereço'],
  ['endereco_numero', 'número'],
  ['endereco_bairro', 'bairro'],
  ['endereco_cidade', 'cidade'],
  ['endereco_uf', 'UF'],
]

/** O e-mail do corretor vem da conta de autenticação. */
async function emailDoUsuario(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId)
  return data?.user?.email ?? null
}

/**
 * CNPJ de imobiliária que a Maximiza liberou para os nossos testes
 * (`MAXIMIZA_CNPJ_TESTE`). É a REDE DE SEGURANÇA de homologação, para quem
 * não tem cadastro na base deles — quem tem passa pelo próprio, e a
 * escolha entre os dois é de `cnpjParaHomologacao()`.
 *
 * Só vale em ambiente 2 — em produção, cada corretor responde pelo próprio
 * CNPJ, e uma análise emitida sob o CNPJ de teste seria apólice no nome de
 * outra empresa. Por isso a checagem de ambiente vem primeiro e o resultado
 * NÃO é gravado em `seguro_imobiliarias`: o vínculo real do corretor não
 * pode ser contaminado por uma sessão de teste.
 */
function cnpjDeTeste(): string | null {
  const cnpj = (process.env.MAXIMIZA_CNPJ_TESTE ?? '').replace(/\D/g, '')
  if (!cnpj) return null
  return ambienteMaximiza() === 2 ? cnpj : null
}

/**
 * O CNPJ de quem ABRIU a sessão de homologação, quando quem está cotando
 * é um convidado.
 *
 * O convidado é a equipe técnica da corretora. Ele não tem imobiliária,
 * não tem CNPJ e não tem perfil para completar — e é justamente o cadastro
 * da NOSSA imobiliária que ele foi convidado a conferir. Sem isto, em
 * produção ele abre "Nova cotação" e recebe "Complete seu perfil: falta
 * telefone, CEP, endereço…", com um botão que o devolve para a tela
 * inicial porque o resto do CRM é barrado para ele. Foi o que aconteceu em
 * 08/09/2026, minutos depois de o link ser enviado.
 *
 * Devolve null para qualquer outro usuário — quem tem imobiliária própria
 * responde pelo próprio CNPJ, como sempre. E a sessão é revalidada aqui
 * (prazo e revogação) em vez de confiar no cookie: um link revogado deixa
 * de cotar sob o nosso CNPJ na hora.
 */
async function cnpjDoAnfitriao(admin: Admin, userId: string): Promise<string | null> {
  const { data: sessao } = await admin
    .from('sessoes_homologacao')
    .select('criado_por')
    .eq('usuario_id', userId)
    .is('revogada_em', null)
    .gt('expira_em', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const anfitriao = (sessao as { criado_por?: string } | null)?.criado_por
  if (!anfitriao) return null

  return documentoDoPerfil(admin, anfitriao)
}

/** Só o documento do perfil, sem exigir que o resto esteja completo. */
async function documentoDoPerfil(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin
    .from('perfis').select('cpf, cnpj').eq('id', userId).maybeSingle()
  const p = data as { cpf?: string | null; cnpj?: string | null } | null
  const doc = (p?.cnpj ?? p?.cpf ?? '').replace(/\D/g, '')
  return doc || null
}

/**
 * Qual CPF/CNPJ usar quando estamos em homologação.
 *
 * Até 30/08/2026 isto era simplesmente "o CNPJ de teste, sempre": a base
 * de homologação da corretora não tinha o cadastro de ninguém nosso, e
 * cotar com o CNPJ real voltava imobiliária não encontrada antes de
 * exercitar o fluxo.
 *
 * Deixou de ser verdade. Em 28/08/2026 a Maximiza habilitou a IMOBILIATTO,
 * e `consultarImobiliaria` passou a responder 201 para 45.528.182/0001-06
 * — com as quatro seguradoras de fiança ligadas, contra só a Porto no
 * CNPJ de teste. Continuar trocando esconderia justamente o que se quer
 * medir: uma cotação que "passa" sob outro CNPJ não prova nada sobre o
 * cadastro que eles acabaram de liberar.
 *
 * Então tenta o do corretor primeiro e cai no de teste quando ele não
 * responde — o que continua sendo o caso do convidado da sessão de
 * homologação, que não tem perfil nenhum.
 *
 * O resultado NÃO é gravado em `seguro_imobiliarias`: aquela linha guarda
 * `cod_alfa` e `cod_porto`, que são códigos da base de homologação e não
 * valem em produção. Uma consulta a mais por cotação é barata — não cria
 * registro, e homologação não tem volume.
 */
async function cnpjParaHomologacao(admin: Admin, userId: string): Promise<string | null> {
  const teste = cnpjDeTeste()
  if (!teste) return null

  /**
   * Escape hatch temporário: `MAXIMIZA_FORCAR_CNPJ_TESTE=1` volta ao CNPJ
   * de teste mesmo com o cadastro próprio respondendo.
   *
   * Existe porque estar cadastrado não é o mesmo que estar funcionando.
   * Medido em 30/08/2026, MESMO payload, só trocando `cpfcnpj_imob`:
   *
   *   45528182000106 (IMOBILIATTO)  → 400 "Erro em EnviaCertificadoXML.
   *                                       Usuário e/ou Senha Inválidos!"
   *   10961528000180 (teste)        → 201, prêmio 251,69
   *
   * Vale para Alfa e para Porto, então não é credencial de uma seguradora:
   * é o cadastro da IMOBILIATTO que a corretora criou sem provisionar as
   * credenciais das seguradoras em homologação. Enquanto eles não
   * arrumam, isto permite exercitar o resto do fluxo.
   *
   * Sai daqui quando a cotação sob a IMOBILIATTO voltar 201.
   */
  if (process.env.MAXIMIZA_FORCAR_CNPJ_TESTE === '1') return teste

  const proprio = await documentoDoPerfil(admin, userId)
  if (proprio && proprio !== teste) {
    // Só o CNPJ próprio quando a consulta CONFIRMA que ele responde lá.
    // Consulta indisponível cai no de teste, que é o comportamento seguro
    // em homologação: nada é emitido de verdade sob nenhum dos dois.
    const consulta = await consultarImobiliaria(admin, proprio, userId)
    if (consulta.estado === 'encontrada') return proprio
  }
  return teste
}

export interface StatusProvisionamento {
  pronto: boolean
  cnpjCpf?: string
  faltando?: string[]
}

/**
 * O perfil tem tudo que a corretora exige?
 *
 * Checagem local, sem tocar na API — serve pra tela avisar antes de o
 * corretor preencher uma análise inteira e só então descobrir o problema.
 */
export async function verificarPerfilParaSeguros(
  admin: Admin,
  userId: string,
): Promise<StatusProvisionamento> {
  /**
   * Mesma primeira linha de `garantirImobiliaria`, e pela mesma razão.
   *
   * Em homologação a cotação sai sob o CNPJ de teste: o perfil do usuário
   * não é lido nem enviado. Dizer "complete seu perfil antes de cotar"
   * seria pedir uma coisa que não muda nada e bloquear uma tela que
   * funcionaria.
   *
   * Foi o que aconteceu com o convidado da corretora: ele abria "Nova
   * cotação" e, em vez do formulário, recebia um aviso para completar um
   * cadastro que ele não tem como completar. Vale para o corretor também
   * — em ambiente 2 o aviso mentia para todo mundo.
   *
   * Em produção `cnpjDeTeste()` devolve null e a exigência volta inteira,
   * que é quando ela passa a ser verdade.
   */
  const teste = cnpjDeTeste()
  if (teste) return { pronto: true, cnpjCpf: teste }

  // Convidado de homologação: coteja sob o CNPJ de quem o convidou, então
  // não há perfil dele a completar. Ver `cnpjDoAnfitriao`.
  const anfitriao = await cnpjDoAnfitriao(admin, userId)
  if (anfitriao) return { pronto: true, cnpjCpf: anfitriao }

  const { data, error } = await admin
    .from('perfis').select(CAMPOS_PERFIL).eq('id', userId).maybeSingle()

  // Erro de consulta não é "perfil incompleto" — dizer isso mandaria o
  // corretor preencher um cadastro que já está certo.
  if (error) return { pronto: false, faltando: [`falha ao ler o perfil: ${error.message}`] }

  const perfil = data as unknown as Perfil | null
  if (!perfil) return { pronto: false, faltando: ['perfil não encontrado'] }

  const faltando = OBRIGATORIOS
    .filter(([campo]) => !String(perfil[campo] ?? '').trim())
    .map(([, rotulo]) => rotulo)

  const doc = (perfil.cnpj ?? perfil.cpf ?? '').replace(/\D/g, '')
  if (!doc) faltando.push('CPF ou CNPJ')

  if (!await emailDoUsuario(admin, userId)) faltando.push('e-mail da conta')

  return faltando.length
    ? { pronto: false, faltando }
    : { pronto: true, cnpjCpf: doc }
}

/**
 * Garante que o usuário existe na corretora e devolve o CPF/CNPJ a usar
 * nas análises. Consulta primeiro; só cadastra se não existir.
 *
 * O resultado fica em `seguro_imobiliarias` — chamadas seguintes nem
 * tocam na API.
 */
export async function garantirImobiliaria(
  admin: Admin,
  userId: string,
): Promise<{ cnpjCpf?: string; error?: string }> {
  const homolog = await cnpjParaHomologacao(admin, userId)
  if (homolog) return { cnpjCpf: homolog }

  /**
   * Convidado de homologação: o CNPJ é o de quem abriu a sessão.
   *
   * Vem antes do vínculo e do perfil de propósito, e NÃO grava nada em
   * `seguro_imobiliarias` — o vínculo pertence à imobiliária de verdade e
   * não pode ser reescrito por uma visita.
   */
  const anfitriao = await cnpjDoAnfitriao(admin, userId)
  if (anfitriao) return { cnpjCpf: anfitriao }

  const { data: vinculo } = await admin
    .from('seguro_imobiliarias')
    .select('cnpj_cpf, maximiza_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (vinculo?.cnpj_cpf) return { cnpjCpf: vinculo.cnpj_cpf }

  const status = await verificarPerfilParaSeguros(admin, userId)
  if (!status.pronto || !status.cnpjCpf) {
    return { error: `Complete o perfil antes de usar seguros: falta ${status.faltando?.join(', ')}.` }
  }
  const cnpjCpf = status.cnpjCpf

  const { data, error: ePerfil } = await admin
    .from('perfis').select(CAMPOS_PERFIL).eq('id', userId).maybeSingle()
  // Sem esta checagem, uma falha de consulta viraria `perfil.cnpj` em null
  // e derrubaria a action com TypeError.
  if (ePerfil || !data) {
    return { error: `Não foi possível ler o perfil: ${ePerfil?.message ?? 'não encontrado'}` }
  }
  // select() com string dinâmica não é inferido pelo supabase-js.
  const perfil = data as unknown as Perfil

  const email = await emailDoUsuario(admin, userId)
  const ehPj = !!perfil.cnpj?.replace(/\D/g, '')
  const fone = separarDdd(perfil.telefone)

  const dados: ImobiliariaDados = {
    pessoa: ehPj ? 'J' : 'F',
    cpfCnpj: cnpjCpf,
    // Pessoa física não tem razão social: repetimos o nome, que é o que
    // a API espera nos dois campos obrigatórios.
    razao: perfil.razao_social ?? perfil.nome ?? '',
    fantasia: perfil.razao_social ?? perfil.nome ?? '',
    responsavelNome: perfil.nome ?? '',
    responsavelCpf: (perfil.cpf ?? '').replace(/\D/g, '') || cnpjCpf,
    cep: (perfil.endereco_cep ?? '').replace(/\D/g, ''),
    endereco: perfil.endereco_logradouro ?? '',
    numero: perfil.endereco_numero ?? '',
    bairro: perfil.endereco_bairro ?? '',
    cidade: perfil.endereco_cidade ?? '',
    uf: perfil.endereco_uf ?? '',
    ddd: fone.ddd,
    fone: fone.numero,
    email: email ?? '',
  }

  // Pode já existir lá de um cadastro feito fora da plataforma.
  const consulta = await consultarImobiliaria(admin, cnpjCpf, userId)

  /**
   * Consulta que não respondeu NÃO é cadastro inexistente.
   *
   * Seguir daqui com "não achei" faria o passo seguinte cadastrar um CNPJ
   * que provavelmente já está lá — e cadastrar cria registro na base deles,
   * que não temos como desfazer. Melhor devolver erro e o corretor tentar de
   * novo em um minuto.
   */
  if (consulta.estado === 'indisponivel') {
    return {
      error:
        'Não foi possível confirmar seu cadastro na corretora agora ' +
        `(${consulta.erro}). Tente de novo em instantes — seguir sem essa ` +
        'confirmação criaria um cadastro duplicado lá.',
    }
  }
  const existente = consulta.estado === 'encontrada' ? consulta.dados : null

  let maximizaId: number | null = null
  if (!existente) {
    try {
      const r = await cadastrarImobiliaria(admin, dados, userId)
      maximizaId = r.id || null
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Falha ao cadastrar na corretora.' }
    }
  }

  const { error } = await admin.from('seguro_imobiliarias').upsert({
    user_id: userId,
    cnpj_cpf: cnpjCpf,
    maximiza_id: maximizaId,
    cod_alfa: numeroOuNulo(existente?.cod_alfa),
    cod_porto: numeroOuNulo(existente?.cod_porto),
    razao: dados.razao,
    fantasia: dados.fantasia,
    responsavel_nome: dados.responsavelNome,
    responsavel_cpf: dados.responsavelCpf,
    dados: existente ?? {},
    sincronizado_em: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) return { error: error.message }

  return { cnpjCpf }
}

function numeroOuNulo(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}
