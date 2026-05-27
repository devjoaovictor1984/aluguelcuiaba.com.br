'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'

type TipoSeguroIncendio = 'dispensado' | 'cobrado_parte' | 'embutido_pacote'

export interface OpcoesGeracao {
  tipo_seguro_incendio: TipoSeguroIncendio
  saida_sem_multa_12m: boolean
}

/**
 * Seleciona quais cláusulas entram numa geração baseado nas opções:
 *  - todas as 'generica'
 *  - 1 cláusula de garantia (tipo = contratos_locacao.garantia_tipo)
 *  - 1 cláusula de seguro_incendio (categoria = tipo_seguro_incendio)
 *
 * Retorna IDs ordenados pelo número de cada cláusula.
 */
async function selecionarClausulasIniciais(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  garantiaTipo: string,
  tipoSeguroIncendio: TipoSeguroIncendio,
): Promise<string[]> {
  const { data: clausulas } = await supabase
    .from('contrato_clausulas')
    .select('id, tipo, categoria, numero')
    .eq('user_id', userId)
    .eq('ativa', true)
    .order('numero', { ascending: true })

  if (!clausulas) return []

  const selecionadas = clausulas.filter(c => {
    if (c.tipo === 'generica') return true
    if (c.tipo === garantiaTipo) return true                                  // 'sem_garantia', 'caucao', 'fiador' ou 'seguro_fianca'
    if (c.tipo === 'seguro_incendio' && c.categoria === tipoSeguroIncendio) return true
    return false
  })

  // Ordena: primeiro por número (genéricas em sequência), garantia entra no número 10, seguro incêndio no 11
  return selecionadas
    .sort((a, b) => a.numero - b.numero)
    .map(c => c.id)
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
    .select('id, user_id, garantia_tipo')
    .eq('id', contratoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!contrato) return { error: 'Contrato não encontrado.' }

  // Já existe geração?
  const { data: existente } = await supabase
    .from('contrato_geracoes')
    .select('*')
    .eq('contrato_id', contratoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existente) return { ok: true, geracao: existente }

  // Cria nova com defaults
  const clausulaIds = await selecionarClausulasIniciais(
    supabase, acesso.userId, contrato.garantia_tipo, 'dispensado'
  )

  const { data: nova, error } = await supabase
    .from('contrato_geracoes')
    .insert({
      user_id: acesso.userId,
      contrato_id: contratoId,
      tipo_seguro_incendio: 'dispensado',
      saida_sem_multa_12m: false,
      clausula_ids: clausulaIds,
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
 * Atualiza as opções de uma geração. Se tipo_seguro_incendio mudou,
 * re-seleciona as cláusulas (troca a de seguro incêndio).
 */
export async function atualizarOpcoesGeracao(geracaoId: string, opcoes: OpcoesGeracao) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: atual } = await supabase
    .from('contrato_geracoes')
    .select('id, contrato_id, tipo_seguro_incendio, clausula_ids, contratos_locacao:contratos_locacao!inner(garantia_tipo)')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!atual) return { error: 'Geração não encontrada.' }

  let clausulaIds = atual.clausula_ids as string[]

  // Trocou o tipo de seguro incêndio? Re-seleciona pra trocar a cláusula
  if (atual.tipo_seguro_incendio !== opcoes.tipo_seguro_incendio) {
    const contratoRel = Array.isArray(atual.contratos_locacao) ? atual.contratos_locacao[0] : atual.contratos_locacao
    clausulaIds = await selecionarClausulasIniciais(
      supabase, acesso.userId, contratoRel.garantia_tipo, opcoes.tipo_seguro_incendio
    )
  }

  const { error } = await supabase
    .from('contrato_geracoes')
    .update({
      tipo_seguro_incendio: opcoes.tipo_seguro_incendio,
      saida_sem_multa_12m: opcoes.saida_sem_multa_12m,
      clausula_ids: clausulaIds,
    })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${atual.contrato_id}/gerar`)
  return { ok: true, clausula_ids: clausulaIds }
}

/**
 * Atualiza a ordem das cláusulas (após drag-and-drop).
 */
export async function atualizarOrdemClausulas(geracaoId: string, novaOrdem: string[]) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  if (!Array.isArray(novaOrdem)) return { error: 'Ordem inválida.' }

  const { data: g } = await supabase
    .from('contrato_geracoes')
    .select('id, contrato_id')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }

  const { error } = await supabase
    .from('contrato_geracoes')
    .update({ clausula_ids: novaOrdem })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${g.contrato_id}/gerar`)
  return { ok: true }
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
 * Inclui ou remove uma cláusula adicional na geração.
 */
export async function alternarClausulaNaGeracao(geracaoId: string, clausulaId: string, incluir: boolean) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()

  const { data: g } = await supabase
    .from('contrato_geracoes')
    .select('id, contrato_id, clausula_ids')
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
    .maybeSingle()
  if (!g) return { error: 'Geração não encontrada.' }

  const ids = (g.clausula_ids ?? []) as string[]
  const novaLista = incluir
    ? (ids.includes(clausulaId) ? ids : [...ids, clausulaId])
    : ids.filter(id => id !== clausulaId)

  const { error } = await supabase
    .from('contrato_geracoes')
    .update({ clausula_ids: novaLista })
    .eq('id', geracaoId)
    .eq('user_id', acesso.userId)
  if (error) return { error: error.message }

  revalidatePath(`/painel/contratos/${g.contrato_id}/gerar`)
  return { ok: true }
}
