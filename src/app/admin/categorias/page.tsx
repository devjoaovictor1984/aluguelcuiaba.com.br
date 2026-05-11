import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Tag, FileText } from 'lucide-react'

const CATS = [
  { value: 'geral',      label: 'Geral',       bg: 'bg-violet-100', text: 'text-violet-700', desc: 'Posts gerais sobre o mercado imobiliário e aluguel.' },
  { value: 'dicas',      label: 'Dicas',       bg: 'bg-blue-100',   text: 'text-blue-700',   desc: 'Dicas práticas para inquilinos e proprietários.' },
  { value: 'mercado',    label: 'Mercado',     bg: 'bg-orange-100', text: 'text-orange-700', desc: 'Tendências e análises do mercado imobiliário em Cuiabá.' },
  { value: 'legal',      label: 'Legal',       bg: 'bg-teal-100',   text: 'text-teal-700',   desc: 'Direitos e deveres de inquilinos e locadores.' },
  { value: 'bairros',    label: 'Bairros',     bg: 'bg-green-100',  text: 'text-green-700',  desc: 'Guias e informações sobre os bairros de Cuiabá.' },
  { value: 'financeiro', label: 'Financeiro',  bg: 'bg-yellow-100', text: 'text-yellow-700', desc: 'Finanças pessoais, FGTS, crédito e renda para aluguel.' },
]

export default async function AdminCategoriasPage() {
  const supabase = createAdminClient()
  const { data: contagens } = await supabase
    .from('posts')
    .select('categoria')
    .eq('publicado', true)

  const countCat: Record<string, number> = {}
  contagens?.forEach(p => { countCat[p.categoria] = (countCat[p.categoria] ?? 0) + 1 })

  const { data: rascunhos } = await supabase
    .from('posts')
    .select('categoria')
    .eq('publicado', false)

  const countRasc: Record<string, number> = {}
  rascunhos?.forEach(p => { countRasc[p.categoria] = (countRasc[p.categoria] ?? 0) + 1 })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorias do Blog</h1>
          <p className="text-sm text-gray-500 mt-0.5">Categorias disponíveis para organizar os posts.</p>
        </div>
        <Link href="/admin/posts/novo"
          className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <FileText size={14} />
          Novo post
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {CATS.map(cat => {
          const total = (countCat[cat.value] ?? 0) + (countRasc[cat.value] ?? 0)
          return (
            <div key={cat.value} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full ${cat.bg} ${cat.text}`}>
                  <Tag size={13} />
                  {cat.label}
                </span>
                <div className="text-right">
                  <p className="text-xl font-bold text-gray-900">{total}</p>
                  <p className="text-xs text-gray-400">posts</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-4">{cat.desc}</p>
              <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
                <span>{countCat[cat.value] ?? 0} publicados</span>
                <span>{countRasc[cat.value] ?? 0} rascunhos</span>
                <Link
                  href={`/admin/posts?categoria=${cat.value}`}
                  className="text-violet-600 font-medium hover:underline"
                >
                  Ver posts →
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <p className="text-sm text-amber-800 font-medium mb-1">Categorias fixas</p>
        <p className="text-xs text-amber-700">
          As categorias acima são fixas e definidas no código.
          Para adicionar ou renomear uma categoria, edite o arquivo{' '}
          <code className="bg-amber-100 px-1 rounded">src/app/(public)/blog/page.tsx</code>{' '}
          e o arquivo <code className="bg-amber-100 px-1 rounded">src/app/admin/categorias/page.tsx</code>.
        </p>
      </div>
    </div>
  )
}
