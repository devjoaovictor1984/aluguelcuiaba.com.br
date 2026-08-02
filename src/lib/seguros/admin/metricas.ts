import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { statusAprovado } from '../tabelas'
import { estimarProLabore } from '../incendio/sugestoes'

/**
 * Agregações da parceria, para o operador da plataforma.
 *
 * O painel do corretor responde "o que aconteceu com esta apólice". Este
 * responde "quanto a plataforma originou, para quem, e a integração está
 * de pé" — que é o que sustenta a conversa de comissão com a corretora.
 *
 * Tudo com service-role: RLS é por usuário e aqui é justamente a visão
 * cruzada. As rotas de /admin já exigem role=admin.
 */

type Admin = ReturnType<typeof createAdminClient>

export interface ResumoProduto {
  analises: number
  aprovadas: number
  contratadas: number
  premioTotal: number
}

export interface ResumoCorretor {
  userId: string
  nome: string | null
  cnpjCpf: string | null
  provisionadoEm: string | null
  fiancaAnalises: number
  fiancaAprovadas: number
  fiancaContratadas: number
  fiancaPremio: number
  incendioCotacoes: number
  incendioContratadas: number
  incendioPremio: number
  premioTotal: number
}

export interface SaudeIntegracao {
  chamadas24h: number
  erros24h: number
  ultimoErro: { endpoint: string; erro: string; em: string } | null
  ultimoEvento: string | null
  webhooks24h: number
}

/**
 * Janela padrão do painel: 30 dias corridos.
 *
 * Não usamos "mês corrente" porque no dia 1º o painel apareceria vazio e
 * pareceria quebrado. A conciliação por competência tem lugar próprio —
 * a tela de faturamento, que filtra por mês/ano como a corretora fatura.
 */
export const JANELA_DIAS = 30

function desdeJanela(): string {
  return new Date(Date.now() - JANELA_DIAS * 86400000).toISOString()
}

/**
 * Números do período por produto.
 *
 * "Aprovadas" só existe na fiança — o incêndio não tem análise de crédito,
 * então cotação já é cotação válida.
 */
export async function resumoDoMes(admin: Admin): Promise<{
  fianca: ResumoProduto
  incendio: ResumoProduto
  overrideEstimado: number
}> {
  const desde = desdeJanela()

  const [analises, pareceres, contratacoes, incendio] = await Promise.all([
    admin.from('seguro_analises')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', desde),
    admin.from('seguro_analise_pareceres')
      .select('analise_id, codigo_status')
      .gte('created_at', desde),
    admin.from('seguro_contratacoes')
      .select('premio_total, status')
      .gte('created_at', desde),
    admin.from('seguro_incendio_apolices')
      .select('premio_total, status')
      .gte('created_at', desde),
  ])

  // Uma análise conta como aprovada se QUALQUER seguradora aprovou.
  const aprovadas = new Set(
    (pareceres.data ?? [])
      .filter(p => statusAprovado(p.codigo_status))
      .map(p => p.analise_id),
  ).size

  const fiancaContratadas = (contratacoes.data ?? [])
    .filter(c => c.status === 'enviada' || c.status === 'emitida')
  const fiancaPremio = fiancaContratadas.reduce((s, c) => s + (Number(c.premio_total) || 0), 0)

  const incendioTodas = incendio.data ?? []
  const incendioContratadas = incendioTodas.filter(a => a.status === 'contratada')
  const incendioPremio = incendioContratadas.reduce((s, a) => s + (Number(a.premio_total) || 0), 0)

  return {
    fianca: {
      analises: analises.count ?? 0,
      aprovadas,
      contratadas: fiancaContratadas.length,
      premioTotal: fiancaPremio,
    },
    incendio: {
      analises: incendioTodas.length,
      aprovadas: incendioTodas.filter(a => a.status !== 'rascunho' && a.status !== 'erro').length,
      contratadas: incendioContratadas.length,
      premioTotal: incendioPremio,
    },
    // Base de negociação, não valor a receber: a tabela da corretora ainda
    // não está definida. Usa o pró-labore de 20% que aparece no painel
    // deles como referência.
    overrideEstimado: estimarProLabore(fiancaPremio + incendioPremio),
  }
}

/**
 * Volume por corretor — a base do override.
 *
 * É a tabela que sustenta a conversa com a corretora: quantas apólices
 * saíram por cada imobiliária que a plataforma provisionou.
 */
export async function volumePorCorretor(admin: Admin): Promise<ResumoCorretor[]> {
  // Mesma janela dos cartões: números que se contradizem na mesma tela
  // custam mais confiança do que valem em informação.
  const desde = desdeJanela()

  const [imobiliarias, perfis, analises, pareceres, contratacoes, incendio] = await Promise.all([
    admin.from('seguro_imobiliarias').select('user_id, cnpj_cpf, sincronizado_em'),
    admin.from('perfis').select('id, nome, razao_social'),
    admin.from('seguro_analises').select('id, user_id').gte('created_at', desde),
    admin.from('seguro_analise_pareceres').select('analise_id, codigo_status').gte('created_at', desde),
    admin.from('seguro_contratacoes').select('user_id, premio_total, status').gte('created_at', desde),
    admin.from('seguro_incendio_apolices').select('user_id, premio_total, status').gte('created_at', desde),
  ])

  const nomePorId = new Map(
    (perfis.data ?? []).map(p => [p.id, p.razao_social ?? p.nome]),
  )
  const analisePorUser = new Map<string, string[]>()
  for (const a of analises.data ?? []) {
    const lista = analisePorUser.get(a.user_id) ?? []
    lista.push(a.id)
    analisePorUser.set(a.user_id, lista)
  }

  const aprovadasIds = new Set(
    (pareceres.data ?? [])
      .filter(p => statusAprovado(p.codigo_status))
      .map(p => p.analise_id),
  )

  // Usuários que aparecem em qualquer lugar, mesmo sem provisionamento —
  // não queremos esconder quem cotou.
  const userIds = new Set<string>([
    ...(imobiliarias.data ?? []).map(i => i.user_id),
    ...analisePorUser.keys(),
    ...(contratacoes.data ?? []).map(c => c.user_id),
    ...(incendio.data ?? []).map(a => a.user_id),
  ])

  const linhas: ResumoCorretor[] = [...userIds].map(userId => {
    const imob = (imobiliarias.data ?? []).find(i => i.user_id === userId)
    const ids = analisePorUser.get(userId) ?? []

    const fContratadas = (contratacoes.data ?? [])
      .filter(c => c.user_id === userId && (c.status === 'enviada' || c.status === 'emitida'))
    const fPremio = fContratadas.reduce((s, c) => s + (Number(c.premio_total) || 0), 0)

    const iTodas = (incendio.data ?? []).filter(a => a.user_id === userId)
    const iContratadas = iTodas.filter(a => a.status === 'contratada')
    const iPremio = iContratadas.reduce((s, a) => s + (Number(a.premio_total) || 0), 0)

    return {
      userId,
      nome: nomePorId.get(userId) ?? null,
      cnpjCpf: imob?.cnpj_cpf ?? null,
      provisionadoEm: imob?.sincronizado_em ?? null,
      fiancaAnalises: ids.length,
      fiancaAprovadas: ids.filter(id => aprovadasIds.has(id)).length,
      fiancaContratadas: fContratadas.length,
      fiancaPremio: fPremio,
      incendioCotacoes: iTodas.length,
      incendioContratadas: iContratadas.length,
      incendioPremio: iPremio,
      premioTotal: fPremio + iPremio,
    }
  })

  return linhas.sort((a, b) => b.premioTotal - a.premioTotal)
}

/**
 * Saúde da integração.
 *
 * Se a corretora mudar a API ou derrubar o ambiente, é aqui que aparece
 * antes de virar reclamação de corretor.
 */
export async function saudeIntegracao(admin: Admin): Promise<SaudeIntegracao> {
  const desde = new Date(Date.now() - 86400000).toISOString()

  const [total, comErro, ultimo, entradas] = await Promise.all([
    admin.from('seguro_eventos')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', desde),
    admin.from('seguro_eventos')
      .select('endpoint, erro, created_at')
      .not('erro', 'is', null)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(1),
    admin.from('seguro_eventos')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from('seguro_eventos')
      .select('id', { count: 'exact', head: true })
      .eq('direcao', 'entrada')
      .gte('created_at', desde),
  ])

  const { count: erros } = await admin.from('seguro_eventos')
    .select('id', { count: 'exact', head: true })
    .not('erro', 'is', null)
    .gte('created_at', desde)

  const e = comErro.data?.[0]

  return {
    chamadas24h: total.count ?? 0,
    erros24h: erros ?? 0,
    ultimoErro: e ? { endpoint: e.endpoint, erro: e.erro ?? '', em: e.created_at } : null,
    ultimoEvento: ultimo.data?.created_at ?? null,
    webhooks24h: entradas.count ?? 0,
  }
}
