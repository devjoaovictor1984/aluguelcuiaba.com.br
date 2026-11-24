'use server'

import { updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TAG_IMOVEIS } from '@/lib/supabase/public'
import { dentroDoLimite } from '@/lib/rate-limit'
import { normalizarBairro } from '@/lib/importacao/bairros'
import {
  analisarImportacao, BUCKET_XML, cancelarImportacao, desfazerImportacao, iniciarImportacao,
  listarAusentes, MAX_XML_BYTES, opcoesValidas, pausarAusentes, processarLote, recalcularBairrosSemPar,
  reprocessarErros, type OpcoesImportacao, type Progresso,
} from '@/lib/importacao/motor'

/**
 * Ações da importação de XML. Ver docs/integracoes/importacao/README.md.
 *
 * Regra de acesso, conferida AQUI (server action é endpoint público):
 *  - cada um importa para a própria conta;
 *  - o admin importa para qualquer conta (`alvoUserId`) e mexe em qualquer
 *    importação;
 *  - o motor usa o cliente de serviço, então nada passa daqui sem o check.
 */

/** Erro OU os dados. Na falha da análise vem os dois: o erro e o id (a tela mostra a importação com o erro). */
type R<T = object> = { error?: string } & Partial<T>

async function quem() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: perfil } = await supabase.from('perfis').select('role').eq('id', user.id).single()
  return { id: user.id, admin: perfil?.role === 'admin' }
}

async function contaAlvo(alvoUserId?: string | null) {
  const eu = await quem()
  if (!eu) return { erro: 'Não autenticado' as const }
  if (alvoUserId && alvoUserId !== eu.id) {
    if (!eu.admin) return { erro: 'Só o admin importa para outra conta' as const }
    const { data } = await createAdminClient().from('perfis').select('id').eq('id', alvoUserId).maybeSingle()
    if (!data) return { erro: 'Conta de destino não encontrada' as const }
    return { eu, alvo: alvoUserId }
  }
  return { eu, alvo: eu.id }
}

async function acessoImportacao(id: string) {
  const eu = await quem()
  if (!eu) return { erro: 'Não autenticado' as const }
  const { data: imp } = await createAdminClient().from('importacoes')
    .select('id, user_id, status, origem, url, arquivo_path, arquivo_nome, fonte_id').eq('id', id).maybeSingle()
  if (!imp) return { erro: 'Importação não encontrada' as const }
  if (imp.user_id !== eu.id && !eu.admin) return { erro: 'Sem permissão para esta importação' as const }
  return { eu, imp }
}

function msg(e: unknown) {
  return e instanceof Error ? e.message : String(e)
}

/** Uma importação por vez por conta (duas ao mesmo tempo brigariam pelos mesmos códigos). */
async function emAndamento(userId: string): Promise<string | null> {
  const dezMin = new Date(Date.now() - 10 * 60_000).toISOString()
  const { data } = await createAdminClient().from('importacoes').select('id, status, criado_em')
    .eq('user_id', userId).in('status', ['analisando', 'importando']).order('criado_em', { ascending: false }).limit(5)
  // 'analisando' parado há mais de 10 min é análise que caiu — não trava.
  const ativa = (data ?? []).find(i => i.status === 'importando' || i.criado_em > dezMin)
  return ativa?.id ?? null
}

async function podeComecar(eu: { id: string; admin: boolean }, alvo: string): Promise<string | null> {
  if (!eu.admin && !(await dentroDoLimite(`importacao:${eu.id}`, 30, 3600))) {
    return 'Muitas importações em pouco tempo. Espere alguns minutos.'
  }
  const ativa = await emAndamento(alvo)
  if (ativa) return `Já tem uma importação em andamento para esta conta. Termine ou cancele antes (/painel/anuncios/importar/${ativa}).`
  return null
}

function urlValida(bruta: string): string | null {
  const s = bruta.trim()
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href
  } catch { return null }
}

// ── começar: por URL ─────────────────────────────────────────────────

export async function importarDeUrl(input: { url: string; nome?: string; salvarFonte?: boolean; alvoUserId?: string | null }): Promise<R<{ id: string }>> {
  const c = await contaAlvo(input.alvoUserId)
  if ('erro' in c) return { error: c.erro }
  const url = urlValida(input.url)
  if (!url) return { error: 'URL inválida. Cole o endereço completo, começando com https://' }
  const bloqueio = await podeComecar(c.eu, c.alvo)
  if (bloqueio) return { error: bloqueio }

  const db = createAdminClient()
  let fonteId: string | null = null
  if (input.salvarFonte !== false) {
    const { data: fonte, error: ef } = await db.from('importacoes_fontes')
      .upsert({ user_id: c.alvo, url, nome: input.nome?.trim().slice(0, 120) || null, criado_por: c.eu.id }, { onConflict: 'user_id,url' })
      .select('id').single()
    if (ef) return { error: /importacoes_fontes/.test(ef.message) ? 'Falta rodar a migration v108 no Supabase.' : ef.message }
    fonteId = fonte.id
  }

  const { data: imp, error } = await db.from('importacoes').insert({
    user_id: c.alvo, criado_por: c.eu.id, fonte_id: fonteId, origem: 'url', url, status: 'analisando',
  }).select('id').single()
  if (error) return { error: /importacoes/.test(error.message) ? 'Falta rodar a migration v108 no Supabase.' : error.message }

  try {
    await analisarImportacao(imp.id)
  } catch (e) {
    return { error: msg(e), id: imp.id }
  }
  return { id: imp.id }
}

// ── começar: por arquivo ─────────────────────────────────────────────
// O navegador sobe o XML direto pro bucket privado com uma URL assinada
// (a server action só aceita 1 MB de corpo; feed de imobiliária passa disso).

export async function pedirEnvioArquivo(input: { nome: string; tamanho: number; alvoUserId?: string | null }): Promise<R<{ path: string; token: string }>> {
  const c = await contaAlvo(input.alvoUserId)
  if ('erro' in c) return { error: c.erro }
  if (!/\.(xml|gz|txt)$/i.test(input.nome)) return { error: 'Envie o arquivo .xml (ou .xml.gz).' }
  if (!(input.tamanho > 0)) return { error: 'Arquivo vazio.' }
  if (input.tamanho > MAX_XML_BYTES) return { error: 'Arquivo grande demais (máx. 80 MB).' }
  const bloqueio = await podeComecar(c.eu, c.alvo)
  if (bloqueio) return { error: bloqueio }

  const path = `${c.alvo}/${crypto.randomUUID()}${/\.gz$/i.test(input.nome) ? '.xml.gz' : '.xml'}`
  const { data, error } = await createAdminClient().storage.from(BUCKET_XML).createSignedUploadUrl(path)
  if (error || !data) {
    return { error: /not found/i.test(error?.message ?? '') ? 'Falta rodar a migration v108 no Supabase (bucket importacoes).' : (error?.message ?? 'Falha ao preparar o envio') }
  }
  return { path, token: data.token }
}

export async function importarArquivoEnviado(input: { path: string; nome: string; alvoUserId?: string | null }): Promise<R<{ id: string }>> {
  const c = await contaAlvo(input.alvoUserId)
  if ('erro' in c) return { error: c.erro }
  // O caminho foi gerado por pedirEnvioArquivo para ESTA conta; não aceita outro.
  if (!new RegExp(`^${c.alvo}/[0-9a-f-]{36}\\.xml(\\.gz)?$`).test(input.path)) return { error: 'Arquivo inválido.' }

  const db = createAdminClient()
  const { data: imp, error } = await db.from('importacoes').insert({
    user_id: c.alvo, criado_por: c.eu.id, origem: 'arquivo', arquivo_path: input.path,
    arquivo_nome: input.nome.slice(0, 200), status: 'analisando',
  }).select('id').single()
  if (error) return { error: error.message }

  try {
    await analisarImportacao(imp.id)
  } catch (e) {
    return { error: msg(e), id: imp.id }
  }
  return { id: imp.id }
}

// ── prévia ───────────────────────────────────────────────────────────

export async function salvarBairros(importacaoId: string, pares: Array<{ nome: string; bairroId: string }>): Promise<R> {
  const a = await acessoImportacao(importacaoId)
  if ('erro' in a) return { error: a.erro }
  const db = createAdminClient()
  const validos = pares.filter(p => p.nome && p.bairroId).slice(0, 500)
  if (validos.length) {
    const ids = [...new Set(validos.map(p => p.bairroId))]
    const { data: existem } = await db.from('bairros').select('id').in('id', ids)
    const ok = new Set((existem ?? []).map(b => b.id))
    const linhas = validos.filter(p => ok.has(p.bairroId)).map(p => ({
      user_id: a.imp.user_id, nome_origem: normalizarBairro(p.nome), bairro_id: p.bairroId,
    })).filter(l => l.nome_origem)
    if (linhas.length) {
      const { error } = await db.from('importacao_bairros').upsert(linhas, { onConflict: 'user_id,nome_origem' })
      if (error) return { error: error.message }
    }
  }
  await recalcularBairrosSemPar(importacaoId)
  return {}
}

export async function reanalisar(importacaoId: string): Promise<R> {
  const a = await acessoImportacao(importacaoId)
  if ('erro' in a) return { error: a.erro }
  if (!['pronta', 'erro'].includes(a.imp.status)) return { error: 'Só dá para reanalisar antes de importar.' }
  await createAdminClient().from('importacoes').update({ status: 'analisando', erro: null }).eq('id', importacaoId)
  try {
    await analisarImportacao(importacaoId)
  } catch (e) {
    return { error: msg(e) }
  }
  return {}
}

// ── importar ─────────────────────────────────────────────────────────

export async function comecarImportacao(importacaoId: string, opcoes: Partial<OpcoesImportacao>): Promise<R> {
  const a = await acessoImportacao(importacaoId)
  if ('erro' in a) return { error: a.erro }
  const ativa = await emAndamento(a.imp.user_id)
  if (ativa && ativa !== importacaoId) return { error: 'Já tem outra importação em andamento para esta conta.' }
  try {
    const op = opcoesValidas(opcoes, a.eu.admin)
    await iniciarImportacao(importacaoId, op)
    if (a.imp.fonte_id) {
      // A URL lembra as opções: a sincronização diária usa as mesmas.
      await createAdminClient().from('importacoes_fontes').update({ opcoes: op }).eq('id', a.imp.fonte_id)
    }
  } catch (e) {
    return { error: msg(e) }
  }
  return {}
}

/** Um lote (~50 s). A tela chama em sequência até `pendentes` zerar. */
export async function processarProximoLote(importacaoId: string): Promise<R<{ progresso: Progresso }>> {
  const a = await acessoImportacao(importacaoId)
  if ('erro' in a) return { error: a.erro }
  try {
    const progresso = await processarLote(importacaoId, Date.now() + 50_000)
    if (progresso.mexeuNaVitrine) updateTag(TAG_IMOVEIS)
    return { progresso }
  } catch (e) {
    return { error: msg(e) }
  }
}

export async function cancelar(importacaoId: string): Promise<R> {
  const a = await acessoImportacao(importacaoId)
  if ('erro' in a) return { error: a.erro }
  if (['concluida', 'cancelada'].includes(a.imp.status)) return {}
  await cancelarImportacao(importacaoId)
  return {}
}

export async function desfazer(importacaoId: string): Promise<R<{ apagados: number }>> {
  const a = await acessoImportacao(importacaoId)
  if ('erro' in a) return { error: a.erro }
  if (a.imp.status === 'importando') return { error: 'Cancele ou espere terminar antes de desfazer.' }
  const apagados = await desfazerImportacao(importacaoId)
  updateTag(TAG_IMOVEIS)
  return { apagados }
}

export async function tentarErrosDeNovo(importacaoId: string): Promise<R> {
  const a = await acessoImportacao(importacaoId)
  if ('erro' in a) return { error: a.erro }
  if (a.imp.status !== 'concluida') return { error: 'Só depois de terminar.' }
  await reprocessarErros(importacaoId)
  return {}
}

export async function verAusentes(importacaoId: string): Promise<R<{ ausentes: Array<{ id: string; titulo: string; codigo: string }> }>> {
  const a = await acessoImportacao(importacaoId)
  if ('erro' in a) return { error: a.erro }
  const lista = await listarAusentes(importacaoId)
  return { ausentes: lista.map(l => ({ id: l.id, titulo: l.titulo, codigo: l.importacao_codigo })) }
}

export async function pausarOsAusentes(importacaoId: string, ids: string[]): Promise<R<{ pausados: number }>> {
  const a = await acessoImportacao(importacaoId)
  if ('erro' in a) return { error: a.erro }
  const pausados = await pausarAusentes(importacaoId, ids)
  if (pausados) updateTag(TAG_IMOVEIS)
  return { pausados }
}

// ── URLs salvas ──────────────────────────────────────────────────────

async function acessoFonte(fonteId: string) {
  const eu = await quem()
  if (!eu) return { erro: 'Não autenticado' as const }
  const { data: f } = await createAdminClient().from('importacoes_fontes').select('id, user_id, url, nome').eq('id', fonteId).maybeSingle()
  if (!f) return { erro: 'URL salva não encontrada' as const }
  if (f.user_id !== eu.id && !eu.admin) return { erro: 'Sem permissão' as const }
  return { eu, f }
}

export async function configurarSincronizacao(fonteId: string, sincronizar: boolean, pausar?: boolean): Promise<R> {
  const a = await acessoFonte(fonteId)
  if ('erro' in a) return { error: a.erro }
  const db = createAdminClient()
  const { data: f } = await db.from('importacoes_fontes').select('opcoes').eq('id', fonteId).single()
  const opcoes = { ...opcoesValidas(f?.opcoes as Partial<OpcoesImportacao>, a.eu.admin) }
  if (typeof pausar === 'boolean') opcoes.pausarAusentes = pausar
  const { error } = await db.from('importacoes_fontes').update({ sincronizar, opcoes }).eq('id', fonteId)
  if (error) return { error: error.message }
  return {}
}

export async function removerFonte(fonteId: string): Promise<R> {
  const a = await acessoFonte(fonteId)
  if ('erro' in a) return { error: a.erro }
  const { error } = await createAdminClient().from('importacoes_fontes').delete().eq('id', fonteId)
  if (error) return { error: error.message }
  return {}
}

export async function importarFonteDeNovo(fonteId: string): Promise<R<{ id: string }>> {
  const a = await acessoFonte(fonteId)
  if ('erro' in a) return { error: a.erro }
  return importarDeUrl({ url: a.f.url, nome: a.f.nome ?? undefined, salvarFonte: true, alvoUserId: a.f.user_id })
}
