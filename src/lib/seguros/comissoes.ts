import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { PRO_LABORE_PADRAO } from './incendio/sugestoes'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Comissão de seguro — o registro do que foi vendido e do que se espera
 * receber por isso.
 *
 * São duas comissões independentes na mesma venda:
 *
 *  · a do CORRETOR, paga pela corretora direto a ele;
 *  · o OVERRIDE da plataforma, sobre o volume originado aqui.
 *
 * Uma não passa pela outra — a plataforma nunca deve ao corretor. Por
 * isso cada uma tem valor e estado próprios: o corretor pode já ter
 * recebido enquanto o override não caiu.
 *
 * ⚠️ Os percentuais ainda não foram acordados com a corretora (item 2.5
 * do documento de pendências). O do corretor é o pró-labore lido do
 * painel deles; o da plataforma não existe até alguém digitar. Enquanto
 * for nulo, a tela mostra a base de cálculo e diz "a definir" — o que é
 * honesto, e melhor que exibir um número inventado como se fosse acordo.
 */

/** Chave em `site_config` onde o admin guarda o override negociado. */
const CHAVE_OVERRIDE = 'seguro_override_percentual'

export interface Percentuais {
  corretor: number | null
  plataforma: number | null
}

/**
 * Os percentuais vigentes HOJE, para o produto.
 *
 * Só são usados no momento de criar a linha: depois disso o valor fica
 * congelado nela. Se a tabela mudar em dezembro, venda de agosto mantém
 * a taxa de agosto — sem isso o histórico se reescreve sozinho e nenhuma
 * conferência fecha.
 *
 * O percentual do corretor só é preenchido no INCÊNDIO, e por um motivo
 * específico: os 20% vêm da coluna "Pró-labore" do painel da corretora,
 * que só existe para esse produto. Para fiança não temos número nenhum —
 * e dizer ao corretor "você vai receber R$ 195" com base em chute é pior
 * que dizer "a definir". Nulo é resposta honesta; número inventado, não.
 */
export async function percentuaisVigentes(
  admin: Admin,
  produto: 'fianca' | 'incendio',
): Promise<Percentuais> {
  const { data } = await admin
    .from('site_config')
    .select('valor')
    .eq('chave', CHAVE_OVERRIDE)
    .maybeSingle()

  const bruto = Number(String(data?.valor ?? '').replace(',', '.'))
  // Aceita tanto 0.05 quanto 5 — quem digita no admin pensa em "5%".
  const plataforma = Number.isFinite(bruto) && bruto > 0
    ? (bruto > 1 ? bruto / 100 : bruto)
    : null

  return {
    corretor: produto === 'incendio' ? PRO_LABORE_PADRAO : null,
    plataforma,
  }
}

interface RegistroVenda {
  userId: string
  produto: 'fianca' | 'incendio'
  contratacaoId?: string
  apoliceIncendioId?: string
  pessoaId?: string | null
  contratoId?: string | null
  seguradoraSigla?: string | null
  apoliceNumero?: string | null
  premioTotal: number
}

/**
 * Registra a comissão de uma venda. Chamado logo depois da contratação.
 *
 * NUNCA lança: comissão que derruba a contratação que deveria remunerar
 * é troca ruim. Se falhar, a venda está feita e o registro pode ser
 * refeito depois — o contrário não é verdade.
 *
 * O índice único por origem torna a chamada idempotente: repetir não
 * duplica.
 */
export async function registrarComissao(admin: Admin, v: RegistroVenda): Promise<void> {
  try {
    const pct = await percentuaisVigentes(admin, v.produto)
    const premio = Number(v.premioTotal) || 0

    // Primeiro dia do mês da venda: é por competência que o extrato
    // agrupa, não pela data em que a linha foi criada.
    const hoje = new Date()
    const competencia = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1))
      .toISOString().slice(0, 10)

    await admin.from('seguro_comissoes').insert({
      user_id: v.userId,
      produto: v.produto,
      contratacao_id: v.contratacaoId ?? null,
      apolice_incendio_id: v.apoliceIncendioId ?? null,
      pessoa_id: v.pessoaId ?? null,
      contrato_id: v.contratoId ?? null,
      seguradora_sigla: v.seguradoraSigla ?? null,
      apolice_numero: v.apoliceNumero ?? null,
      premio_total: premio,
      competencia,
      percentual_corretor: pct.corretor,
      valor_corretor: pct.corretor != null ? Math.round(premio * pct.corretor * 100) / 100 : null,
      percentual_plataforma: pct.plataforma,
      valor_plataforma: pct.plataforma != null ? Math.round(premio * pct.plataforma * 100) / 100 : null,
    })
  } catch {
    /* silencioso de propósito — ver comentário acima */
  }
}

/**
 * A apólice foi cancelada: a comissão não é mais esperada.
 *
 * 'cancelada' e não 'estornada': estorno é o dinheiro voltando depois de
 * ter caído, e quem sabe disso é a conciliação, não o cancelamento. Se
 * já constava como recebida, preserva — aí é caso de estorno e alguém
 * precisa olhar.
 */
export async function cancelarComissao(
  admin: Admin,
  origem: { contratacaoId?: string; apoliceIncendioId?: string },
): Promise<void> {
  try {
    let q = admin.from('seguro_comissoes').update({
      status_corretor: 'cancelada',
      status_plataforma: 'cancelada',
      updated_at: new Date().toISOString(),
    })
    q = origem.contratacaoId
      ? q.eq('contratacao_id', origem.contratacaoId)
      : q.eq('apolice_incendio_id', origem.apoliceIncendioId!)

    await q.not('status_corretor', 'in', '("recebida","estornada")')
  } catch {
    /* silencioso de propósito */
  }
}
