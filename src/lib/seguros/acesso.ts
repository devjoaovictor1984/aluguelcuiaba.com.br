import { redirect } from 'next/navigation'
import { checarAcessoCRM, type AcessoCRM } from '@/lib/crm/acesso'
import { sessaoAtual } from '@/lib/homologacao/sessao'

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
  const acesso = await checarAcessoCRM()
  if (!acesso) redirect('/entrar?next=/painel/seguros/fianca')

  /**
   * Convidado de homologação (equipe técnica da corretora).
   *
   * Alcança este módulo e mais nada: `exigirAcessoCRM` continua barrando
   * o resto do CRM, e todo /admin exige role 'admin'. A sessão é
   * reconferida no banco a cada chamada — é o que faz "Revogar" cortar o
   * acesso na hora, em vez de esperar o cookie vencer.
   *
   * A comparação de usuarioId fecha a última brecha: cookie de sessão de
   * um convidado não serve para outra conta.
   */
  if (acesso.role === 'homologacao') {
    const sessao = await sessaoAtual()
    if (!sessao || sessao.usuarioId !== acesso.userId) {
      redirect('/homologacao/encerrada?motivo=expirada')
    }
    if (!segurosConfigurado()) redirect('/homologacao/encerrada?motivo=falha')
    return acesso
  }

  if (!acesso.liberado) redirect('/painel?upgrade=crm')
  if (acesso.role !== 'admin') redirect('/painel')
  // Mesmo destino do não-admin: num ambiente sem credencial o módulo não
  // existe de fato, e deixá-lo abrir só para falhar lá na frente é pior
  // que não abrir.
  if (!segurosConfigurado()) redirect('/painel')
  return acesso
}
