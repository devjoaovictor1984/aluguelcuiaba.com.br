import { redirect } from 'next/navigation'
import { exigirAcessoCRM, type AcessoCRM } from '@/lib/crm/acesso'

/**
 * O módulo tem como funcionar neste ambiente?
 *
 * As credenciais da corretora vivem só no `.env.local`, que é gitignored:
 * a produção nunca as recebeu, e não deve receber enquanto não existir
 * credencial de produção e contrato assinado — a URL da API é a mesma nos
 * dois ambientes, e quem decide entre teste e emissão real é uma variável.
 *
 * Sem esta checagem o módulo fica visível e quebrado no site publicado: o
 * admin abre Seguros, preenche uma análise inteira e só no envio leva um
 * "Falha ao chamar /apiImobiliaria/cadastrarImobiliaria" — que parece
 * problema da corretora quando é configuração ausente. Aconteceu em
 * 15/08/2026.
 *
 * O ambiente é exigido junto porque `ambienteMaximiza()` lança sem ele, e
 * o simulador conta como configurado: ele existe justamente para rodar o
 * módulo sem credencial.
 */
export function segurosConfigurado(): boolean {
  const ambiente = process.env.MAXIMIZA_AMBIENTE
  if (ambiente !== '1' && ambiente !== '2') return false
  if (process.env.MAXIMIZA_DEMO === '1') return true
  return !!(process.env.MAXIMIZA_EMAIL && process.env.MAXIMIZA_SENHA)
}

/**
 * Porta de entrada do módulo de seguros — hoje restrito a admin.
 *
 * A integração roda em homologação e o modelo comercial ainda não fechou,
 * então quem cadastra imóvel na plataforma não pode esbarrar no módulo e
 * achar que cotou de verdade. Quando a parceria ligar, é aqui que a regra
 * afrouxa — um lugar só.
 *
 * Vale para pages E server actions: esconder o item do menu não protege
 * nada, porque a action é um endpoint POST público e a rota responde por
 * URL direta.
 */
export async function exigirAcessoSeguros(): Promise<AcessoCRM> {
  const acesso = await exigirAcessoCRM()
  if (acesso.role !== 'admin') redirect('/painel')
  // Mesmo destino do não-admin: num ambiente sem credencial o módulo não
  // existe de fato, e deixá-lo abrir só para falhar lá na frente é pior
  // que não abrir.
  if (!segurosConfigurado()) redirect('/painel')
  return acesso
}
