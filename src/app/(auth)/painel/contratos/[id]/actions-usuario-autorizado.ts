'use server'

/**
 * Ações do usuário autorizado (papel ocupante_autorizado): responsabilidades
 * do vínculo, comprovante da troca de titularidade e ciência da seguradora.
 *
 * Cada mudança de responsabilidade grava um evento em `eventos_contrato`
 * (tipo contrato_atualizado) — é o histórico que aparece na linha do tempo.
 * Comprovantes vão pro mesmo bucket e tabela das apólices
 * (contratos-docs / contratos_documentos, tipo 'outro').
 */
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { CONSUMOS, type Consumo } from '@/lib/contratos/usuario-autorizado'

const BUCKET = 'contratos-docs'
const MAX_FILE = 20 * 1024 * 1024
const MIMES_OK = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

type Admin = ReturnType<typeof createAdminClient>

async function contratoDoUsuario(admin: Admin, contratoId: string, userId: string) {
  const { data } = await admin
    .from('contratos_locacao')
    .select('id')
    .eq('id', contratoId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

/** Vínculo + contrato, garantindo que o contrato é do operador. */
async function vinculoDoUsuario(admin: Admin, moradorId: string, userId: string) {
  const { data } = await admin
    .from('contratos_moradores')
    .select('id, contrato_id, papel, consumos_titular, atividade_no_imovel, pessoa:pessoas(nome)')
    .eq('id', moradorId)
    .maybeSingle()
  if (!data) return null
  const c = await contratoDoUsuario(admin, data.contrato_id, userId)
  return c ? data : null
}

async function registrarHistorico(
  admin: Admin, contratoId: string, userId: string, descricao: string, metadata: Record<string, unknown>,
) {
  await admin.from('eventos_contrato').insert({
    contrato_id: contratoId, user_id: userId, tipo: 'contrato_atualizado', descricao, metadata,
  })
}

const dataValida = (v: FormDataEntryValue | null): string | null =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null

const texto = (v: FormDataEntryValue | null, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim().slice(0, max)
  return t || null
}

async function anexarComprovante(
  admin: Admin, userId: string, contratoId: string, file: File, observacoes: string,
): Promise<{ id: string } | { error: string }> {
  if (file.size > MAX_FILE) return { error: 'Arquivo maior que 20MB.' }
  if (!MIMES_OK.includes(file.type)) return { error: 'Envie PDF ou imagem (JPG/PNG).' }
  const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]
  const path = `${userId}/${contratoId}/comprovante-${crypto.randomUUID()}.${ext}`
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (upErr) return { error: `Falha no upload: ${upErr.message}` }
  const { data, error } = await admin.from('contratos_documentos').insert({
    contrato_id: contratoId,
    user_id: userId,
    tipo: 'outro',
    origem: 'manual',
    nome: file.name.slice(0, 255),
    nome_original: file.name.slice(0, 255),
    arquivo_path: path,
    tamanho: file.size,
    tamanho_bytes: file.size,
    mime_type: file.type,
    observacoes: observacoes.slice(0, 500),
  }).select('id').single()
  if (error || !data) {
    await admin.storage.from(BUCKET).remove([path])
    return { error: error?.message ?? 'Falha ao registrar o comprovante.' }
  }
  return { id: data.id }
}

// ── Responsabilidades do vínculo ────────────────────────────────────

export async function salvarResponsabilidadesUsuario(input: {
  morador_id: string
  atividade_no_imovel: string | null
  consumos_titular: Consumo[]
  /** Prazo da troca de titularidade (vale pro contrato todo). */
  prazo_titularidade_dias_uteis?: number | null
}) {
  const acesso = await exigirAcessoCRM()
  const admin = createAdminClient()
  const v = await vinculoDoUsuario(admin, input.morador_id, acesso.userId)
  if (!v) return { error: 'Vínculo não encontrado.' }
  if (v.papel !== 'ocupante_autorizado') return { error: 'Só o usuário autorizado tem essas responsabilidades.' }

  const consumos = [...new Set(input.consumos_titular)].filter(c => CONSUMOS.some(x => x.valor === c))
  const atividade = input.atividade_no_imovel?.trim().slice(0, 300) || null

  const { error } = await admin
    .from('contratos_moradores')
    .update({ consumos_titular: consumos, atividade_no_imovel: atividade })
    .eq('id', v.id)
  if (error) return { error: error.message }

  if (input.prazo_titularidade_dias_uteis != null) {
    const prazo = Math.round(input.prazo_titularidade_dias_uteis)
    if (prazo < 1 || prazo > 90) return { error: 'Prazo da titularidade deve ficar entre 1 e 90 dias úteis.' }
    await admin.from('contratos_locacao').update({ prazo_titularidade_dias_uteis: prazo }).eq('id', v.contrato_id)
  }

  const pessoa = Array.isArray(v.pessoa) ? v.pessoa[0] : v.pessoa
  const antes = (v.consumos_titular ?? []) as string[]
  if (antes.join() !== consumos.join() || (v.atividade_no_imovel ?? null) !== atividade) {
    const nomes = (l: string[]) => l.map(c => CONSUMOS.find(x => x.valor === c)?.label ?? c).join(', ') || 'nenhuma'
    await registrarHistorico(admin, v.contrato_id, acesso.userId,
      `Responsabilidades de ${pessoa?.nome ?? 'usuário autorizado'} alteradas: contas ${nomes(antes)} → ${nomes(consumos)}${atividade ? `; atividade: ${atividade}` : ''}`,
      { morador_id: v.id, consumos_antes: antes, consumos_depois: consumos, atividade_antes: v.atividade_no_imovel, atividade_depois: atividade })
  }

  revalidatePath(`/painel/contratos/${v.contrato_id}`)
  return { ok: true }
}

// ── Troca de titularidade comprovada ────────────────────────────────

export async function confirmarTitularidade(formData: FormData) {
  const acesso = await exigirAcessoCRM()
  const admin = createAdminClient()
  const moradorId = texto(formData.get('morador_id'), 64)
  if (!moradorId) return { error: 'Vínculo inválido.' }
  const v = await vinculoDoUsuario(admin, moradorId, acesso.userId)
  if (!v) return { error: 'Vínculo não encontrado.' }

  const desfazer = formData.get('desfazer') === '1'
  const pessoa = Array.isArray(v.pessoa) ? v.pessoa[0] : v.pessoa

  if (desfazer) {
    await admin.from('contratos_moradores')
      .update({ titularidade_confirmada_em: null, titularidade_comprovante_id: null }).eq('id', v.id)
    await registrarHistorico(admin, v.contrato_id, acesso.userId,
      `Confirmação da troca de titularidade de ${pessoa?.nome ?? ''} desfeita`, { morador_id: v.id })
    revalidatePath(`/painel/contratos/${v.contrato_id}`)
    return { ok: true }
  }

  const data = dataValida(formData.get('data'))
  if (!data) return { error: 'Informe a data da transferência.' }
  const file = formData.get('file')
  // Sem comprovante não confirma: a cláusula assinada não prova a troca.
  if (!(file instanceof File) || file.size === 0) return { error: 'Anexe o comprovante da concessionária.' }

  const doc = await anexarComprovante(admin, acesso.userId, v.contrato_id, file,
    `Comprovante de troca de titularidade — ${pessoa?.nome ?? ''}`)
  if ('error' in doc) return doc

  const { error } = await admin.from('contratos_moradores')
    .update({ titularidade_confirmada_em: data, titularidade_comprovante_id: doc.id }).eq('id', v.id)
  if (error) return { error: error.message }
  await registrarHistorico(admin, v.contrato_id, acesso.userId,
    `Troca de titularidade de ${pessoa?.nome ?? ''} comprovada em ${data.split('-').reverse().join('/')}`,
    { morador_id: v.id, documento_id: doc.id })
  revalidatePath(`/painel/contratos/${v.contrato_id}`)
  return { ok: true }
}

// ── Ciência da seguradora ───────────────────────────────────────────

export async function registrarCienciaSeguradora(formData: FormData) {
  const acesso = await exigirAcessoCRM()
  const admin = createAdminClient()
  const contratoId = texto(formData.get('contrato_id'), 64)
  if (!contratoId || !(await contratoDoUsuario(admin, contratoId, acesso.userId))) {
    return { error: 'Contrato não encontrado.' }
  }

  if (formData.get('desfazer') === '1') {
    await admin.from('contratos_locacao').update({
      seguradora_ciente_usuario_em: null, seguradora_ciente_usuario_obs: null, seguradora_ciente_comprovante_id: null,
    }).eq('id', contratoId)
    await registrarHistorico(admin, contratoId, acesso.userId, 'Ciência da seguradora sobre o usuário autorizado desfeita', {})
    revalidatePath(`/painel/contratos/${contratoId}`)
    return { ok: true }
  }

  const data = dataValida(formData.get('data'))
  if (!data) return { error: 'Informe a data em que a seguradora foi informada.' }
  const obs = texto(formData.get('obs'), 500)

  let comprovanteId: string | null = null
  const file = formData.get('file')
  if (file instanceof File && file.size > 0) {
    const doc = await anexarComprovante(admin, acesso.userId, contratoId, file,
      'Ciência/aceite da seguradora sobre o usuário autorizado')
    if ('error' in doc) return doc
    comprovanteId = doc.id
  }

  const { error } = await admin.from('contratos_locacao').update({
    seguradora_ciente_usuario_em: data,
    seguradora_ciente_usuario_obs: obs,
    seguradora_ciente_comprovante_id: comprovanteId,
  }).eq('id', contratoId)
  if (error) return { error: error.message }
  await registrarHistorico(admin, contratoId, acesso.userId,
    `Seguradora ciente do usuário autorizado em ${data.split('-').reverse().join('/')}${obs ? ` — ${obs}` : ''}`,
    { documento_id: comprovanteId })
  revalidatePath(`/painel/contratos/${contratoId}`)
  return { ok: true }
}
