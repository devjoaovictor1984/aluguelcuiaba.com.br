import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import { iconePorNome } from '../_icone'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function SecaoAjudaPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: secao } = await supabase
    .from('ajuda_secoes')
    .select('titulo, resumo, icone, conteudo_html, atualizado_em, publicado')
    .eq('slug', slug)
    .eq('publicado', true)
    .maybeSingle()

  if (!secao) notFound()

  const Icon = iconePorNome(secao.icone)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <Link href="/painel/ajuda" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-3">
          <ArrowLeft size={12} /> Todas as seções
        </Link>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <Icon size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{secao.titulo}</h1>
            {secao.resumo && <p className="text-sm text-gray-500 mt-0.5">{secao.resumo}</p>}
          </div>
        </div>
      </div>

      <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-7">
        <div
          className="prose prose-sm sm:prose-base prose-violet max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-a:text-violet-700"
          dangerouslySetInnerHTML={{ __html: secao.conteudo_html || '<p class="text-gray-400">Sem conteúdo ainda.</p>' }}
        />
      </article>

      <p className="text-[11px] text-gray-400 text-right">
        Atualizado em {new Date(secao.atualizado_em).toLocaleDateString('pt-BR')}
      </p>
    </div>
  )
}
