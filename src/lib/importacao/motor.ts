import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLANOS } from '@/lib/constants'
import { slugify, validarWhatsApp } from '@/lib/utils'
import { baixar } from './baixar'
import { decodificarXml, lerXml, ErroImportacao } from './xml'
import { mapearListagem, type ImovelImportado, type Problema } from './mapear'
import { criarBuscaBairros, normalizarBairro } from './bairros'
import { apagarArquivos, importarFotos } from './fotos'

/**
 * O motor da importação. Três passos, cada um chamado por uma server action
 * (tela) ou pelo cron (sincronização diária):
 *
 *  1. analisar    baixa o XML, converte, compara com o que já existe e grava
 *                 um item por imóvel em importacoes_itens. Nada é criado.
 *  2. iniciar     o anunciante viu a prévia, escolheu as opções → 'importando'.
 *  3. processar   pega alguns itens da fila (RPC com SKIP LOCKED), cria ou
 *                 atualiza o imóvel e baixa as fotos. Repete até acabar o
 *                 tempo do lote; a tela chama de novo até a fila zerar.
 *
 * Tudo com o cliente de serviço: quem chama confere dono/admin ANTES.
 * Ver docs/integracoes/importacao/README.md.
 */

export const BUCKET_XML = 'importacoes'
export const MAX_XML_BYTES = 80 * 1024 * 1024
const CIDADE_SITE = 'cuiaba'
const DIAS_ANUNCIO = 30

export interface OpcoesImportacao {
  /** Publica direto (status ativo) os completos, até o limite do plano. */
  publicar: boolean
  /** Reimportação: atualiza os que já vieram antes. */
  atualizarExistentes: boolean
  /** Sobrescreve o que o anunciante mudou aqui depois de importar. */
  sobrescreverEdicoes: boolean
  /** Traz de volta imóveis que o anunciante apagou aqui. */
  trazerDescartados: boolean
  /** Sincronização: pausa anúncio importado que sumiu do arquivo. */
  pausarAusentes: boolean
  /** Só admin: publica além do limite do plano. */
  ignorarLimitePlano: boolean
}

export const OPCOES_PADRAO: OpcoesImportacao = {
  publicar: false,
  atualizarExistentes: true,
  sobrescreverEdicoes: false,
  trazerDescartados: false,
  pausarAusentes: false,
  ignorarLimitePlano: false,
}

export function opcoesValidas(o: Partial<OpcoesImportacao> | null | undefined, admin: boolean): OpcoesImportacao {
  const r = { ...OPCOES_PADRAO }
  for (const k of Object.keys(OPCOES_PADRAO) as Array<keyof OpcoesImportacao>) {
    if (typeof o?.[k] === 'boolean') r[k] = o[k] as boolean
  }
  if (!admin) r.ignorarLimitePlano = false
  return r
}

export interface ResumoAnalise {
  formato?: string
  provedor?: string | null
  no_arquivo: number
  aluguel: number
  novos: number
  ja_importados: number
  ignorados: number
  motivos: Record<string, number>
  duplicados_no_arquivo: number
  descartados: number
  sem_fotos: number
  com_avisos: number
  bairros_sem_par: Array<{ nome: string; qtd: number }>
  ausentes: number
}

type Db = ReturnType<typeof createAdminClient>

/** Campos que a importação escreve no imóvel (e compara na reimportação). */
const CAMPOS = [
  'titulo', 'descricao', 'tipo', 'preco', 'taxa_condominio', 'iptu', 'area_m2', 'area_construida_m2',
  'area_terreno_m2', 'quartos', 'suites', 'banheiros', 'vagas', 'piscina', 'aceita_pets', 'mobiliado',
  'garantia_fianca', 'garantia_caucao', 'garantia_fiador', 'bairro_id', 'endereco_completo',
  'endereco_numero', 'endereco_complemento', 'endereco_cep', 'endereco_resumido', 'lat', 'lng',
] as const
type Campo = typeof CAMPOS[number]

interface Snapshot {
  campos: Partial<Record<Campo, unknown>>
  /** URLs de origem das fotos da última importação; null = fotos não terminaram. */
  fotos_origem: string[] | null
  /** URLs daqui que a importação gravou (pra saber se o anunciante mexeu). */
  fotos_site: string[]
}

// ── utilidades ───────────────────────────────────────────────────────

async function todasAsLinhas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const tudo: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta(de, de + 999)
    if (error) throw new Error(error.message)
    tudo.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return tudo
}

function igual(a: unknown, b: unknown) {
  if ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === '')) return true
  if (typeof a === 'number' || typeof b === 'number') {
    const x = Number(a), y = Number(b)
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 0.005
  }
  return a === b
}

function resumoDe(endereco: ImovelImportado) {
  return [endereco.endereco_completo, endereco.endereco_numero, endereco.endereco_complemento].filter(Boolean).join(', ') || null
}

function camposDoImovel(d: ImovelImportado, bairroId: string | null): Record<Campo, unknown> {
  return {
    titulo: d.titulo, descricao: d.descricao, tipo: d.tipo, preco: d.preco,
    taxa_condominio: d.taxa_condominio, iptu: d.iptu, area_m2: d.area_m2,
    area_construida_m2: d.area_construida_m2, area_terreno_m2: d.area_terreno_m2,
    quartos: d.quartos, suites: d.suites, banheiros: d.banheiros, vagas: d.vagas,
    piscina: d.piscina, aceita_pets: d.aceita_pets, mobiliado: d.mobiliado,
    garantia_fianca: d.garantia_fianca, garantia_caucao: d.garantia_caucao, garantia_fiador: d.garantia_fiador,
    bairro_id: bairroId, endereco_completo: d.endereco_completo, endereco_numero: d.endereco_numero,
    endereco_complemento: d.endereco_complemento, endereco_cep: d.endereco_cep,
    endereco_resumido: resumoDe(d), lat: d.lat, lng: d.lng,
  }
}

/** O mínimo pra ir ao ar: o que o formulário de anúncio exige + 1 foto. */
function completo(c: Record<Campo, unknown>, whatsapp: string, fotos: number) {
  return String(c.titulo ?? '').trim().length >= 5 && !!c.bairro_id && Number(c.preco) > 0
    && validarWhatsApp(whatsapp) && fotos > 0
}

async function bytesDoXml(db: Db, imp: { origem: string; url: string | null; arquivo_path: string | null }) {
  if (imp.origem === 'url') {
    if (!imp.url) throw new ErroImportacao('Importação sem URL.')
    const { bytes } = await baixar(imp.url, { maxBytes: MAX_XML_BYTES, timeoutMs: 120_000, aceitar: 'application/xml, text/xml, */*' })
    return bytes
  }
  if (!imp.arquivo_path) throw new ErroImportacao('Importação sem arquivo.')
  const { data, error } = await db.storage.from(BUCKET_XML).download(imp.arquivo_path)
  if (error || !data) throw new ErroImportacao(`Não deu para ler o arquivo enviado: ${error?.message ?? 'vazio'}`)
  if (data.size > MAX_XML_BYTES) throw new ErroImportacao('Arquivo grande demais (máx. 80 MB).')
  return Buffer.from(await data.arrayBuffer())
}

async function buscaDeBairros(db: Db, userId: string) {
  const [{ data: bairros }, { data: mapa }] = await Promise.all([
    db.from('bairros').select('id, nome').limit(5000),
    db.from('importacao_bairros').select('nome_origem, bairro_id').eq('user_id', userId).limit(5000),
  ])
  return criarBuscaBairros(bairros ?? [], new Map((mapa ?? []).map(m => [m.nome_origem, m.bairro_id])))
}

// ── 1. análise ───────────────────────────────────────────────────────

export async function analisarImportacao(importacaoId: string): Promise<ResumoAnalise> {
  const db = createAdminClient()
  const { data: imp, error } = await db.from('importacoes')
    .select('id, user_id, fonte_id, origem, url, arquivo_path, status')
    .eq('id', importacaoId).single()
  if (error || !imp) throw new Error(error?.message ?? 'Importação não encontrada')

  try {
    const bytes = await bytesDoXml(db, imp)
    const lido = lerXml(decodificarXml(bytes))

    const [existentes, descartados] = await Promise.all([
      todasAsLinhas<{ id: string; importacao_codigo: string }>((de, ate) =>
        db.from('imoveis').select('id, importacao_codigo')
          .eq('user_id', imp.user_id).not('importacao_codigo', 'is', null).order('id').range(de, ate)),
      todasAsLinhas<{ codigo: string }>((de, ate) =>
        db.from('importacao_descartados').select('codigo').eq('user_id', imp.user_id).order('codigo').range(de, ate)),
    ])
    const porCodigo = new Map(existentes.map(e => [e.importacao_codigo, e]))
    const descartadosSet = new Set(descartados.map(d => d.codigo))
    const acharBairro = await buscaDeBairros(db, imp.user_id)

    const resumo: ResumoAnalise = {
      formato: lido.formato, provedor: lido.provedor,
      no_arquivo: lido.listagens.length, aluguel: 0, novos: 0, ja_importados: 0, ignorados: 0, motivos: {},
      duplicados_no_arquivo: 0, descartados: 0, sem_fotos: 0, com_avisos: 0, bairros_sem_par: [], ausentes: 0,
    }
    const semPar = new Map<string, { nome: string; qtd: number }>()
    const vistos = new Set<string>()
    const itens: Array<Record<string, unknown>> = []

    lido.listagens.forEach((l, ordem) => {
      const r = mapearListagem(l, lido.formato, CIDADE_SITE)
      if (r.transacao === 'aluguel' && r.imovel) resumo.aluguel++
      const codigo = r.imovel?.codigo || `sem-codigo-${ordem + 1}`
      if (vistos.has(codigo)) { resumo.duplicados_no_arquivo++; return }
      vistos.add(codigo)

      let acao: 'criar' | 'atualizar' | 'ignorar'
      let motivo = r.ignorar
      if (!r.imovel || motivo) {
        acao = 'ignorar'
      } else if (porCodigo.has(codigo)) {
        acao = 'atualizar'; resumo.ja_importados++
      } else if (descartadosSet.has(codigo)) {
        acao = 'ignorar'; motivo = 'Apagado aqui antes — não volta sozinho'; resumo.descartados++
      } else {
        acao = 'criar'; resumo.novos++
      }
      if (acao === 'ignorar') {
        resumo.ignorados++
        const m = motivo ?? 'Ignorado'
        const chave = m.startsWith('Fora de') ? 'Fora da cidade' : m
        resumo.motivos[chave] = (resumo.motivos[chave] ?? 0) + 1
      } else {
        if (!r.imovel!.fotos.length) resumo.sem_fotos++
        if (r.problemas.length) resumo.com_avisos++
        const nome = r.imovel!.bairro_nome
        if (nome && !acharBairro(nome)) {
          const k = normalizarBairro(nome)
          const atual = semPar.get(k) ?? { nome, qtd: 0 }
          atual.qtd++
          semPar.set(k, atual)
        }
      }

      itens.push({
        importacao_id: imp.id,
        ordem,
        codigo,
        titulo: r.imovel?.titulo ?? null,
        bairro_origem: r.imovel?.bairro_nome ?? null,
        dados: r.imovel ?? {},
        acao,
        motivo,
        status: acao === 'ignorar' ? 'ignorado' : 'pendente',
        problemas: r.problemas,
        imovel_id: porCodigo.get(codigo)?.id ?? null,
      })
    })

    resumo.bairros_sem_par = [...semPar.values()].sort((a, b) => b.qtd - a.qtd)

    // Reanálise: limpa a anterior antes de gravar.
    await db.from('importacoes_itens').delete().eq('importacao_id', imp.id)
    for (let i = 0; i < itens.length; i += 500) {
      const { error: e } = await db.from('importacoes_itens').insert(itens.slice(i, i + 500))
      if (e) throw new Error(`Gravando a análise: ${e.message}`)
    }

    // Importados antes (desta mesma origem) que sumiram do arquivo.
    resumo.ausentes = (await listarAusentes(imp.id)).length

    await db.from('importacoes').update({
      status: 'pronta', formato: lido.formato, resumo, total: itens.length, erro: null,
    }).eq('id', imp.id)
    return resumo
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await db.from('importacoes').update({ status: 'erro', erro: msg }).eq('id', imp.id)
    if (imp.fonte_id) await db.from('importacoes_fontes').update({ ultimo_erro: msg }).eq('id', imp.fonte_id)
    throw e instanceof ErroImportacao ? e : new ErroImportacao(msg)
  }
}

/** Recalcula só a lista de bairros sem par (depois de o anunciante escolher). */
export async function recalcularBairrosSemPar(importacaoId: string) {
  const db = createAdminClient()
  const { data: imp } = await db.from('importacoes').select('id, user_id, resumo').eq('id', importacaoId).single()
  if (!imp) return
  const itens = await todasAsLinhas<{ bairro_origem: string | null }>((de, ate) =>
    db.from('importacoes_itens').select('bairro_origem').eq('importacao_id', importacaoId)
      .neq('acao', 'ignorar').not('bairro_origem', 'is', null).order('ordem').range(de, ate))
  const achar = await buscaDeBairros(db, imp.user_id)
  const semPar = new Map<string, { nome: string; qtd: number }>()
  for (const i of itens) {
    if (!i.bairro_origem || achar(i.bairro_origem)) continue
    const k = normalizarBairro(i.bairro_origem)
    const a = semPar.get(k) ?? { nome: i.bairro_origem, qtd: 0 }
    a.qtd++
    semPar.set(k, a)
  }
  const resumo = { ...(imp.resumo as ResumoAnalise), bairros_sem_par: [...semPar.values()].sort((a, b) => b.qtd - a.qtd) }
  await db.from('importacoes').update({ resumo }).eq('id', importacaoId)
}

// ── 2. iniciar ───────────────────────────────────────────────────────

export async function iniciarImportacao(importacaoId: string, opcoes: OpcoesImportacao) {
  const db = createAdminClient()
  const { data: imp } = await db.from('importacoes').select('id, status').eq('id', importacaoId).single()
  if (!imp) throw new Error('Importação não encontrada')
  if (imp.status !== 'pronta') throw new Error('Esta importação não está pronta para começar.')

  if (opcoes.trazerDescartados) {
    await db.from('importacoes_itens')
      .update({ acao: 'criar', motivo: null, status: 'pendente' })
      .eq('importacao_id', importacaoId).eq('acao', 'ignorar').like('motivo', 'Apagado aqui antes%')
  }
  if (!opcoes.atualizarExistentes) {
    await db.from('importacoes_itens')
      .update({ status: 'ignorado', mensagem: 'Já existe aqui — atualização desligada' })
      .eq('importacao_id', importacaoId).eq('acao', 'atualizar')
  }
  await db.from('importacoes').update({
    status: 'importando', opcoes, iniciado_em: new Date().toISOString(),
  }).eq('id', importacaoId)
}

// ── 3. processar ─────────────────────────────────────────────────────

export interface Progresso {
  status: string
  total: number
  pendentes: number
  criados: number
  atualizados: number
  sem_mudanca: number
  ignorados: number
  erros: number
  /** Algum anúncio no ar mudou: a vitrine precisa ser invalidada. */
  mexeuNaVitrine: boolean
}

export async function contarProgresso(importacaoId: string, db: Db = createAdminClient()): Promise<Omit<Progresso, 'mexeuNaVitrine'>> {
  const contar = (status: string[]) => db.from('importacoes_itens')
    .select('id', { count: 'exact', head: true }).eq('importacao_id', importacaoId).in('status', status)
    .then(r => r.count ?? 0)
  const [{ data: imp }, pendentes, criados, atualizados, sem_mudanca, ignorados, erros] = await Promise.all([
    db.from('importacoes').select('status, total').eq('id', importacaoId).single(),
    contar(['pendente', 'processando']), contar(['criado']), contar(['atualizado']),
    contar(['sem_mudanca']), contar(['ignorado']), contar(['erro']),
  ])
  return { status: imp?.status ?? 'erro', total: imp?.total ?? 0, pendentes, criados, atualizados, sem_mudanca, ignorados, erros }
}

interface Contexto {
  db: Db
  userId: string
  fonteId: string | null
  opcoes: OpcoesImportacao
  telefonePerfil: string
  acharBairro: (n: string | null | undefined) => string | null
  vagas: number   // quantos ainda podem ir ao ar (Infinity sem limite)
  prazo: number
  mexeuNaVitrine: boolean
}

interface Item {
  id: string
  codigo: string
  acao: 'criar' | 'atualizar' | 'ignorar'
  dados: ImovelImportado
  problemas: Problema[]
}

async function vagasDoPlano(db: Db, userId: string, opcoes: OpcoesImportacao): Promise<number> {
  if (!opcoes.publicar) return 0
  if (opcoes.ignorarLimitePlano) return Infinity
  const { data: perfil } = await db.from('perfis').select('plano, role').eq('id', userId).single()
  if (perfil?.role === 'admin') return Infinity
  const limite = PLANOS[(perfil?.plano ?? 'free') as keyof typeof PLANOS]?.imoveis ?? 1
  if (limite >= 999) return Infinity
  const { count } = await db.from('imoveis').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).in('status', ['ativo', 'alugado'])
  return Math.max(0, limite - (count ?? 0))
}

/**
 * Processa a fila até `prazo` (epoch ms). Devolve o progresso; quando a fila
 * zera, fecha a importação. Chamar de novo é seguro (idempotente por item).
 */
export async function processarLote(importacaoId: string, prazo: number): Promise<Progresso> {
  const db = createAdminClient()
  const { data: imp } = await db.from('importacoes')
    .select('id, user_id, fonte_id, status, opcoes, origem, arquivo_path').eq('id', importacaoId).single()
  if (!imp) throw new Error('Importação não encontrada')
  if (imp.status !== 'importando') return { ...(await contarProgresso(importacaoId, db)), mexeuNaVitrine: false }

  const opcoes = opcoesValidas(imp.opcoes as Partial<OpcoesImportacao>, true)
  const { data: perfil } = await db.from('perfis').select('telefone').eq('id', imp.user_id).single()
  const ctx: Contexto = {
    db, userId: imp.user_id, fonteId: imp.fonte_id, opcoes,
    telefonePerfil: (perfil?.telefone ?? '').replace(/\D/g, ''),
    acharBairro: await buscaDeBairros(db, imp.user_id),
    vagas: await vagasDoPlano(db, imp.user_id, opcoes),
    prazo,
    mexeuNaVitrine: false,
  }

  // Um imóvel com 20 fotos leva ~10–20 s. Só pega item novo se sobra tempo.
  while (Date.now() < prazo - 25_000) {
    const { data: lote, error } = await db.rpc('importacao_reservar', { p_importacao: importacaoId, p_qtd: 2 })
    if (error) throw new Error(error.message)
    const itens = (lote ?? []) as Item[]
    if (!itens.length) break
    await Promise.all(itens.map(item => processarItem(ctx, item)))
  }

  const p = await contarProgresso(importacaoId, db)
  if (p.pendentes === 0 && p.status === 'importando') {
    await db.from('importacoes').update({ status: 'concluida', concluido_em: new Date().toISOString() }).eq('id', importacaoId)
    if (imp.origem === 'arquivo' && imp.arquivo_path) {
      // O XML já foi todo convertido para importacoes_itens; não precisa mais dele.
      await db.storage.from(BUCKET_XML).remove([imp.arquivo_path]).catch(() => {})
    }
    if (imp.fonte_id) {
      await db.from('importacoes_fontes').update({
        ultima_importacao_id: importacaoId, ultima_sincronizacao_em: new Date().toISOString(), ultimo_erro: null,
      }).eq('id', imp.fonte_id)
    }
    if (opcoes.pausarAusentes) {
      const n = await pausarAusentes(importacaoId)
      if (n > 0) ctx.mexeuNaVitrine = true
    }
    p.status = 'concluida'
  }
  return { ...p, mexeuNaVitrine: ctx.mexeuNaVitrine }
}

async function fecharItem(ctx: Contexto, id: string, patch: Record<string, unknown>) {
  await ctx.db.from('importacoes_itens').update({ ...patch, processado_em: new Date().toISOString() }).eq('id', id)
}

async function processarItem(ctx: Contexto, item: Item) {
  try {
    const { data: existente } = await ctx.db.from('imoveis')
      .select(`id, status, importacao_dados, fotos(id, url), ${CAMPOS.join(', ')}`)
      .eq('user_id', ctx.userId).eq('importacao_codigo', item.codigo).maybeSingle()

    if (existente) await atualizarImovel(ctx, item, existente as unknown as Existente)
    else await criarImovel(ctx, item)
  } catch (e) {
    await fecharItem(ctx, item.id, { status: 'erro', mensagem: e instanceof Error ? e.message : String(e) })
  }
}

type Existente = Record<Campo, unknown> & {
  id: string
  status: string
  importacao_dados: Snapshot | null
  fotos: Array<{ id: string; url: string }> | null
}

function whatsappDe(ctx: Contexto, d: ImovelImportado) {
  if (d.telefone && validarWhatsApp(d.telefone)) return d.telefone
  if (d.telefone && validarWhatsApp('55' + d.telefone)) return '55' + d.telefone
  return ctx.telefonePerfil
}

async function criarImovel(ctx: Contexto, item: Item) {
  const d = item.dados
  const bairroId = ctx.acharBairro(d.bairro_nome)
  const campos = camposDoImovel(d, bairroId)
  const id = crypto.randomUUID()
  const bairroNome = d.bairro_nome ?? ''
  const whatsapp = whatsappDe(ctx, d)
  const expira = new Date(Date.now() + DIAS_ANUNCIO * 86400000).toISOString()
  const agora = new Date().toISOString()

  const { error } = await ctx.db.from('imoveis').insert({
    id,
    user_id: ctx.userId,
    ...campos,
    slug: `${slugify(`${d.titulo} ${bairroNome} cuiaba mt`).slice(0, 90)}-${id.slice(0, 8)}`,
    custo_tipo: 'separado',
    whatsapp,
    status: 'rascunho',
    destaque: false,
    expira_em: expira,
    importacao_codigo: item.codigo,
    importacao_fonte_id: ctx.fonteId,
    importado_em: agora,
    importacao_dados: { campos, fotos_origem: null, fotos_site: [] } satisfies Snapshot,
  })
  if (error) {
    // Outra execução criou o mesmo código no meio do caminho: vira atualização.
    if (error.code === '23505') {
      const { data: ex } = await ctx.db.from('imoveis')
        .select(`id, status, importacao_dados, fotos(id, url), ${CAMPOS.join(', ')}`)
        .eq('user_id', ctx.userId).eq('importacao_codigo', item.codigo).maybeSingle()
      if (ex) return atualizarImovel(ctx, item, ex as unknown as Existente)
    }
    throw new Error(`Gravando o imóvel: ${error.message}`)
  }

  const avisos: string[] = []
  const { gravadas, falhas } = await importarFotos(ctx.db, ctx.userId, id, d.fotos, ctx.prazo + 60_000)
  if (gravadas.length) {
    const { error: ef } = await ctx.db.from('fotos').insert(
      gravadas.map((f, i) => ({ imovel_id: id, url: f.url, ordem: i + 1, principal: i === 0 })))
    if (ef) avisos.push(`Fotos não registradas: ${ef.message}`)
  }
  if (falhas.length) avisos.push(`${falhas.length} foto(s) não baixaram (${falhas[0].motivo})`)

  const patch: Record<string, unknown> = {
    // Só as que baixaram: na próxima importação, as que falharam são tentadas de novo.
    importacao_dados: { campos, fotos_origem: gravadas.map(f => f.origem), fotos_site: gravadas.map(f => f.url) } satisfies Snapshot,
  }
  let publicado = false
  if (ctx.opcoes.publicar) {
    if (!completo(campos, whatsapp, gravadas.length)) {
      avisos.push('Ficou como rascunho: falta ' + [
        !bairroId && 'bairro', !validarWhatsApp(whatsapp) && 'WhatsApp', !gravadas.length && 'foto',
      ].filter(Boolean).join(', '))
    } else if (ctx.vagas <= 0) {
      avisos.push('Ficou como rascunho: limite de anúncios do plano')
    } else {
      ctx.vagas--
      patch.status = 'ativo'
      patch.expira_em = new Date(Date.now() + DIAS_ANUNCIO * 86400000).toISOString()
      publicado = true
    }
  }
  await ctx.db.from('imoveis').update(patch).eq('id', id)
  if (publicado) ctx.mexeuNaVitrine = true

  await fecharItem(ctx, item.id, {
    status: 'criado',
    imovel_id: id,
    mensagem: [publicado ? 'Publicado' : 'Criado como rascunho', ...avisos].join(' · '),
  })
}

async function atualizarImovel(ctx: Contexto, item: Item, ex: Existente) {
  const d = item.dados
  const snap: Snapshot = ex.importacao_dados ?? { campos: {}, fotos_origem: null, fotos_site: [] }
  const resolvido = ctx.acharBairro(d.bairro_nome)
  const novos = camposDoImovel(d, resolvido ?? (ex.bairro_id as string | null))
  const sobrescrever = ctx.opcoes.sobrescreverEdicoes

  const patch: Record<string, unknown> = {}
  const novoSnap: Snapshot = { campos: { ...snap.campos }, fotos_origem: snap.fotos_origem, fotos_site: snap.fotos_site }
  const mantidos: Campo[] = []

  for (const c of CAMPOS) {
    const novo = novos[c]
    if (igual(novo, ex[c])) { novoSnap.campos[c] = novo; continue }
    const mexeuAqui = c in snap.campos && !igual(ex[c], snap.campos[c])
    if (mexeuAqui && !sobrescrever) { mantidos.push(c); continue }
    patch[c] = novo
    novoSnap.campos[c] = novo
  }

  // Fotos: só troca se mudaram na origem E (ninguém mexeu aqui OU sobrescrever).
  const fotosAtuais = (ex.fotos ?? []).map(f => f.url)
  const origemMudou = snap.fotos_origem === null
    || snap.fotos_origem.length !== d.fotos.length
    || snap.fotos_origem.some((u, i) => u !== d.fotos[i])
  const mexeuNasFotos = snap.fotos_origem !== null
    && (fotosAtuais.length !== snap.fotos_site.length || fotosAtuais.some(u => !snap.fotos_site.includes(u)))
  const avisos: string[] = []
  let trocouFotos = false

  if (origemMudou && d.fotos.length && (!mexeuNasFotos || sobrescrever)) {
    const { gravadas, falhas } = await importarFotos(ctx.db, ctx.userId, ex.id, d.fotos, ctx.prazo + 60_000)
    if (gravadas.length) {
      const { error: ef } = await ctx.db.from('fotos').insert(
        gravadas.map((f, i) => ({ imovel_id: ex.id, url: f.url, ordem: i + 1, principal: i === 0 })))
      if (ef) throw new Error(`Gravando fotos: ${ef.message}`)
      const velhas = ex.fotos ?? []
      if (velhas.length) {
        await ctx.db.from('fotos').delete().in('id', velhas.map(f => f.id))
        // Só apaga do armazenamento o que a importação tinha gravado.
        await apagarArquivos(ctx.db, velhas.map(f => f.url).filter(u => snap.fotos_site.includes(u) || /\/imp-/.test(u)))
      }
      novoSnap.fotos_origem = gravadas.map(f => f.origem)
      novoSnap.fotos_site = gravadas.map(f => f.url)
      trocouFotos = true
    }
    if (falhas.length) avisos.push(`${falhas.length} foto(s) não baixaram (${falhas[0].motivo})`)
  } else if (origemMudou && mexeuNasFotos) {
    avisos.push('Fotos mudaram na origem, mas você mexeu nelas aqui — mantidas')
  }

  if (mantidos.length) avisos.push(`Mantido o que você editou aqui: ${mantidos.join(', ')}`)
  const mudou = Object.keys(patch).length > 0 || trocouFotos

  await ctx.db.from('imoveis').update({
    ...patch,
    importacao_dados: novoSnap,
    importado_em: new Date().toISOString(),
    ...(ctx.fonteId ? { importacao_fonte_id: ctx.fonteId } : {}),
  }).eq('id', ex.id)

  if (mudou && ex.status === 'ativo') ctx.mexeuNaVitrine = true
  await fecharItem(ctx, item.id, {
    status: mudou ? 'atualizado' : 'sem_mudanca',
    imovel_id: ex.id,
    mensagem: [mudou ? `Atualizado (${[...Object.keys(patch), ...(trocouFotos ? ['fotos'] : [])].join(', ')})` : 'Nada mudou', ...avisos].join(' · '),
  })
}

// ── extras ───────────────────────────────────────────────────────────

/** Anúncios importados (no ar) cujo código não está mais no arquivo desta importação. */
export async function listarAusentes(importacaoId: string) {
  const db = createAdminClient()
  const { data: imp } = await db.from('importacoes').select('id, user_id, fonte_id').eq('id', importacaoId).single()
  if (!imp) return []
  const [itens, importados] = await Promise.all([
    todasAsLinhas<{ codigo: string }>((de, ate) => db.from('importacoes_itens').select('codigo')
      .eq('importacao_id', importacaoId).neq('acao', 'ignorar').order('ordem').range(de, ate)),
    todasAsLinhas<{ id: string; titulo: string; importacao_codigo: string; importacao_fonte_id: string | null }>((de, ate) =>
      db.from('imoveis').select('id, titulo, importacao_codigo, importacao_fonte_id')
        .eq('user_id', imp.user_id).eq('status', 'ativo').not('importacao_codigo', 'is', null).order('id').range(de, ate)),
  ])
  const codigos = new Set(itens.map(i => i.codigo))
  return importados.filter(i =>
    !codigos.has(i.importacao_codigo)
    // Sincronizando uma URL: só mexe no que veio dela.
    && i.importacao_fonte_id === (imp.fonte_id ?? null))
}

export async function pausarAusentes(importacaoId: string, ids?: string[]): Promise<number> {
  const db = createAdminClient()
  const ausentes = await listarAusentes(importacaoId)
  const alvo = ausentes.filter(a => !ids || ids.includes(a.id)).map(a => a.id)
  for (let i = 0; i < alvo.length; i += 200) {
    await db.from('imoveis').update({ status: 'pausado' }).in('id', alvo.slice(i, i + 200))
  }
  return alvo.length
}

/**
 * Desfaz: apaga os imóveis que ESTA importação criou e que ainda são
 * rascunho (o que já foi publicado ou editado fica — apagar é com a pessoa).
 */
export async function desfazerImportacao(importacaoId: string): Promise<number> {
  const db = createAdminClient()
  const criados = await todasAsLinhas<{ imovel_id: string | null }>((de, ate) =>
    db.from('importacoes_itens').select('imovel_id').eq('importacao_id', importacaoId)
      .eq('status', 'criado').order('ordem').range(de, ate))
  const ids = criados.map(c => c.imovel_id).filter((x): x is string => !!x)
  let apagados = 0
  for (let i = 0; i < ids.length; i += 100) {
    const { data: alvo } = await db.from('imoveis').select('id, fotos(url)')
      .in('id', ids.slice(i, i + 100)).eq('status', 'rascunho')
    const lista = (alvo ?? []) as Array<{ id: string; fotos: Array<{ url: string }> | null }>
    if (!lista.length) continue
    await apagarArquivos(db, lista.flatMap(a => (a.fotos ?? []).map(f => f.url)))
    await db.from('fotos').delete().in('imovel_id', lista.map(a => a.id))
    await db.from('imoveis').delete().in('id', lista.map(a => a.id))
    apagados += lista.length
  }
  await db.from('importacoes_itens').update({ status: 'ignorado', mensagem: 'Desfeito' })
    .eq('importacao_id', importacaoId).eq('status', 'criado')
  return apagados
}

export async function cancelarImportacao(importacaoId: string) {
  const db = createAdminClient()
  await db.from('importacoes_itens').update({ status: 'ignorado', mensagem: 'Cancelado' })
    .eq('importacao_id', importacaoId).in('status', ['pendente'])
  await db.from('importacoes').update({ status: 'cancelada', concluido_em: new Date().toISOString() }).eq('id', importacaoId)
  const { data: imp } = await db.from('importacoes').select('origem, arquivo_path').eq('id', importacaoId).single()
  if (imp?.origem === 'arquivo' && imp.arquivo_path) await db.storage.from(BUCKET_XML).remove([imp.arquivo_path]).catch(() => {})
}

/** Tenta de novo só os itens que deram erro. */
export async function reprocessarErros(importacaoId: string) {
  const db = createAdminClient()
  await db.from('importacoes_itens').update({ status: 'pendente', tentativas: 0, mensagem: null })
    .eq('importacao_id', importacaoId).eq('status', 'erro')
  await db.from('importacoes').update({ status: 'importando', concluido_em: null }).eq('id', importacaoId)
}
