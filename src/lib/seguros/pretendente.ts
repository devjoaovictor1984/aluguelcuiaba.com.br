import type { AnaliseInput } from './tipos'

/**
 * Quem é o pretendente desta análise, para exibição.
 *
 * A cotação nasce de dois jeitos: escolhendo alguém já cadastrado
 * (`inquilino_id` aponta pra `pessoas`) ou digitando o nome direto no
 * formulário. O segundo é o caminho NORMAL — na hora de cotar o inquilino
 * quase nunca é cliente ainda; virar cadastro é consequência de o seguro
 * sair, não pré-requisito pra pedir.
 *
 * Ler só o join deixava justamente esse caso sem nome na tela: título
 * "Cotação", subtítulo "Sem inquilino vinculado", numa análise que tinha
 * nome, CPF e parecer da seguradora. O dado nunca se perdeu — está no
 * `payload`, que é exatamente o que foi transmitido à corretora.
 */
export interface Pretendente {
  nome: string | null
  cpfCnpj: string | null
  /** Veio do cadastro (tem ficha em `pessoas`) ou só do formulário? */
  doCadastro: boolean
}

// `cpf_cnpj` é opcional porque nem toda consulta o traz — o webhook, por
// exemplo, só precisa do nome pra montar a notificação.
export function identificarPretendente(
  inquilino: { nome: string; cpf_cnpj?: string | null } | null,
  payload: unknown,
): Pretendente {
  if (inquilino?.nome?.trim()) {
    return { nome: inquilino.nome.trim(), cpfCnpj: inquilino.cpf_cnpj ?? null, doCadastro: true }
  }

  const p = (payload as AnaliseInput | null)?.pretendente
  return {
    nome: p?.nome?.trim() || null,
    cpfCnpj: p?.cpfCnpj?.trim() || null,
    doCadastro: false,
  }
}
