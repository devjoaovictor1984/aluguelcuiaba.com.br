'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sessaoAtual } from '@/lib/homologacao/sessao'
import {
  diagnosticarIncendio,
  type EntradaDiagnostico, type ResultadoDiagnostico,
} from '@/lib/seguros/incendio/diagnostico'

/**
 * Roda o diagnóstico para quem está numa sessão de homologação.
 *
 * A checagem de sessão é AQUI, e não só na página: server action é um
 * endpoint POST público, e quem souber o nome da função chama direto.
 *
 * O CNPJ não vem do formulário. Vem do perfil de quem abriu a sessão —
 * a imobiliária cujo cadastro está sendo investigado. Deixar o CNPJ ser
 * digitado transformaria esta tela num consultor de CNPJ alheio na base
 * da corretora, que não é o que ela é.
 */
export async function rodarDiagnosticoIncendio(
  entrada: EntradaDiagnostico,
): Promise<{ resultado?: ResultadoDiagnostico; error?: string }> {
  const sessao = await sessaoAtual()
  if (!sessao) {
    return { error: 'Sessão encerrada ou expirada. Peça um link novo.' }
  }

  const admin = createAdminClient()

  const { data: linha } = await admin
    .from('sessoes_homologacao')
    .select('criado_por')
    .eq('id', sessao.id)
    .maybeSingle()

  const criadoPor = (linha as { criado_por?: string } | null)?.criado_por
  if (!criadoPor) return { error: 'Não foi possível identificar a imobiliária desta sessão.' }

  const { data: perfil } = await admin
    .from('perfis')
    .select('cnpj, cpf')
    .eq('id', criadoPor)
    .maybeSingle()

  const p = perfil as { cnpj?: string | null; cpf?: string | null } | null
  const cnpj = (p?.cnpj ?? p?.cpf ?? '').replace(/\D/g, '')
  if (!cnpj) return { error: 'A imobiliária desta sessão está sem CNPJ no cadastro.' }

  if (!(entrada.aluguel > 0)) return { error: 'Informe o valor do aluguel.' }
  if (!entrada.inquilino.nome.trim()) return { error: 'Informe o nome do inquilino.' }
  if (!entrada.proprietario.nome.trim()) return { error: 'Informe o nome do proprietário.' }

  try {
    const resultado = await diagnosticarIncendio(admin, cnpj, entrada, sessao.usuarioId)
    return { resultado }
  } catch (e) {
    // Nenhum passo derruba o diagnóstico — se caiu aqui, foi coisa nossa.
    return { error: e instanceof Error ? e.message : 'Falha inesperada no diagnóstico.' }
  }
}
