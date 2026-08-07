import { redirect } from 'next/navigation'
import { exigirAcessoCRM, type AcessoCRM } from '@/lib/crm/acesso'

/**
 * Porta de entrada do módulo de seguros — hoje restrito a admin.
 *
 * A integração com a corretora ainda não está ligada (falta credencial de
 * API), então o módulo roda em simulador. Quem cadastra imóvel na
 * plataforma não pode esbarrar nele e achar que cotou de verdade.
 *
 * Vale para pages E server actions: esconder o item do menu não protege
 * nada, porque a action é um endpoint POST público e a rota responde por
 * URL direta. Quando a credencial chegar, é aqui que a regra afrouxa —
 * um lugar só.
 */
export async function exigirAcessoSeguros(): Promise<AcessoCRM> {
  const acesso = await exigirAcessoCRM()
  if (acesso.role !== 'admin') redirect('/painel')
  return acesso
}
