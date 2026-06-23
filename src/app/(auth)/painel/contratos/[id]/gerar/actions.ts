'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { CATEGORIAS_ORDEM } from '@/lib/contratos/placeholders'
import { contratoAssinado, MSG_CONTRATO_TRAVADO } from '@/lib/crm/assinatura-lock'

type SB = Awaited<ReturnType<typeof createClient>>

/** Cláusula DESTE contrato (snapshot editável, independente do banco genérico). */
export interface ClausulaSnapshot {
  id: string
  titulo: string
  corpo: string
  categoria: string
  tipo: string
  /** Marcada pelo corretor como alterada na negociação — realça no modo modificações. */
  modificada?: boolean
}

type TipoSeguroIncendio = 'dispensado' | 'cobrado_parte' | 'embutido_pacote'
type TipoAtuacao = 'administracao' | 'intermediacao' | 'direto'
type TipoMobilia = 'sem' | 'semi' | 'parcial' | 'total'
type AceitaPet = 'sim' | 'nao' | 'autorizacao' | 'condominio'
type Finalidade = 'residencial' | 'comercial' | 'misto'

export interface OpcoesGeracao {
  tipo_seguro_incendio: TipoSeguroIncendio
  saida_sem_multa_12m: boolean
}

interface ContratoContext {
  garantiaTipo: string
  tipoSeguroIncendio: TipoSeguroIncendio
  tipoAtuacao: TipoAtuacao
  tipoMobilia: TipoMobilia
  aceitaPet: AceitaPet
  /** true se alguma flag aluguel_inclui_* estiver marcada → usa variantes "pacote" das cláusulas 7/16 */
  aluguelPacote: boolean
  /** true SOMENTE quando IPTU+Condomínio inclusos (e mais nada) → variante específica e mais natural */
  pacoteIptuCondominio: boolean
  /** residencial usa objeto/destinação genéricos; comercial/misto usam variantes 'finalidade' */
  finalidade: Finalidade
}

/**
 * Seleciona quais cláusulas entram numa geração baseado nas opções:
 *  - todas as 'generica' (incluindo a "Das partes" da administração)
 *  - se intermediação/direto, substitui "Das partes" pela variante de 'atuacao'
 *  - 1 cláusula de fundamentação legal (no início)
 *  - 1 cláusula de garantia (tipo = contratos_locacao.garantia_tipo)
 *  - 1 cláusula de seguro_incendio (categoria = tipo_seguro_incendio)
 *  - 1 variante de mobília (tipo='mobilia', titulo casa com tipo_mobilia) + cláusula de inventário se mobiliado
 *  - 1 variante de pet (tipo='pet', titulo casa com aceita_pet) + cláusula de limpeza se aceita pet
 *
 * Retorna as cláusulas (conteúdo completo) ordenadas pelo número de cada uma.
 */
interface ClausulaRow {
  id: string
  tipo: string
  categoria: string
  numero: number
  titulo: string
  corpo: string
}

async function selecionarClausulasIniciais(
  supabase: SB,
  userId: string,
  ctx: ContratoContext,
): Promise<ClausulaRow[]> {
  const { data: clausulas } = await supabase
    .from('contrato_clausulas')
    .select('id, tipo, categoria, numero, titulo, corpo')
    .eq('user_id', userId)
    .eq('ativa', true)
    .order('numero', { ascending: true })

  if (!clausulas) return []

  // ── Atuação: define qual cláusula "Das partes" usar ──
  // - 'administracao' → cláusula genérica de "Das partes" (já existente, tipo 'generica' categoria 'partes')
  // - 'intermediacao' → tipo 'atuacao' com titulo contendo 'intermediação'
  // - 'direto'        → tipo 'atuacao' com titulo contendo 'direta'
  const usarPartesGenerica = ctx.tipoAtuacao === 'administracao'

  // ── Mobília: casa pelo titulo (variantes têm "imóvel sem mobília", "semi-mobiliado", etc) ──
  const mobiliaMatcher: Record<TipoMobilia, RegExp> = {
    sem: /sem mobília/i,
    semi: /semi-mobiliado/i,
    parcial: /parcialmente mobiliado/i,
    total: /100% mobiliado/i,
  }
  const temMobilia = ctx.tipoMobilia !== 'sem'

  // ── Pet ──
  const petMatcher: Record<AceitaPet, RegExp> = {
    nao: /não aceita/i,
    sim: /— aceita/i,
    autorizacao: /com autorização/i,
    condominio: /conforme condomínio/i,
  }
  const aceitaAlgumPet = ctx.aceitaPet !== 'nao'

  const selecionadas = clausulas.filter(c => {
    // Genéricas: sempre, EXCETO:
    //   - "Das partes" quando atuação != administração (vira variante 'atuacao')
    //   - "aluguel" e "obrigacoes_loc" quando aluguel pacote (vira variante 'aluguel_pacote')
    if (c.tipo === 'generica') {
      if (c.categoria === 'partes' && !usarPartesGenerica) return false
      if (ctx.aluguelPacote && (c.categoria === 'aluguel' || c.categoria === 'obrigacoes_loc')) return false
      // objeto/destinação genéricos (residenciais) saem quando finalidade != residencial
      if (ctx.finalidade !== 'residencial' && (c.categoria === 'objeto' || c.categoria === 'destinacao')) return false
      return true
    }

    // Finalidade: variantes de objeto/destinação pra comercial/misto
    if (c.tipo === 'finalidade') {
      if (ctx.finalidade === 'residencial') return false
      if (ctx.finalidade === 'comercial') return /comercial/i.test(c.titulo)
      if (ctx.finalidade === 'misto') return /misto/i.test(c.titulo)
      return false
    }

    // Aluguel pacote: variantes que substituem cláusula 7/16.
    //  - "pacote completo": só manual (nunca auto-injeta — evita duplicar)
    //  - "IPTU e condomínio inclusos": quando SÓ IPTU+cond inclusos
    //  - genérica ("valor e encargos"): demais combinações de pacote
    if (c.tipo === 'aluguel_pacote') {
      if (!ctx.aluguelPacote) return false
      const isCompleta = /pacote completo/i.test(c.titulo)
      if (isCompleta) return false  // opção manual — nunca auto-injeta
      const isEspecifica = /IPTU e condom/i.test(c.titulo) || /pacote IPTU \+ condom/i.test(c.titulo)
      if (ctx.pacoteIptuCondominio) return isEspecifica
      return !isEspecifica
    }

    // Fundamentação legal: sempre
    if (c.tipo === 'fundamentacao') return true

    // Atuação: só a variante que casa
    if (c.tipo === 'atuacao') {
      if (ctx.tipoAtuacao === 'intermediacao') return /intermediação/i.test(c.titulo)
      if (ctx.tipoAtuacao === 'direto') return /direta/i.test(c.titulo)
      return false
    }

    // Garantia
    if (c.tipo === ctx.garantiaTipo) return true

    // Seguro incêndio
    if (c.tipo === 'seguro_incendio' && c.categoria === ctx.tipoSeguroIncendio) return true

    // Mobília
    if (c.tipo === 'mobilia') {
      // Inventário: só se há mobília (qualquer variante)
      if (/inventário/i.test(c.titulo)) return temMobilia
      // Variante: só a que casa
      return mobiliaMatcher[ctx.tipoMobilia].test(c.titulo)
    }

    // Pet
    if (c.tipo === 'pet') {
      // Limpeza: só se aceita pet de alguma forma
      if (/limpeza/i.test(c.titulo)) return aceitaAlgumPet
      // Variante: só a que casa
      return petMatcher[ctx.aceitaPet].test(c.titulo)
    }

    return false
  })

  // Dedup: categorias essenciais devem ser ÚNICAS na seleção inicial.
  // Evita 2 cláusulas de aluguel, 2 de objeto, etc. (categorias livres como
  // 'adicional'/'custom' podem repetir).
  const CATEGORIAS_UNICAS = new Set([
    'fundamentacao', 'partes', 'objeto', 'prazo', 'aluguel', 'garantia',
    'reajuste', 'mora', 'obrigacoes_loc', 'obrigacoes_adm', 'rescisao', 'foro',
  ])
  const vistas = new Set<string>()
  const semDuplicatas = selecionadas.filter(c => {
    if (!CATEGORIAS_UNICAS.has(c.categoria)) return true
    if (vistas.has(c.categoria)) return false
    vistas.add(c.categoria)
    return true
  })

  // Ordena por CATEGORIAS_ORDEM e, dentro da mesma categoria, por número.
  // Garante que "Das partes" (categoria 'partes') vem antes de "objeto", etc.
  const idx = (cat: string) => {
    const i = (CATEGORIAS_ORDEM as readonly string[]).indexOf(cat)
    return i === -1 ? 999 : i
  }
  return semDuplicatas
    .sort((a, b) => {
      const ca = idx(a.categoria)
      const cb = idx(b.categoria)
      if (ca !== cb) return ca - cb
      return a.numero - b.numero
    })
    .map(c => ({ id: c.id, tipo: c.tipo, categoria: c.categoria, numero: c.numero, titulo: c.titulo, corpo: c.corpo }))
}

/** Converte rows do banco em snapshot (IDs novos, conteúdo copiado). */
function rowsParaSnapshot(rows: ClausulaRow[]): ClausulaSnapshot[] {
  return rows.map(c => ({ id: randomUUID(), titulo: c.titulo, corpo: c.corpo, categoria: c.categoria, tipo: c.tipo }))
}

// ── Helpers do snapshot de cláusulas DESTE contrato (não tocam o banco) ──
async function carregarSnap(supabase: SB, userId: string, geracaoId: string) {
  const { data: g } = await supabase
    .from('contrato_geracoes')
    .select('id, contrato_id, clausulas')
    .eq('id', geracaoId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' as const }
  return { g, clausulas: (g.clausulas ?? []) as ClausulaSnapshot[] }
}

async function salvarSnap(supabase: SB, userId: string, geracaoId: string, contratoId: string, clausulas: ClausulaSnapshot[]) {
  const { error } = await supabase
    .from('contrato_geracoes')
    .update({ clausulas })
    .eq('id', geracaoId)
    .eq('user_id', userId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${contratoId}/gerar`)
  return { ok: true }
}

/**
 * Cria uma geração nova pro contrato com defaults. Se já houver geração,
 * retorna a existente (a mais recente).
 */
export async function obterOuCriarGeracao(contratoId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  // Confirma posse do contrato
  const { data: contrato } = await supabase
    .from('contratos_locacao')
    .select('id, user_id, garantia_tipo, tipo_atuacao, tipo_mobilia, aceita_pet, finalidade, valor_seguro_incendio_anual, aluguel_inclui_iptu, aluguel_inclui_condominio, aluguel_inclui_agua, aluguel_inclui_energia, aluguel_inclui_gas, aluguel_inclui_internet')
    .eq('id', contratoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!contrato) return { error: 'Contrato não encontrado.' }

  // Default do seguro incêndio: se contrato tem valor anual > 0, presume cobrado à parte.
  // Caso contrário, deixa dispensado. Usuário pode trocar no editor.
  const seguroIncendioDefault: TipoSeguroIncendio =
    (contrato.valor_seguro_incendio_anual ?? 0) > 0 ? 'cobrado_parte' : 'dispensado'

  const aluguelPacote = !!(
    contrato.aluguel_inclui_iptu || contrato.aluguel_inclui_condominio ||
    contrato.aluguel_inclui_agua || contrato.aluguel_inclui_energia ||
    contrato.aluguel_inclui_gas || contrato.aluguel_inclui_internet
  )
  // Caso comum: SOMENTE IPTU + Condomínio inclusos. Usa variante específica.
  const pacoteIptuCondominio = !!(
    contrato.aluguel_inclui_iptu && contrato.aluguel_inclui_condominio &&
    !contrato.aluguel_inclui_agua && !contrato.aluguel_inclui_energia &&
    !contrato.aluguel_inclui_gas && !contrato.aluguel_inclui_internet
  )

  const ctx: ContratoContext = {
    garantiaTipo: contrato.garantia_tipo,
    tipoSeguroIncendio: seguroIncendioDefault,
    tipoAtuacao: (contrato.tipo_atuacao ?? 'administracao') as TipoAtuacao,
    tipoMobilia: (contrato.tipo_mobilia ?? 'sem') as TipoMobilia,
    aceitaPet: (contrato.aceita_pet ?? 'nao') as AceitaPet,
    aluguelPacote,
    pacoteIptuCondominio,
    finalidade: (contrato.finalidade ?? 'residencial') as Finalidade,
  }

  // Já existe geração?
  const { data: existente } = await supabase
    .from('contrato_geracoes')
    .select('*')
    .eq('contrato_id', contratoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existente) {
    let clausulas = (existente.clausulas ?? []) as ClausulaSnapshot[]
    // Backfill: gerações antigas (antes do snapshot) copiam o conteúdo do banco
    // pelos clausula_ids; se nada casar, refazem a seleção inicial.
    if (!Array.isArray(clausulas) || clausulas.length === 0) {
      const ids = (existente.clausula_ids ?? []) as string[]
      if (ids.length > 0) {
        const { data: bank } = await supabase
          .from('contrato_clausulas')
          .select('id, tipo, categoria, numero, titulo, corpo')
          .in('id', ids)
          .eq('user_id', acesso.userId)
        const mapa = new Map((bank ?? []).map(b => [b.id, b]))
        clausulas = ids
          .map(id => mapa.get(id))
          .filter((b): b is NonNullable<typeof b> => !!b)
          .map(b => ({ id: randomUUID(), titulo: b.titulo, corpo: b.corpo, categoria: b.categoria, tipo: b.tipo }))
      }
      if (clausulas.length === 0) {
        clausulas = rowsParaSnapshot(await selecionarClausulasIniciais(supabase, acesso.userId, ctx))
      }
      await supabase.from('contrato_geracoes')
        .update({ clausulas })
        .eq('id', existente.id).eq('user_id', acesso.userId)
    }
    return { ok: true, geracao: { ...existente, clausulas } }
  }

  // Cria nova com defaults — snapshot copiado do banco genérico
  const clausulas = rowsParaSnapshot(await selecionarClausulasIniciais(supabase, acesso.userId, ctx))

  const { data: nova, error } = await supabase
    .from('contrato_geracoes')
    .insert({
      user_id: acesso.userId,
      contrato_id: contratoId,
      tipo_seguro_incendio: seguroIncendioDefault,
      saida_sem_multa_12m: false,
      clausulas,
      clausula_ids: [],
      anexo_documento_ids: [],
      status: 'rascunho',
    })
    .select('*')
    .single()

  if (error || !nova) return { error: error?.message ?? 'Falha ao criar geração.' }
  // Sem revalidatePath: chamada durante render (page.tsx). Next 16 proíbe.
  // A página já tem force-dynamic.
  return { ok: true, geracao: nova }
}

/**
 * Atualiza as opções de uma geração. Se tipo_seguro_incendio mudou, troca a
 * cláusula de seguro incêndio DENTRO do snapshot (preservando as edições das
 * demais cláusulas), buscando a variante nova no banco genérico.
 */
export async function atualizarOpcoesGeracao(geracaoId: string, opcoes: OpcoesGeracao) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  if (await contratoAssinado(supabase, 'locacao', geracaoId)) return { error: MSG_CONTRATO_TRAVADO }

  const { data: atual } = await supabase
    .from('contrato_geracoes')
    .select('id, contrato_id, tipo_seguro_incendio, clausulas')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!atual) return { error: 'Geração não encontrada.' }

  let clausulas = (atual.clausulas ?? []) as ClausulaSnapshot[]

  // Trocou o tipo de seguro incêndio? Substitui a cláusula de seguro no snapshot.
  if (atual.tipo_seguro_incendio !== opcoes.tipo_seguro_incendio) {
    const { data: variante } = await supabase
      .from('contrato_clausulas')
      .select('tipo, categoria, titulo, corpo')
      .eq('user_id', acesso.userId)
      .eq('tipo', 'seguro_incendio')
      .eq('categoria', opcoes.tipo_seguro_incendio)
      .eq('ativa', true)
      .order('numero', { ascending: true })
      .limit(1)
      .maybeSingle()

    const idxSeguro = clausulas.findIndex(c => c.tipo === 'seguro_incendio')
    if (variante) {
      const nova: ClausulaSnapshot = {
        id: randomUUID(), titulo: variante.titulo, corpo: variante.corpo,
        categoria: variante.categoria, tipo: variante.tipo,
      }
      if (idxSeguro >= 0) clausulas = clausulas.map((c, i) => i === idxSeguro ? nova : c)
      else clausulas = [...clausulas, nova]
    } else if (idxSeguro >= 0) {
      // Sem variante no banco (ex: dispensado sem cláusula) → remove a anterior.
      clausulas = clausulas.filter((_, i) => i !== idxSeguro)
    }
  }

  const { error } = await supabase
    .from('contrato_geracoes')
    .update({
      tipo_seguro_incendio: opcoes.tipo_seguro_incendio,
      saida_sem_multa_12m: opcoes.saida_sem_multa_12m,
      clausulas,
    })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${atual.contrato_id}/gerar`)
  return { ok: true, clausulas }
}

/**
 * Reordena as cláusulas do snapshot (após drag-and-drop). `ordemIds` são os
 * IDs do snapshot na nova ordem.
 */
export async function atualizarOrdemClausulas(geracaoId: string, ordemIds: string[]) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (!Array.isArray(ordemIds)) return { error: 'Ordem inválida.' }
  if (await contratoAssinado(supabase, 'locacao', geracaoId)) return { error: MSG_CONTRATO_TRAVADO }

  const r = await carregarSnap(supabase, acesso.userId, geracaoId)
  if ('error' in r) return { error: r.error }

  const mapa = new Map(r.clausulas.map(c => [c.id, c]))
  const reordenadas = ordemIds.map(id => mapa.get(id)).filter((c): c is ClausulaSnapshot => !!c)
  for (const c of r.clausulas) if (!ordemIds.includes(c.id)) reordenadas.push(c)  // segurança

  return salvarSnap(supabase, acesso.userId, geracaoId, r.g.contrato_id, reordenadas)
}

/** Edita uma cláusula SÓ neste contrato (não toca o banco genérico). */
export async function editarClausulaGeracao(
  geracaoId: string, clausulaId: string,
  titulo: string, corpo: string, categoria?: string, tipo?: string,
) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  if (!titulo?.trim() || !corpo?.trim()) return { error: 'Título e corpo são obrigatórios.' }
  if (await contratoAssinado(supabase, 'locacao', geracaoId)) return { error: MSG_CONTRATO_TRAVADO }
  const r = await carregarSnap(supabase, acesso.userId, geracaoId)
  if ('error' in r) return { error: r.error }
  const clausulas = r.clausulas.map(c => c.id === clausulaId
    ? { ...c, titulo: titulo.trim(), corpo: corpo.trim(), categoria: categoria ?? c.categoria, tipo: tipo ?? c.tipo }
    : c)
  return salvarSnap(supabase, acesso.userId, geracaoId, r.g.contrato_id, clausulas)
}

/** Adiciona uma cláusula ao snapshot deste contrato (cópia do banco ou nova). */
export async function adicionarClausulaGeracao(
  geracaoId: string,
  clausula: { id?: string; titulo: string; corpo: string; categoria?: string; tipo?: string },
) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  if (!clausula.titulo?.trim() || !clausula.corpo?.trim()) return { error: 'Título e corpo são obrigatórios.' }
  if (await contratoAssinado(supabase, 'locacao', geracaoId)) return { error: MSG_CONTRATO_TRAVADO }
  const r = await carregarSnap(supabase, acesso.userId, geracaoId)
  if ('error' in r) return { error: r.error }
  const nova: ClausulaSnapshot = {
    id: clausula.id ?? randomUUID(),
    titulo: clausula.titulo.trim(),
    corpo: clausula.corpo.trim(),
    categoria: clausula.categoria ?? 'custom',
    tipo: clausula.tipo ?? 'adicional',
  }
  const res = await salvarSnap(supabase, acesso.userId, geracaoId, r.g.contrato_id, [...r.clausulas, nova])
  return res.error ? res : { ok: true, id: nova.id }
}

/** Liga/desliga a marca "modificada" de uma cláusula no snapshot deste contrato. */
export async function atualizarClausulaModificada(
  geracaoId: string, clausulaId: string, modificada: boolean,
) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  if (await contratoAssinado(supabase, 'locacao', geracaoId)) return { error: MSG_CONTRATO_TRAVADO }
  const r = await carregarSnap(supabase, acesso.userId, geracaoId)
  if ('error' in r) return { error: r.error }
  const clausulas = r.clausulas.map(c => c.id === clausulaId ? { ...c, modificada } : c)
  return salvarSnap(supabase, acesso.userId, geracaoId, r.g.contrato_id, clausulas)
}

/** Liga/desliga o modo modificações no PDF normal (o link de revisão sempre mostra). */
export async function atualizarMostrarModificacoes(geracaoId: string, mostrar: boolean) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { error } = await supabase
    .from('contrato_geracoes')
    .update({ mostrar_modificacoes: mostrar })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  return { ok: true }
}

/** Salva o texto do quadro de destaque de modificações/considerações. */
export async function atualizarModificacoesTexto(geracaoId: string, texto: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const limpo = (texto ?? '').trim()
  if (limpo.length > 5000) return { error: 'Texto muito longo (máx. 5000 caracteres).' }
  const { error } = await supabase
    .from('contrato_geracoes')
    .update({ modificacoes_texto: limpo.length > 0 ? limpo : null })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  return { ok: true }
}

/** Remove uma cláusula do snapshot deste contrato (não exclui do banco). */
export async function removerClausulaGeracao(geracaoId: string, clausulaId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  if (await contratoAssinado(supabase, 'locacao', geracaoId)) return { error: MSG_CONTRATO_TRAVADO }
  const r = await carregarSnap(supabase, acesso.userId, geracaoId)
  if ('error' in r) return { error: r.error }
  return salvarSnap(supabase, acesso.userId, geracaoId, r.g.contrato_id, r.clausulas.filter(c => c.id !== clausulaId))
}

/**
 * Marca a geração como "gerado" — sinaliza que o corretor já baixou o PDF.
 * Não salva snapshot no bucket porque o PDF é regenerado dinamicamente pela
 * rota /api/contratos/[id]/pdf sempre que aberto. Se quiser preservar o
 * estado, use o upload do PDF assinado.
 */
export async function marcarComoGerado(geracaoId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: g } = await supabase
    .from('contrato_geracoes')
    .select('id, contrato_id, status')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }

  // Não regride status (assinado > gerado > rascunho)
  const novoStatus = g.status === 'assinado' ? 'assinado' : 'gerado'

  const { error } = await supabase
    .from('contrato_geracoes')
    .update({
      gerado_em: new Date().toISOString(),
      status: novoStatus,
    })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${g.contrato_id}/gerar`)
  return { ok: true }
}

/**
 * Atualiza quais documentos do cadastro vão ao final do contrato (anexos).
 */
export async function atualizarAnexosDocumentos(geracaoId: string, ids: string[]) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (!Array.isArray(ids)) return { error: 'IDs inválidos.' }

  const { data: g } = await supabase
    .from('contrato_geracoes')
    .select('id, contrato_id')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }

  const { error } = await supabase
    .from('contrato_geracoes')
    .update({ anexo_documento_ids: ids })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${g.contrato_id}/gerar`)
  return { ok: true }
}

/**
 * Atualiza flags de aluguel inclui IPTU/condomínio.
 */
export async function atualizarFlagsAluguel(geracaoId: string, input: {
  aluguel_inclui_iptu: boolean
  aluguel_inclui_condominio: boolean
}) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: g } = await supabase
    .from('contrato_geracoes')
    .select('id, contrato_id')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }

  const { error } = await supabase
    .from('contrato_geracoes')
    .update({
      aluguel_inclui_iptu: input.aluguel_inclui_iptu,
      aluguel_inclui_condominio: input.aluguel_inclui_condominio,
    })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${g.contrato_id}/gerar`)
  return { ok: true }
}

/**
 * Upload do PDF assinado. Sobrescreve o anterior se houver.
 * Marca status='assinado' e preenche assinado_em.
 */
export async function uploadContratoAssinado(geracaoId: string, formData: FormData) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Arquivo não enviado.' }
  }
  if (file.size > 20 * 1024 * 1024) {
    return { error: 'Arquivo maior que 20MB.' }
  }
  if (file.type !== 'application/pdf') {
    return { error: 'O arquivo precisa ser um PDF.' }
  }

  const { data: g } = await supabase
    .from('contrato_geracoes')
    .select('id, contrato_id, pdf_assinado_path, contrato:contratos_locacao!inner(codigo)')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }

  // Remove o assinado anterior, se houver
  if (g.pdf_assinado_path) {
    await supabase.storage.from('contratos-pdf').remove([g.pdf_assinado_path])
  }

  const codigoRaw = Array.isArray(g.contrato) ? g.contrato[0]?.codigo : (g.contrato as { codigo?: string } | null)?.codigo
  const codigo = (codigoRaw ?? geracaoId.slice(0, 8)).replace(/[^a-zA-Z0-9-]/g, '_')
  const path = `${acesso.userId}/${geracaoId}/contrato-${codigo}-assinado-${Date.now()}.pdf`
  const bytes = await file.arrayBuffer()

  const { error: upErr } = await supabase.storage
    .from('contratos-pdf')
    .upload(path, new Uint8Array(bytes), { contentType: 'application/pdf', upsert: false })
  if (upErr) return { error: upErr.message }

  const { data: pub } = supabase.storage.from('contratos-pdf').getPublicUrl(path)

  const { error: dbErr } = await supabase
    .from('contrato_geracoes')
    .update({
      pdf_assinado_url: pub.publicUrl,
      pdf_assinado_path: path,
      assinado_em: new Date().toISOString(),
      status: 'assinado',
    })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (dbErr) {
    await supabase.storage.from('contratos-pdf').remove([path])
    return { error: dbErr.message }
  }

  revalidatePath(`/painel/contratos/${g.contrato_id}/gerar`)
  return { ok: true, url: pub.publicUrl }
}

/**
 * Remove o PDF assinado e reverte status pra 'gerado'.
 */
export async function removerContratoAssinado(geracaoId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: g } = await supabase
    .from('contrato_geracoes')
    .select('id, contrato_id, pdf_assinado_path')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }

  if (g.pdf_assinado_path) {
    await supabase.storage.from('contratos-pdf').remove([g.pdf_assinado_path])
  }

  const { error } = await supabase
    .from('contrato_geracoes')
    .update({
      pdf_assinado_url: null,
      pdf_assinado_path: null,
      assinado_em: null,
      status: 'rascunho',
    })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${g.contrato_id}/gerar`)
  return { ok: true }
}

/**
 * Atualiza as testemunhas (até 2) da geração.
 */
export async function atualizarTestemunhas(geracaoId: string, ids: string[]) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (!Array.isArray(ids)) return { error: 'IDs inválidos.' }
  const limitada = ids.slice(0, 2)  // máximo 2 testemunhas

  const { data: g } = await supabase
    .from('contrato_geracoes')
    .select('id, contrato_id')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }

  const { error } = await supabase
    .from('contrato_geracoes')
    .update({ testemunha_ids: limitada })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${g.contrato_id}/gerar`)
  return { ok: true }
}

/**
 * Atualiza o texto livre com cláusulas da seguradora (quando garantia = seguro fiança).
 */
export async function atualizarClausulasSeguradora(geracaoId: string, texto: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: g } = await supabase
    .from('contrato_geracoes')
    .select('id, contrato_id')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }

  const limpo = texto.trim()
  const { error } = await supabase
    .from('contrato_geracoes')
    .update({ clausulas_seguradora_texto: limpo.length > 0 ? limpo : null })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${g.contrato_id}/gerar`)
  return { ok: true }
}

/**
 * Atualiza qtd de chaves, controles e tags entregues — vão pro Termo de
 * Entrega de Chaves no PDF. Vinculadas ao CONTRATO (não à geração) porque
 * são parte do acordo, não do rascunho de geração.
 */
export async function atualizarItensEntrega(contratoId: string, input: {
  qtd_chaves: number
  qtd_controles: number
  qtd_tags: number
}) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const qc = Math.max(0, Math.floor(Number(input.qtd_chaves) || 0))
  const qr = Math.max(0, Math.floor(Number(input.qtd_controles) || 0))
  const qt = Math.max(0, Math.floor(Number(input.qtd_tags) || 0))

  const { error } = await supabase
    .from('contratos_locacao')
    .update({ qtd_chaves: qc, qtd_controles: qr, qtd_tags: qt })
    .eq('id', contratoId)
    .eq('user_id', acesso.userId)

  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${contratoId}/gerar`)
  return { ok: true }
}

/** Liga/desliga a página de capa executiva no PDF dessa geração. */
export async function atualizarIncluirCapa(geracaoId: string, incluir: boolean) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { data: g } = await supabase
    .from('contrato_geracoes')
    .select('id, contrato_id')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }
  const { error } = await supabase
    .from('contrato_geracoes')
    .update({ incluir_capa: incluir })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${g.contrato_id}/gerar`)
  return { ok: true }
}

/** Salva os overrides editáveis da capa (JSON chave->texto). Vazio remove a chave. */
export async function atualizarCapaOverrides(geracaoId: string, overrides: Record<string, string>) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { data: g } = await supabase
    .from('contrato_geracoes')
    .select('id, contrato_id')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }
  // Só guarda chaves com conteúdo (limpa as vazias)
  const limpo: Record<string, string> = {}
  for (const [k, v] of Object.entries(overrides ?? {})) {
    const t = (v ?? '').trim()
    if (t) limpo[k] = t
  }
  const { error } = await supabase
    .from('contrato_geracoes')
    .update({ capa_overrides: limpo })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${g.contrato_id}/gerar`)
  return { ok: true }
}

/** Override do texto da garantia na capa. Vazio = volta ao texto automático. */
export async function atualizarCapaGarantia(geracaoId: string, texto: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { data: g } = await supabase
    .from('contrato_geracoes')
    .select('id, contrato_id')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }
  const limpo = texto.trim()
  const { error } = await supabase
    .from('contrato_geracoes')
    .update({ capa_garantia_texto: limpo.length > 0 ? limpo : null })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${g.contrato_id}/gerar`)
  return { ok: true }
}

/** Define o papel do cônjuge do locatário no contrato (solidário/anuente/não participa). */
export async function atualizarConjugePapel(
  contratoId: string,
  papel: 'solidario' | 'anuente' | 'nao_participa',
) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { error } = await supabase
    .from('contratos_locacao')
    .update({ conjuge_inquilino_papel: papel })
    .eq('id', contratoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${contratoId}/gerar`)
  return { ok: true }
}

/** Salva (ou limpa) as anotações internas do corretor sobre o contrato. */
export async function atualizarAnotacoesCorretor(contratoId: string, texto: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const limpo = texto.trim()
  const { error } = await supabase
    .from('contratos_locacao')
    .update({ anotacoes_corretor: limpo.length > 0 ? limpo : null })
    .eq('id', contratoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/contratos/${contratoId}/gerar`)
  return { ok: true }
}
