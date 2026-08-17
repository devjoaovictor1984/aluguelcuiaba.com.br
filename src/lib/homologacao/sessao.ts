import 'server-only'
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Sessão de homologação — a equipe técnica da corretora cotando aqui
 * dentro, com validade e sem enxergar dado de cliente real.
 *
 * A identidade é o ponto do desenho. A sessão NÃO encarna o dono da
 * conta: encarna um usuário próprio, de role 'homologacao'. Como toda
 * listagem do módulo de seguros filtra por `user_id`, o isolamento cai
 * de graça — eles veem só o que eles mesmos criaram. Se a sessão usasse
 * o id do corretor, a primeira tela que abrissem seria a lista de
 * análises com o CPF dos inquilinos dele.
 *
 * O que a role alcança está em `exigirAcessoSeguros`, e é só o módulo de
 * seguros. `exigirAcessoCRM` continua barrando (plano free, sem
 * crm_ativo) e todo /admin exige 'admin'.
 */

const COOKIE_SESSAO = 'homologacao_sessao'
const EMAIL_CONVIDADO = 'homologacao@aluguelcuiaba.com.br'

export interface SessaoHomologacao {
  id: string
  usuarioId: string
  nome: string
  organizacao: string | null
  expiraEm: string
}

/* ── Criação ───────────────────────────────────────────────────────── */

/**
 * O usuário que as sessões encarnam. Criado sob demanda, reaproveitado
 * entre sessões: o isolamento que importa é em relação aos dados reais,
 * não entre um convidado e outro — e um usuário só mantém o histórico de
 * testes junto, que é o que a gente quer ler depois.
 *
 * Senha aleatória e descartada: o acesso se dá por link de sessão gerado
 * pelo servidor, nunca por senha.
 */
async function garantirUsuarioConvidado(
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ id?: string; error?: string }> {
  const { data: perfil } = await admin
    .from('perfis')
    .select('id')
    .eq('role', 'homologacao')
    .limit(1)
    .maybeSingle()

  if (perfil?.id) return { id: perfil.id }

  const { data: criado, error } = await admin.auth.admin.createUser({
    email: EMAIL_CONVIDADO,
    password: randomBytes(24).toString('hex'),
    email_confirm: true,
    user_metadata: { nome: 'Homologação — corretora' },
  })

  // Pode já existir em auth.users sem perfil com a role (sessão anterior
  // apagada, por exemplo). Recupera em vez de falhar.
  if (error || !criado?.user) {
    const { data: lista } = await admin.auth.admin.listUsers()
    const existente = lista?.users.find(u => u.email === EMAIL_CONVIDADO)
    if (!existente) return { error: error?.message ?? 'Não foi possível criar o usuário de homologação.' }
    await admin.from('perfis').upsert(perfilConvidado(existente.id))
    return { id: existente.id }
  }

  const { error: ePerfil } = await admin.from('perfis').upsert(perfilConvidado(criado.user.id))
  if (ePerfil) return { error: `Usuário criado, mas o perfil falhou: ${ePerfil.message}` }

  return { id: criado.user.id }
}

/**
 * O perfil do convidado, explícito de ponta a ponta.
 *
 * `plano: 'free'` e `crm_ativo: false` não são detalhe: é o par que faz
 * `exigirAcessoCRM` continuar barrando o resto do CRM. Deixar em branco
 * para o banco resolver funcionaria hoje e viraria brecha no dia em que
 * o default mudasse.
 */
function perfilConvidado(id: string) {
  return {
    id,
    nome: 'Homologação — corretora',
    tipo: 'corretor',
    plano: 'free',
    crm_ativo: false,
    role: 'homologacao',
  }
}

export async function criarSessao(input: {
  criadoPor: string
  nome: string
  organizacao?: string | null
  observacao?: string | null
  dias: number
}): Promise<{ token?: string; error?: string }> {
  const admin = createAdminClient()

  const convidado = await garantirUsuarioConvidado(admin)
  if (convidado.error || !convidado.id) return { error: convidado.error }

  const token = randomBytes(32).toString('base64url')
  const expira = new Date(Date.now() + Math.max(1, input.dias) * 86400_000)

  const { error } = await admin.from('sessoes_homologacao').insert({
    criado_por: input.criadoPor,
    usuario_id: convidado.id,
    token,
    nome: input.nome.trim(),
    organizacao: input.organizacao?.trim() || null,
    observacao: input.observacao?.trim() || null,
    expira_em: expira.toISOString(),
  })
  if (error) return { error: error.message }

  return { token }
}

/* ── Validação ─────────────────────────────────────────────────────── */

type Motivo = 'inexistente' | 'revogada' | 'expirada'

export async function abrirSessao(
  token: string,
): Promise<{ sessao?: SessaoHomologacao; motivo?: Motivo }> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('sessoes_homologacao')
    .select('id, usuario_id, nome, organizacao, expira_em, revogada_em, primeiro_acesso_em, acessos')
    .eq('token', token)
    .maybeSingle()

  if (!data) return { motivo: 'inexistente' }
  if (data.revogada_em) return { motivo: 'revogada' }
  if (new Date(data.expira_em).getTime() < Date.now()) return { motivo: 'expirada' }

  const agora = new Date().toISOString()
  await admin.from('sessoes_homologacao').update({
    ultimo_acesso_em: agora,
    primeiro_acesso_em: data.primeiro_acesso_em ?? agora,
    acessos: (data.acessos ?? 0) + 1,
  }).eq('id', data.id)

  return {
    sessao: {
      id: data.id,
      usuarioId: data.usuario_id,
      nome: data.nome,
      organizacao: data.organizacao,
      expiraEm: data.expira_em,
    },
  }
}

/**
 * A sessão em curso, lida do cookie e RECONFERIDA no banco.
 *
 * Reconferir a cada chamada é o que faz "Revogar" ter efeito imediato:
 * cookie é cópia, e cópia não sabe que foi cancelada.
 */
export async function sessaoAtual(): Promise<SessaoHomologacao | null> {
  const jar = await cookies()
  const id = jar.get(COOKIE_SESSAO)?.value
  if (!id) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('sessoes_homologacao')
    .select('id, usuario_id, nome, organizacao, expira_em, revogada_em')
    .eq('id', id)
    .maybeSingle()

  if (!data || data.revogada_em) return null
  if (new Date(data.expira_em).getTime() < Date.now()) return null

  return {
    id: data.id,
    usuarioId: data.usuario_id,
    nome: data.nome,
    organizacao: data.organizacao,
    expiraEm: data.expira_em,
  }
}

export async function marcarCookieSessao(sessaoId: string, expiraEm: string): Promise<void> {
  const jar = await cookies()
  jar.set(COOKIE_SESSAO, sessaoId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiraEm),
  })
}

export async function limparCookieSessao(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE_SESSAO)
}
