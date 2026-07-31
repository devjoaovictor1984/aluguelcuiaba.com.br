import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { Parecer } from './tipos'

/**
 * Persistência e leitura agregada dos pareceres.
 *
 * Vive fora das actions porque o webhook também precisa disso, e as duas
 * pontas têm que gravar exatamente igual.
 */

type Admin = ReturnType<typeof createAdminClient>

/**
 * Grava/atualiza os pareceres de uma análise.
 *
 * Upsert por (analise_id, seguradora_sigla): a mesma seguradora responde
 * várias vezes ao longo da análise e cada resposta substitui a anterior.
 */
export async function gravarPareceres(
  admin: Admin,
  analiseId: string,
  pareceres: Parecer[],
): Promise<void> {
  if (!pareceres.length) return

  const linhas = pareceres
    .filter(p => p.seguradoraSigla)
    .map(p => ({
      analise_id: analiseId,
      seguradora_sigla: p.seguradoraSigla,
      seguradora_nome: p.seguradoraNome,
      codigo_status: p.codigoStatus,
      descricao_status: p.descricaoStatus,
      codigo_analise: p.codigoAnalise,
      limite_aprovado: p.limiteAprovado,
      status_biometria: p.statusBiometria,
      link_biometria: p.linkBiometria,
      msg: p.msg,
      atualizado_em: new Date().toISOString(),
    }))

  if (linhas.length) {
    await admin.from('seguro_analise_pareceres')
      .upsert(linhas, { onConflict: 'analise_id,seguradora_sigla' })
  }
}

/**
 * Atualiza UM parecer sem mexer nos outros — é o caso do webhook, que
 * fala de uma seguradora por vez.
 */
export async function gravarParecerUnico(
  admin: Admin,
  analiseId: string,
  parcial: Partial<Parecer> & { seguradoraSigla: string },
): Promise<void> {
  const patch: Record<string, unknown> = {
    analise_id: analiseId,
    seguradora_sigla: parcial.seguradoraSigla,
    atualizado_em: new Date().toISOString(),
  }
  if (parcial.seguradoraNome !== undefined) patch.seguradora_nome = parcial.seguradoraNome
  if (parcial.codigoStatus !== undefined) patch.codigo_status = parcial.codigoStatus
  if (parcial.descricaoStatus !== undefined) patch.descricao_status = parcial.descricaoStatus
  if (parcial.codigoAnalise !== undefined) patch.codigo_analise = parcial.codigoAnalise
  if (parcial.limiteAprovado !== undefined) patch.limite_aprovado = parcial.limiteAprovado
  if (parcial.statusBiometria !== undefined) patch.status_biometria = parcial.statusBiometria
  if (parcial.linkBiometria !== undefined) patch.link_biometria = parcial.linkBiometria
  if (parcial.msg !== undefined) patch.msg = parcial.msg

  await admin.from('seguro_analise_pareceres')
    .upsert(patch, { onConflict: 'analise_id,seguradora_sigla' })
}

// resumirStatus e os rótulos vivem em status-ui.ts: as telas do cliente
// precisam deles, e este arquivo é server-only.
export { resumirStatus } from './status-ui'
