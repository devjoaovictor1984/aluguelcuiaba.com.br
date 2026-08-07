import Link from 'next/link'
import { ArrowLeft, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoSeguros } from '@/lib/seguros/acesso'
import { AvisoDemo } from '../../_components/aviso-demo'
import { PainelFaturamento } from './_components/painel-faturamento'

interface Props {
  searchParams: Promise<{ mes?: string; ano?: string }>
}

export const metadata = { title: 'Faturamento do incêndio' }

export default async function FaturamentoPage({ searchParams }: Props) {
  const { mes, ano } = await searchParams
  const acesso = await exigirAcessoSeguros()
  const supabase = await createClient()

  let query = supabase
    .from('seguro_incendio_faturas')
    .select('id, competencia, vigencia, ramo, codigo, numero_proposta, data_cobertura, inquilino_nome, proprietario_nome, local_risco, parcelas, valor_parcela, premio_total, sincronizado_em')
    .eq('user_id', acesso.userId)
    .order('premio_total', { ascending: false })
    .limit(500)

  if (mes && ano) {
    query = query.eq('competencia', `${ano}-${String(mes).padStart(2, '0')}-01`)
  } else {
    query = query.is('competencia', null)
  }

  const { data: itens } = await query

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto pb-24">
      <div>
        <Link href="/painel/seguros/incendio" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600 mb-2">
          <ArrowLeft size={12} /> Seguro incêndio
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Receipt size={20} className="text-orange-500" /> Faturamento
        </h1>
        <p className="text-sm text-gray-500">
          O que a corretora tem a faturar da sua carteira. Serve pra conferir o
          pró-labore.
        </p>
      </div>

      <AvisoDemo />

      <PainelFaturamento
        itens={(itens ?? []).map(i => ({
          id: i.id,
          vigencia: i.vigencia as 'mensalizado' | 'anual',
          ramo: i.ramo as 'residencial' | 'comercial',
          codigo: i.codigo,
          numeroProposta: i.numero_proposta,
          dataCobertura: i.data_cobertura,
          inquilino: i.inquilino_nome,
          proprietario: i.proprietario_nome,
          localRisco: i.local_risco,
          parcelas: i.parcelas,
          valorParcela: i.valor_parcela,
          premioTotal: i.premio_total,
        }))}
        competencia={mes && ano ? { mes: Number(mes), ano: Number(ano) } : null}
        sincronizadoEm={itens?.[0]?.sincronizado_em ?? null}
      />
    </div>
  )
}
