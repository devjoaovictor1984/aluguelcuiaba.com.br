import { Navbar } from '@/components/navbar'

// ISR — servida do cache e regerada no máximo a cada 300s.
// Página do condomínio: muda pouco, e sempre junto do anúncio.
// Só funciona porque as queries usam o cliente público (sem cookie).
export const revalidate = 300

// Sem generateStaticParams, rota com parâmetro é tratada como dinâmica.
// Retornar [] não pré-gera nada no build: cada página é renderizada na
// 1ª visita e cacheada a partir dali.
export async function generateStaticParams() {
  return []
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function CondominioPage({ params }: Props) {
  const { slug } = await params

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Condomínio</h1>
        <p className="text-gray-500 mt-2">Slug: {slug}</p>
      </main>
    </>
  )
}
