'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { SEED_CLAUSULAS } from '@/lib/contratos/seed-modelo'
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
 * Popula a tabela com o seed das cláusulas do contrato modelo IMOBILIATTO.
 *
 * Se `sobrescrever=true`, apaga TODAS as cláusulas atuais do usuário antes
 * de reimportar — útil pra quem já importou uma versão antiga do seed e
 * quer pegar os textos mais novos. Cuidado: edições manuais são perdidas.
 */
export async function importarContratoModelo(sobrescrever = false) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { count } = await supabase
    .from('contrato_clausulas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', acesso.userId)

  if ((count ?? 0) > 0 && !sobrescrever) {
    return { error: 'Você já tem cláusulas cadastradas. Use "Reimportar" pra sobrescrever ou exclua-as manualmente antes.' }
  }

  if (sobrescrever && (count ?? 0) > 0) {
    const { error: delErr } = await supabase
      .from('contrato_clausulas')
      .delete()
      .eq('user_id', acesso.userId)
    if (delErr) return { error: `Falha ao limpar cláusulas atuais: ${delErr.message}` }
  }

  const rows = SEED_CLAUSULAS.map(c => ({
    user_id: acesso.userId,
    tipo: c.tipo,
    categoria: c.categoria,
    titulo: c.titulo,
    numero: c.numero,
    corpo: c.corpo,
    ativa: true,
  }))

  const { error } = await supabase.from('contrato_clausulas').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/painel/contratos/clausulas')
  return { ok: true, importadas: rows.length }
}

/**
 * Adiciona apenas as cláusulas do seed que AINDA NÃO existem no banco do user
 * (matching por titulo+tipo). Útil pra puxar cláusulas novas que entraram no
 * seed sem apagar nada que o usuário já editou.
 */
export async function importarClausulasFaltantes() {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: existentes } = await supabase
    .from('contrato_clausulas')
    .select('titulo, tipo')
    .eq('user_id', acesso.userId)

  const setExistente = new Set((existentes ?? []).map(c => `${c.tipo}::${c.titulo}`))

  const faltantes = SEED_CLAUSULAS.filter(c => !setExistente.has(`${c.tipo}::${c.titulo}`))

  if (faltantes.length === 0) {
    return { ok: true, importadas: 0, mensagem: 'Banco já está em dia — nada a importar.' }
  }

  const rows = faltantes.map(c => ({
    user_id: acesso.userId,
    tipo: c.tipo,
    categoria: c.categoria,
    titulo: c.titulo,
    numero: c.numero,
    corpo: c.corpo,
    ativa: true,
  }))

  const { error } = await supabase.from('contrato_clausulas').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/painel/contratos/clausulas')
  return { ok: true, importadas: rows.length, mensagem: `${rows.length} cláusula(s) nova(s) importada(s).` }
}
