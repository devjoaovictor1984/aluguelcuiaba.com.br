import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { ImovelCard } from '@/components/imovel-card'
import { getPerfilPublico, getImoveisDoAnunciante } from '@/lib/supabase/queries'
import { Building2, Home, CalendarDays, MessageCircle } from 'lucide-react'
import type { Imovel } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

const TIPO_LABEL: Record<string, string> = {
  proprietario: 'Proprietário',
  corretor: 'Corretor de Imóveis',
  imobiliaria: 'Imobiliária',
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const { data: perfil } = await getPerfilPublico(id)
  if (!perfil) return {}
  const nome = perfil.nome ?? 'Anunciante'
  return {
    title: `${nome} — Imóveis para alugar em Cuiabá`,
    description: `Veja os imóveis anunciados por ${nome} no AluguelCuiabá.`,
    robots: { index: false },
  }
}

export default async function AnunciantePage({ params }: Props) {
  const { id } = await params
  const [{ data: perfil }, { data: imoveis }] = await Promise.all([
    getPerfilPublico(id),
    getImoveisDoAnunciante(id),
  ])

  if (!perfil) notFound()

  const nome = perfil.nome ?? 'Anunciante'
  const tipo = TIPO_LABEL[perfil.tipo] ?? 'Anunciante'
  const membroDesde = new Date(perfil.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const lista = imoveis ?? []

  return (
    <>
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Perfil header */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex items-center gap-5 mb-8">
          <div className="w-20 h-20 rounded-full shrink-0 overflow-hidden bg-violet-100 flex items-center justify-center">
            {perfil.foto_url ? (
              <img src={perfil.foto_url} alt={nome} className="w-full h-full object-cover" />
            ) : (
              <span className="text-violet-700 font-bold text-3xl">{nome.charAt(0).toUpperCase()}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{nome}</h1>
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
              <Building2 size={13} className="text-gray-400 shrink-0" />
              {tipo}
              {perfil.creci && <span className="text-gray-400">· CRECI {perfil.creci}</span>}
            </p>
            <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
              <CalendarDays size={12} className="shrink-0" />
              Membro desde {membroDesde}
            </p>
          </div>

          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
            <span className="text-2xl font-extrabold text-violet-700">{lista.length}</span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Home size={11} />
              {lista.length === 1 ? 'imóvel ativo' : 'imóveis ativos'}
            </span>
          </div>
        </div>

        {/* Imóveis */}
        {lista.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <MessageCircle size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="font-semibold text-gray-500">Nenhum imóvel ativo no momento</p>
            <p className="text-sm mt-1">Este anunciante não possui anúncios publicados.</p>
            <Link href="/" className="mt-6 inline-block text-sm text-violet-600 hover:underline font-medium">
              Ver todos os imóveis →
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Imóveis de {nome}
            </h2>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {lista.map(im => (
                <ImovelCard key={im.id} imovel={im as Imovel} />
              ))}
            </div>
          </>
        )}
      </div>

      <Footer />
    </>
  )
}
