'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { SEED_CLAUSULAS } from '@/lib/contratos/seed-modelo'
import {
  MODELO_POR_CODIGO, codigoDoSeed, linhaDoModelo, modeloDaLinha, versaoBaseDaLinha, versaoDoSeed,
} from '@/lib/contratos/modelo'
import type { TipoClausula } from '@/lib/contratos/placeholders'

export interface ClausulaInput {
  tipo: TipoClausula
  categoria: string
  titulo: string
  numero: number
  corpo: string
}

const TIPOS_VALIDOS: TipoClausula[] = [
  'generica', 'sem_garantia', 'caucao', 'fiador', 'seguro_fianca', 'seguro_incendio',
  'adicional', 'administracao', 'atuacao', 'fundamentacao', 'mobilia', 'pet', 'aluguel_pacote',
  'finalidade',
]

function valida(input: ClausulaInput): string | null {
  if (!TIPOS_VALIDOS.includes(input.tipo)) return 'Tipo de cláusula inválido.'
  if (!input.categoria?.trim()) return 'Informe a categoria.'
  if (!input.titulo?.trim() || input.titulo.trim().length < 3) return 'Informe um título com pelo menos 3 caracteres.'
  if (!input.corpo?.trim() || input.corpo.trim().length < 10) return 'O corpo da cláusula precisa ter pelo menos 10 caracteres.'
  if (!Number.isFinite(input.numero) || input.numero < 0 || input.numero > 999) return 'Número inválido.'
  return null
}

export async function criarClausula(input: ClausulaInput) {
  const erro = valida(input)
  if (erro) return { error: erro }

  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('contrato_clausulas')
    .insert({
      user_id: acesso.userId,
      tipo: input.tipo,
      categoria: input.categoria.trim(),
      titulo: input.titulo.trim(),
      numero: Math.floor(input.numero),
      corpo: input.corpo.trim(),
      ativa: true,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/painel/contratos/clausulas')
  return { ok: true, id: data.id }
}

export async function atualizarClausula(id: string, input: ClausulaInput) {
  const erro = valida(input)
  if (erro) return { error: erro }

  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { error } = await supabase
    .from('contrato_clausulas')
    .update({
      tipo: input.tipo,
      categoria: input.categoria.trim(),
      titulo: input.titulo.trim(),
      numero: Math.floor(input.numero),
      corpo: input.corpo.trim(),
    })
    .eq('id', id)
    .eq('user_id', acesso.userId)

  if (error) return { error: error.message }
  revalidatePath('/painel/contratos/clausulas')
  return { ok: true }
}

export async function alternarAtiva(id: string, ativa: boolean) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { error } = await supabase
    .from('contrato_clausulas')
    .update({ ativa })
    .eq('id', id)
    .eq('user_id', acesso.userId)

  if (error) return { error: error.message }
  revalidatePath('/painel/contratos/clausulas')
  return { ok: true }
}

export async function excluirClausula(id: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { error } = await supabase
    .from('contrato_clausulas')
    .delete()
    .eq('id', id)
    .eq('user_id', acesso.userId)

  if (error) return { error: error.message }
  revalidatePath('/painel/contratos/clausulas')
  return { ok: true }
}

/**
 * Reimporta SOMENTE as cláusulas de administração (tipo='administracao'):
 * apaga as atuais desse tipo e reinsere as do seed. Não toca nas cláusulas
 * de locação que o usuário possa ter editado. Útil quando o modelo de
 * administração é atualizado e o user quer pegar a versão nova.
 */
export async function reimportarClausulasAdministracao() {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { error: delErr } = await supabase
    .from('contrato_clausulas')
    .delete()
    .eq('user_id', acesso.userId)
    .eq('tipo', 'administracao')
  if (delErr) return { error: `Falha ao limpar cláusulas de administração: ${delErr.message}` }

  const rows = SEED_CLAUSULAS
    .filter(c => c.tipo === 'administracao')
    .map(c => linhaDoModelo(c, acesso.userId))

  const { error } = await supabase.from('contrato_clausulas').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/painel/administracoes/clausulas')
  revalidatePath('/painel/contratos/clausulas')
  return { ok: true, importadas: rows.length, mensagem: `${rows.length} cláusula(s) de administração reimportada(s).` }
}

/**
 * Reimporta SOMENTE as cláusulas de LOCAÇÃO (todos os tipos exceto
 * 'administracao'). Não toca nas de administração. Substitui o "Reimportar
 * modelo" completo, que era perigoso (apagava tudo).
 */
export async function reimportarClausulasLocacao() {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { error: delErr } = await supabase
    .from('contrato_clausulas')
    .delete()
    .eq('user_id', acesso.userId)
    .neq('tipo', 'administracao')
  if (delErr) return { error: `Falha ao limpar cláusulas de locação: ${delErr.message}` }

  const rows = SEED_CLAUSULAS
    .filter(c => c.tipo !== 'administracao')
    .map(c => linhaDoModelo(c, acesso.userId))

  const { error } = await supabase.from('contrato_clausulas').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/painel/contratos/clausulas')
  return { ok: true, importadas: rows.length, mensagem: `${rows.length} cláusula(s) de locação reimportada(s).` }
}

/**
 * Adiciona apenas as cláusulas do seed que AINDA NÃO existem no banco do user
 * (matching por titulo+tipo). Útil pra puxar cláusulas novas que entraram no
 * seed sem apagar nada que o usuário já editou.
 */
export async function importarClausulasFaltantes(escopo?: 'locacao' | 'administracao') {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: existentes } = await supabase
    .from('contrato_clausulas')
    .select('titulo, tipo, codigo')
    .eq('user_id', acesso.userId)

  const setExistente = new Set((existentes ?? []).map(c => `${c.tipo}::${c.titulo}`))
  const codigosExistentes = new Set((existentes ?? []).map(c => c.codigo).filter(Boolean))

  let faltantes = SEED_CLAUSULAS.filter(c =>
    !codigosExistentes.has(codigoDoSeed(c)) && !setExistente.has(`${c.tipo}::${c.titulo}`))
  if (escopo === 'administracao') faltantes = faltantes.filter(c => c.tipo === 'administracao')
  else if (escopo === 'locacao') faltantes = faltantes.filter(c => c.tipo !== 'administracao')

  if (faltantes.length === 0) {
    return { ok: true, importadas: 0, mensagem: 'Banco já está em dia — nada a importar.' }
  }

  const rows = faltantes.map(c => linhaDoModelo(c, acesso.userId))

  const { error } = await supabase.from('contrato_clausulas').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/painel/contratos/clausulas')
  revalidatePath('/painel/administracoes/clausulas')
  return { ok: true, importadas: rows.length, mensagem: `${rows.length} cláusula(s) nova(s) importada(s).` }
}

// ════════════════════════════════════════════════════════════════════
//  v105 — vínculo com o modelo, atualização, histórico e duplicação
// ════════════════════════════════════════════════════════════════════

function revalidarBibliotecas() {
  revalidatePath('/painel/contratos/clausulas')
  revalidatePath('/painel/administracoes/clausulas')
}

/**
 * Liga as cláusulas antigas da biblioteca (sem código) à cláusula do modelo
 * de mesmo tipo e título. Não mexe no texto — por isso o gatilho não gera
 * versão. Idempotente: roda a cada abertura da biblioteca e só toca o que
 * ainda não tem código.
 */
export async function vincularBibliotecaAoModelo(): Promise<{ vinculadas: number }> {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: soltas, error } = await supabase
    .from('contrato_clausulas')
    .select('id, tipo, titulo, corpo')
    .eq('user_id', acesso.userId)
    .is('codigo', null)
  // Banco sem a v105: a coluna não existe e a biblioteca segue como antes.
  if (error || !soltas) return { vinculadas: 0 }

  let vinculadas = 0
  for (const row of soltas) {
    const modelo = modeloDaLinha(row)
    if (!modelo) continue
    const { error: e } = await supabase
      .from('contrato_clausulas')
      .update({ codigo: codigoDoSeed(modelo), modelo_versao: versaoBaseDaLinha(row, modelo) })
      .eq('id', row.id)
      .eq('user_id', acesso.userId)
    if (!e) vinculadas++
  }
  return { vinculadas }
}

/** Troca o texto da cláusula pelo do modelo atual. O texto anterior vai pro histórico. */
export async function aplicarAtualizacaoModelo(id: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('contrato_clausulas')
    .select('id, codigo')
    .eq('id', id)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  const modelo = row?.codigo ? MODELO_POR_CODIGO.get(row.codigo) : null
  if (!row || !modelo) return { error: 'Esta cláusula não vem do modelo.' }

  const { error } = await supabase
    .from('contrato_clausulas')
    .update({ titulo: modelo.titulo, corpo: modelo.corpo, modelo_versao: versaoDoSeed(modelo) })
    .eq('id', id)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  revalidarBibliotecas()
  return { ok: true }
}

/** Mantém o texto atual e marca a versão do modelo como vista. */
export async function dispensarAtualizacaoModelo(id: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('contrato_clausulas')
    .select('id, codigo')
    .eq('id', id)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  const modelo = row?.codigo ? MODELO_POR_CODIGO.get(row.codigo) : null
  if (!row || !modelo) return { error: 'Esta cláusula não vem do modelo.' }

  const { error } = await supabase
    .from('contrato_clausulas')
    .update({ modelo_versao: versaoDoSeed(modelo) })
    .eq('id', id)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  revalidarBibliotecas()
  return { ok: true }
}

export interface VersaoHistorico {
  id: string
  versao: number
  titulo: string
  corpo: string
  evento: 'edicao' | 'exclusao'
  registrado_em: string
}

export async function listarHistoricoClausula(id: string): Promise<{ versoes?: VersaoHistorico[]; error?: string }> {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contrato_clausulas_historico')
    .select('id, versao, titulo, corpo, evento, registrado_em')
    .eq('clausula_id', id)
    .eq('user_id', acesso.userId)
    .order('versao', { ascending: false })
    .limit(50)
  if (error) return { error: 'Histórico indisponível (a migration v105 já rodou?).' }
  return { versoes: (data ?? []) as VersaoHistorico[] }
}

/** Volta a cláusula pra uma versão anterior. A atual vai pro histórico. */
export async function restaurarVersaoClausula(id: string, historicoId: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: h } = await supabase
    .from('contrato_clausulas_historico')
    .select('titulo, corpo')
    .eq('id', historicoId)
    .eq('clausula_id', id)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!h) return { error: 'Versão não encontrada.' }

  const { error } = await supabase
    .from('contrato_clausulas')
    .update({ titulo: h.titulo, corpo: h.corpo })
    .eq('id', id)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }
  revalidarBibliotecas()
  return { ok: true }
}

/**
 * Cópia editável de uma cláusula. Nasce DESATIVADA e sem código: uma cópia
 * ativa de uma cláusula genérica entraria sozinha em todo contrato novo,
 * duplicando a original.
 */
export async function duplicarClausula(id: string) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('contrato_clausulas')
    .select('tipo, categoria, titulo, numero, corpo')
    .eq('id', id)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!row) return { error: 'Cláusula não encontrada.' }

  const { data, error } = await supabase
    .from('contrato_clausulas')
    .insert({ ...row, user_id: acesso.userId, titulo: `${row.titulo} (cópia)`, ativa: false })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidarBibliotecas()
  return { ok: true, id: data.id }
}
