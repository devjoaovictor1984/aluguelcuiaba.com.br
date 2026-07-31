import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { cadastrarImobiliaria, consultarImobiliaria, type ImobiliariaDados } from './index'
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
  email: string | null
  telefone: string | null
  endereco_cep: string | null
  endereco_logradouro: string | null
  endereco_numero: string | null
  endereco_bairro: string | null
  endereco_cidade: string | null
  endereco_uf: string | null
}

const CAMPOS_PERFIL =
  'nome, cpf, cnpj, razao_social, email, telefone, ' +
  'endereco_cep, endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_uf'

/** Rótulos pra mensagem de erro apontar o campo que falta no perfil. */
const OBRIGATORIOS: [keyof Perfil, string][] = [
  ['nome', 'nome'],
  ['email', 'e-mail'],
  ['telefone', 'telefone'],
  ['endereco_cep', 'CEP'],
  ['endereco_logradouro', 'endereço'],
  ['endereco_numero', 'número'],
  ['endereco_bairro', 'bairro'],
  ['endereco_cidade', 'cidade'],
  ['endereco_uf', 'UF'],
]

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
  const { data } = await admin
    .from('perfis').select(CAMPOS_PERFIL).eq('id', userId).maybeSingle()

  const perfil = data as unknown as Perfil | null
  if (!perfil) return { pronto: false, faltando: ['perfil não encontrado'] }

  const faltando = OBRIGATORIOS
    .filter(([campo]) => !String(perfil[campo] ?? '').trim())
    .map(([, rotulo]) => rotulo)

  const doc = (perfil.cnpj ?? perfil.cpf ?? '').replace(/\D/g, '')
  if (!doc) faltando.push('CPF ou CNPJ')

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

  const { data } = await admin
    .from('perfis').select(CAMPOS_PERFIL).eq('id', userId).maybeSingle()
  // select() com string dinâmica não é inferido pelo supabase-js.
  const perfil = data as unknown as Perfil

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
    email: perfil.email ?? '',
  }

  // Pode já existir lá de um cadastro feito fora da plataforma.
  const existente = await consultarImobiliaria(admin, cnpjCpf, userId)

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
