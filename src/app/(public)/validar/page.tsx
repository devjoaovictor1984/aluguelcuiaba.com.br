import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { ShieldCheck, ChevronRight, Search } from 'lucide-react'
import { normalizarCodigo } from '@/lib/crm/validacao-codigo'

export const metadata: Metadata = {
  title: 'Validar contrato assinado — AluguelCuiabá',
  description: 'Confira a autenticidade de um contrato assinado eletronicamente na AluguelCuiabá pelo código impresso no rodapé do documento.',
  alternates: { canonical: 'https://aluguelcuiaba.com.br/validar' },
}

/**
 * Consulta pública de autenticidade (v83).
 *
 * Quem recebe uma via impressa não tem como conferir o hash do arquivo, então
 * o caminho é o código do rodapé. Página aberta de propósito: o objetivo é
 * justamente terceiros (cartório, banco, a outra parte) conseguirem checar.
 */
export default async function ValidarPage({
  searchParams,
}: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams

  async function consultar(formData: FormData) {
    'use server'
    const codigo = normalizarCodigo(String(formData.get('codigo') ?? ''))
    if (!codigo) redirect('/validar?erro=formato')
    redirect(`/validar/${codigo}`)
  }

  return (
    <>
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-10 pb-20">
        <nav className="flex items-center gap-1 text-xs text-gray-400 mb-6">
          <Link href="/" className="hover:text-violet-600 transition-colors">Início</Link>
          <ChevronRight size={12} />
          <span className="text-gray-600">Validar contrato</span>
        </nav>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck size={20} className="text-violet-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Validar contrato assinado</h1>
        </div>
        <p className="text-sm text-gray-500 mb-8">
          Digite o código impresso no rodapé do contrato para confirmar que ele foi
          mesmo assinado eletronicamente aqui e ver quem assinou.
        </p>

        <form action={consultar} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label htmlFor="codigo" className="block text-xs font-semibold text-gray-700 mb-1.5">
            Código de validação
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="codigo"
              name="codigo"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX"
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 font-mono tracking-wider uppercase text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
            >
              <Search size={15} /> Consultar
            </button>
          </div>
          {erro === 'formato' && (
            <p className="text-xs text-red-600 mt-2">
              O código tem 12 caracteres, como <span className="font-mono">K7M2-9QX4-A1B8</span>. Confira o rodapé do documento.
            </p>
          )}
          <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
            Pode digitar com ou sem hífen, maiúsculas ou minúsculas. O QR Code no rodapé
            leva direto ao resultado.
          </p>
        </form>

        <p className="text-[11px] text-gray-400 mt-6 leading-relaxed">
          A consulta mostra apenas o que identifica o documento: título, data da conclusão e
          quem assinou. Selfie, IP, e-mail e localização das partes fazem parte do certificado
          de assinatura, entregue somente a quem é parte no contrato.
        </p>
      </div>

      <Footer />
    </>
  )
}
