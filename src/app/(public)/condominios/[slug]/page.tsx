import { Navbar } from '@/components/navbar'

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
