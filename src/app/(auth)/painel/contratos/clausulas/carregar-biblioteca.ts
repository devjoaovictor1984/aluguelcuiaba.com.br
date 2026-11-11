import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { MODELO_POR_CODIGO, normalizarTexto, versaoDoSeed } from '@/lib/contratos/modelo'
import { vincularBibliotecaAoModelo } from './actions'
import type { ClausulaRow } from './_components/clausulas-cliente'

const COLUNAS_V105 = 'id, tipo, categoria, titulo, numero, corpo, ativa, updated_at, codigo, versao, modelo_versao'
const COLUNAS_ANTIGAS = 'id, tipo, categoria, titulo, numero, corpo, ativa, updated_at'

/**
 * Carrega a biblioteca do escopo já ligada ao modelo (v105): cada linha
 * vem com o código, a versão e — se o modelo tem texto mais novo do que o
 * que ela usa — a atualização disponível, pra tela mostrar a diferença.
 *
 * Banco sem a v105: cai no select antigo e a tela funciona como antes,
 * sem os selos de versão.
 */
export async function carregarBiblioteca(userId: string, escopo: 'locacao' | 'administracao'): Promise<ClausulaRow[]> {
  await vincularBibliotecaAoModelo()
  const supabase = await createClient()

  const buscar = async (colunas: string) => {
    const base = supabase.from('contrato_clausulas').select(colunas).eq('user_id', userId)
    const doEscopo = escopo === 'administracao' ? base.eq('tipo', 'administracao') : base.neq('tipo', 'administracao')
    return doEscopo.order('tipo', { ascending: true }).order('numero', { ascending: true })
  }

  const novo = await buscar(COLUNAS_V105)
  if (novo.error) {
    const antigo = await buscar(COLUNAS_ANTIGAS)
    return (antigo.data ?? []) as unknown as ClausulaRow[]
  }

  type Linha = ClausulaRow & { codigo: string | null; modelo_versao: number | null }
  return ((novo.data ?? []) as unknown as Linha[]).map(r => {
    const modelo = r.codigo ? MODELO_POR_CODIGO.get(r.codigo) : undefined
    const versaoModelo = modelo ? versaoDoSeed(modelo) : null
    const igualAoModelo = !!modelo && normalizarTexto(r.corpo) === normalizarTexto(modelo.corpo)
    const temAtualizacao = !!modelo && versaoModelo != null && (r.modelo_versao ?? 1) < versaoModelo && !igualAoModelo
    return {
      ...r,
      // Já no texto do modelo atual, mas com mudanças suas.
      editada: !!modelo && !igualAoModelo && !temAtualizacao,
      atualizacao: temAtualizacao ? { versao: versaoModelo!, titulo: modelo!.titulo, corpo: modelo!.corpo } : null,
    }
  })
}
