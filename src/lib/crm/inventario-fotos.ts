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
 * Larguras de exibição. A foto sobe já reduzida pelo navegador (900px,
 * ~250KB), e cada destino pede só o que vai mostrar: a tabela desenha
 * 64px, e o PDF imprime a prancha em ~130pt de altura.
 */
export const LARGURA_MINIATURA = 192   // tela: 64px em telas 3x
export const LARGURA_PDF = 640         // PDF: prancha de ~130pt em ~300dpi

/**
 * Signed URLs das fotos, indexadas pelo path, já redimensionadas pelo
 * próprio Supabase (/storage/v1/render/image/...) — o mesmo caminho que
 * o loader do next/image usa pras fotos de anúncio, e que não gasta cota
 * do otimizador da Vercel.
 *
 * Uma chamada por foto porque `createSignedUrls`, a versão em lote, não
 * aceita transformação — o token assinado carrega o redimensionamento
 * dentro dele. Vão todas em paralelo, e a que falhar simplesmente não
 * entra no mapa: a linha sai sem imagem em vez de derrubar a página.
 */
export async function urlsFotosInventario(
  admin: ReturnType<typeof createAdminClient>,
  paths: Array<string | null | undefined>,
  opcoes: { largura?: number; validadeSegundos?: number } = {},
): Promise<Record<string, string>> {
  const limpos = [...new Set(paths.filter((p): p is string => !!p))]
  if (limpos.length === 0) return {}

  const largura = opcoes.largura ?? LARGURA_MINIATURA
  const validade = opcoes.validadeSegundos ?? VALIDADE_PADRAO

  const assinadas = await Promise.all(
    limpos.map(async path => {
      const { data, error } = await admin.storage
        .from(BUCKET_INVENTARIO)
        .createSignedUrl(path, validade, {
          // `contain` não corta: o enquadramento fica com o object-fit da
          // tela e com o objectFit do react-pdf.
          transform: { width: largura, height: largura, resize: 'contain', quality: 70 },
        })
      if (data?.signedUrl) return { path, url: data.signedUrl }

      // Redimensionamento é recurso de plano. Se o projeto não tiver, a
      // foto ainda tem que aparecer: cai pro arquivo inteiro, que já sobe
      // comprimido pelo navegador. Pesado, não quebrado.
      if (error) {
        const { data: cru } = await admin.storage
          .from(BUCKET_INVENTARIO)
          .createSignedUrl(path, validade)
        return { path, url: cru?.signedUrl ?? null }
      }
      return { path, url: null }
    }),
  )

  const mapa: Record<string, string> = {}
  for (const { path, url } of assinadas) {
    if (url) mapa[path] = url
  }
  return mapa
}
