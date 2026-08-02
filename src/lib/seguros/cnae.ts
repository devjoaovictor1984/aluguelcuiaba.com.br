import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { listarCnae } from './index'

/**
 * Lista de atividades CNAE.
 *
 * A API devolve o catálogo inteiro numa chamada, sem busca nem paginação.
 * São milhares de linhas e o conteúdo praticamente não muda, então
 * cacheamos em memória e filtramos aqui — buscar na API a cada tecla
 * seria absurdo.
 *
 * Cache por processo: em serverless cada instância busca uma vez. É
 * barato e evita a complexidade de guardar no banco algo que é catálogo
 * de terceiro.
 */

type Admin = ReturnType<typeof createAdminClient>

export interface ItemCnae {
  id: string
  descricao: string
}

const TTL_MS = 12 * 60 * 60 * 1000   // 12h

let cache: { itens: ItemCnae[]; em: number } | null = null

async function catalogo(admin: Admin): Promise<ItemCnae[]> {
  if (cache && Date.now() - cache.em < TTL_MS) return cache.itens
  const itens = await listarCnae(admin)
  cache = { itens, em: Date.now() }
  return itens
}

/** Remove acento e caixa, pra busca funcionar como o usuário espera. */
function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Busca por descrição ou código.
 *
 * Devolve no máximo `limite` itens: a lista completa travaria o select, e
 * ninguém escolhe entre mil opções — quem procura, digita.
 */
export async function buscarCnae(
  admin: Admin,
  termo: string,
  limite = 40,
): Promise<ItemCnae[]> {
  const itens = await catalogo(admin)
  const t = normalizar(termo.trim())
  if (!t) return itens.slice(0, limite)

  const pontuados = itens
    .map(i => {
      const desc = normalizar(i.descricao)
      // Quem começa com o termo aparece antes de quem só o contém.
      if (i.id.startsWith(t)) return { i, p: 0 }
      if (desc.startsWith(t)) return { i, p: 1 }
      if (desc.includes(t)) return { i, p: 2 }
      return null
    })
    .filter((x): x is { i: ItemCnae; p: number } => x !== null)
    .sort((a, b) => a.p - b.p)

  return pontuados.slice(0, limite).map(x => x.i)
}

/** Resolve um código já escolhido, pra mostrar a descrição ao reabrir. */
export async function descricaoCnae(admin: Admin, id: string): Promise<string | null> {
  if (!id) return null
  const itens = await catalogo(admin)
  return itens.find(i => i.id === id)?.descricao ?? null
}
