import type { createAdminClient } from '@/lib/supabase/admin'

/**
 * Fotos do inventário de bens (v101).
 *
 * Bucket PRIVADO — ao contrário de 'vistorias-fotos', que é público: a
 * foto mostra o interior da casa de alguém. Quem exibe pede signed URL:
 * a tela do contrato e o PDF, na hora de montar.
 *
 * Mora fora do arquivo de actions porque o PDF também precisa, e num
 * módulo 'use server' todo export vira server action.
 */
export const BUCKET_INVENTARIO = 'contratos-inventario'

/** Meia hora: sobra pra montar e baixar o PDF, e o link morre no mesmo dia. */
const VALIDADE_PADRAO = 1800

/**
 * Signed URLs de várias fotos de uma vez, indexadas pelo path.
 *
 * Em lote porque o inventário é uma tabela: pedir link foto a foto seria
 * uma ida ao storage por linha. Foto que falhar simplesmente não entra no
 * mapa — a linha sai sem imagem, e não derruba o PDF inteiro.
 */
export async function urlsFotosInventario(
  admin: ReturnType<typeof createAdminClient>,
  paths: Array<string | null | undefined>,
  validadeSegundos = VALIDADE_PADRAO,
): Promise<Record<string, string>> {
  const limpos = [...new Set(paths.filter((p): p is string => !!p))]
  if (limpos.length === 0) return {}

  const { data } = await admin.storage
    .from(BUCKET_INVENTARIO)
    .createSignedUrls(limpos, validadeSegundos)

  const mapa: Record<string, string> = {}
  for (const linha of data ?? []) {
    if (linha.path && linha.signedUrl) mapa[linha.path] = linha.signedUrl
  }
  return mapa
}
