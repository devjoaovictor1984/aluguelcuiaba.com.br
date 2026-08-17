import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { PainelComissoes } from './_components/painel-comissoes'

export const metadata = { title: 'Comissões de seguro — admin' }
export const dynamic = 'force-dynamic'

/**
 * Conciliação da comissão de seguros.
 *
 * Duas comissões por venda, independentes: a do corretor, que a
 * corretora paga direto a ele, e o override da plataforma. Cada uma com
 * seu estado — o corretor pode ter recebido enquanto o override não
 * caiu, e é justamente essa diferença que a tela existe para mostrar.
 */
export default async function AdminComissoesSeguroPage() {
  const admin = createAdminClient()

  const [{ data: linhas }, { data: cfg }] = await Promise.all([
    admin
      .from('seguro_comissoes')
      .select(`
        id, produto, seguradora_sigla, apolice_numero, premio_total, competencia,
        percentual_corretor, valor_corretor, status_corretor, recebido_corretor_em, valor_recebido_corretor,
        percentual_plataforma, valor_plataforma, status_plataforma, recebido_plataforma_em, valor_recebido_plataforma,
        user_id,
        cliente:pessoas!pessoa_id(nome)
      `)
      .order('competencia', { ascending: false })
      .limit(300),
    admin
      .from('site_config')
      .select('valor')
      .eq('chave', 'seguro_override_percentual')
      .maybeSingle(),
  ])

  // Nome de quem vendeu — o join direto não existe (user_id aponta pra
  // auth.users, não pra perfis).
  const ids = [...new Set((linhas ?? []).map(l => l.user_id))]
  const { data: perfis } = ids.length
    ? await admin.from('perfis').select('id, nome, razao_social').in('id', ids)
    : { data: [] }
  const nomePorId = new Map(
    (perfis ?? []).map(p => [p.id, p.razao_social ?? p.nome ?? 'Sem nome']),
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div>
        <Link
          href="/admin/seguros"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2"
        >
          <ArrowLeft size={12} /> Seguros
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Comissões de seguro</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          O que foi vendido pela plataforma, o que se espera receber e o que já caiu.
        </p>
      </div>

      <PainelComissoes
        overrideAtual={cfg?.valor ?? ''}
        linhas={(linhas ?? []).map(l => {
          const cliente = Array.isArray(l.cliente) ? l.cliente[0] : l.cliente
          return {
            id: l.id,
            produto: l.produto as 'fianca' | 'incendio',
            vendedor: nomePorId.get(l.user_id) ?? 'Sem nome',
            cliente: cliente?.nome ?? null,
            seguradoraSigla: l.seguradora_sigla,
            apoliceNumero: l.apolice_numero,
            premioTotal: Number(l.premio_total) || 0,
            competencia: l.competencia,
            corretor: {
              percentual: l.percentual_corretor != null ? Number(l.percentual_corretor) : null,
              valor: l.valor_corretor != null ? Number(l.valor_corretor) : null,
              status: l.status_corretor,
              recebidoEm: l.recebido_corretor_em,
              valorRecebido: l.valor_recebido_corretor != null ? Number(l.valor_recebido_corretor) : null,
            },
            plataforma: {
              percentual: l.percentual_plataforma != null ? Number(l.percentual_plataforma) : null,
              valor: l.valor_plataforma != null ? Number(l.valor_plataforma) : null,
              status: l.status_plataforma,
              recebidoEm: l.recebido_plataforma_em,
              valorRecebido: l.valor_recebido_plataforma != null ? Number(l.valor_recebido_plataforma) : null,
            },
          }
        })}
      />
    </div>
  )
}
