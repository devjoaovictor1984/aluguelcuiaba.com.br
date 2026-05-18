import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { FormRecibo } from './_components/form-recibo'

export default async function PersonalizarReciboPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const { data: perfil } = await supabase
    .from('perfis')
    .select('nome, recibo_logo_url, recibo_emitente_nome, recibo_assinatura_url, recibo_mostrar_linha, recibo_assinatura_sobre_linha')
    .eq('id', user.id)
    .single()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link href="/painel/inicio" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
        <ArrowLeft size={12} /> Início
      </Link>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Receipt size={20} className="text-violet-600" /> Personalizar recibo
        </h1>
        <p className="text-sm text-gray-500">
          Logo, nome de assinatura e imagem da rubrica que aparecerão nos recibos gerados em PDF.
        </p>
      </div>

      <FormRecibo
        perfilNome={perfil?.nome ?? null}
        recibo_logo_url={perfil?.recibo_logo_url ?? null}
        recibo_emitente_nome={perfil?.recibo_emitente_nome ?? null}
        recibo_assinatura_url={perfil?.recibo_assinatura_url ?? null}
        recibo_mostrar_linha={perfil?.recibo_mostrar_linha ?? true}
        recibo_assinatura_sobre_linha={perfil?.recibo_assinatura_sobre_linha ?? true}
      />
    </div>
  )
}
