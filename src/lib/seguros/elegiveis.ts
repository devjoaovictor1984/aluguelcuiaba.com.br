import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { consultarImobiliaria, listarSeguradoras } from './index'
import { normalizarSigla } from './tabelas'
import type { TipoAnalise } from './tipos'

/**
 * Quais seguradoras podem receber ESTA análise.
 *
 * Existe porque mandar a lista vazia — que a API lê como "todas" — quebra.
 * Medido contra a API viva em 16/08/2026, mesmo payload nas três:
 *
 *   sem `seguradorasAnalise`  → HTTP 500 "Internal server error"
 *   `["tok"]` numa reduzida   → HTTP 400 "pretendente.dataNascimento
 *                                não informado ou inválido"
 *   `["por"]`                 → HTTP 201, parecer normal
 *
 * A Tokio não aceita análise reduzida. Pedida sozinha ela recusa direito,
 * com motivo; dentro do "todas" a validação dela estoura do lado deles e
 * volta 500 genérico, que não diz nada e ainda derruba as outras três
 * seguradoras junto. Por isso a lista passou a ser resolvida aqui, no
 * servidor, e nunca vai vazia.
 *
 * O segundo filtro são as flags de habilitação do `consultarImobiliaria`.
 * Cotar em seguradora não habilitada não dá erro: dá análise natimorta —
 * ela é aceita, recebe id, volta `codigoStatus: 0` com descrição vazia, e
 * a reconsulta devolve zero pareceres. Do lado do corretor é uma análise
 * parada para sempre sem explicação.
 */

type Admin = ReturnType<typeof createAdminClient>

/** Campo que o `consultarImobiliaria` usa para cada seguradora de fiança. */
const FLAG_FIANCA: Record<string, string> = {
  por: 'porto_fianca',
  too: 'too_fianca',
  tok: 'tokio_fianca',
  ptc: 'pottencial_fianca',
}

export interface Elegiveis {
  siglas: string[]
  /** Quem ficou de fora e por quê — vira aviso na tela e linha no log. */
  descartadas: { sigla: string; nome: string; motivo: string }[]
}

export async function seguradorasElegiveis(
  admin: Admin,
  opcoes: {
    tipoAnalise: TipoAnalise
    cnpjImobiliaria: string
    /** Escolha explícita do corretor. Vazio = considerar o catálogo todo. */
    escolhidas?: string[] | null
    userId?: string
  },
): Promise<Elegiveis> {
  const catalogo = await listarSeguradoras(admin)

  // Habilitação é por imobiliária. Se o cadastro não responder, seguimos
  // sem esse filtro: esconder todas as seguradoras porque uma consulta
  // falhou é pior que deixar passar uma natimorta, que pelo menos aparece
  // no painel. O filtro da reduzida, esse, nunca é dispensado — é ele que
  // evita o 500.
  const imob = await consultarImobiliaria(admin, opcoes.cnpjImobiliaria, opcoes.userId)

  const pedidas = (opcoes.escolhidas ?? [])
    .map(normalizarSigla)
    .filter(Boolean)

  const siglas: string[] = []
  const descartadas: Elegiveis['descartadas'] = []

  for (const s of catalogo) {
    if (pedidas.length && !pedidas.includes(s.sigla)) continue

    if (opcoes.tipoAnalise === 'reduzida' && !s.aceitaAnaliseReduzida) {
      descartadas.push({ sigla: s.sigla, nome: s.nome, motivo: 'não aceita análise reduzida' })
      continue
    }

    const flag = FLAG_FIANCA[s.sigla]
    if (imob && flag && imob[flag] === false) {
      descartadas.push({ sigla: s.sigla, nome: s.nome, motivo: 'imobiliária não habilitada nesta seguradora' })
      continue
    }

    siglas.push(s.sigla)
  }

  return { siglas, descartadas }
}

/** Frase pronta pra quando não sobrou nenhuma — explica o que fazer. */
export function motivoDeNenhumaElegivel(e: Elegiveis, tipoAnalise: TipoAnalise): string {
  if (!e.descartadas.length) {
    return 'Nenhuma seguradora disponível para cotar no momento.'
  }
  const lista = e.descartadas.map(d => `${d.nome} (${d.motivo})`).join('; ')
  const dica = tipoAnalise === 'reduzida'
    ? ' Uma análise completa costuma abrir mais seguradoras.'
    : ''
  return `Nenhuma seguradora pode receber esta análise: ${lista}.${dica}`
}
