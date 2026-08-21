import 'server-only'
import { randomInt } from 'crypto'
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Código público de validação do contrato assinado (v83).
 *
 * Vai carimbado no rodapé do PDF final e é o que a pessoa digita em
 * /validar. Como é lido de papel e ditado por telefone, o alfabeto tira
 * o que se confunde na leitura: 0/O, 1/I/L, 5/S, 2/Z, 8/B.
 */
const ALFABETO = '34679ACDEFGHJKMNPQRTUVWXY'

/** 12 caracteres em 3 grupos — ~2^55 combinações, inadivinhável na prática. */
function sortearCodigo(): string {
  let s = ''
  for (let i = 0; i < 12; i++) s += ALFABETO[randomInt(ALFABETO.length)]
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`
}

/** Aceita o código digitado de qualquer jeito (minúsculo, sem hífen, com espaço). */
export function normalizarCodigo(bruto: string): string {
  const limpo = (bruto ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (limpo.length !== 12) return ''
  return `${limpo.slice(0, 4)}-${limpo.slice(4, 8)}-${limpo.slice(8)}`
}

/**
 * Devolve o código do processo, criando na primeira chamada.
 *
 * Serve também de backfill: processos concluídos antes da v83 ganham o
 * código quando alguém gera a via final. O índice único é a rede de
 * segurança contra colisão — em caso de choque, sorteia de novo.
 */
export async function garantirCodigoValidacao(
  admin: Admin,
  processoId: string,
  atual: string | null,
): Promise<string | null> {
  if (atual) return atual

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = sortearCodigo()
    const { error } = await admin
      .from('contrato_assinaturas')
      .update({ codigo_validacao: codigo })
      .eq('id', processoId)
      .is('codigo_validacao', null)
    if (!error) {
      // O update pode não ter pego nenhuma linha se outra requisição
      // gerou o código no meio do caminho: relê pra devolver o vencedor.
      const { data } = await admin
        .from('contrato_assinaturas')
        .select('codigo_validacao').eq('id', processoId).maybeSingle()
      if (data?.codigo_validacao) return data.codigo_validacao
    }
  }
  // Sem código o PDF ainda sai — só perde o carimbo. Não vale derrubar
  // a geração da via final por causa disso.
  console.error('[validacao] não consegui gerar código para', processoId)
  return null
}
