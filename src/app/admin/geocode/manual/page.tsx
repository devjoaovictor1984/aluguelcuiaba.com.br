import Link from 'next/link'
import { MapPin, ArrowLeft, Info } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { LinhaCoords } from './_components/linha-coords'

interface ImovelRow {
  id: string
  titulo: string
  endereco_resumido: string | null
  bairro: { nome: string } | { nome: string }[] | null
}

export default async function AdminGeocodeManualPage() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('imoveis')
    .select('id, titulo, endereco_resumido, bairro:bairros(nome)')
    .is('lat', null)
    .eq('status', 'ativo')
    .order('created_at', { ascending: false })

  const imoveis = (data ?? []) as ImovelRow[]

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <Link href="/admin/geocode" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
          <ArrowLeft size={12} />
          Voltar
        </Link>
        <div className="flex items-center gap-2">
          <MapPin size={20} className="text-violet-600" />
          <h1 className="text-xl font-bold text-gray-900">Marcar coordenadas manualmente</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Para imóveis cujo endereço não foi encontrado automaticamente pelo Nominatim.
        </p>
      </div>

      {/* Instruções */}
      <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 text-sm text-violet-900 space-y-2">
        <p className="font-semibold flex items-center gap-1.5"><Info size={14} /> Como pegar lat/lng no Google Maps</p>
        <ol className="text-xs text-violet-800 space-y-1 list-decimal pl-5">
          <li>Clique em <strong>&quot;Abrir no Google Maps&quot;</strong> abaixo do imóvel</li>
          <li>No mapa, encontre o local exato e <strong>clique com o botão direito</strong> em cima</li>
          <li>Vai aparecer um número assim: <code className="bg-violet-200 px-1 rounded">-15.5989, -56.0949</code></li>
          <li><strong>Clique nesse número</strong> — ele é copiado automaticamente</li>
          <li>Cole no campo abaixo e clique em &quot;Salvar&quot;</li>
        </ol>
      </div>

      {/* Lista */}
      {imoveis.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <p className="text-sm text-gray-500">Todos os imóveis ativos já têm coordenadas. 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            {imoveis.length} imóv{imoveis.length === 1 ? 'el sem coordenadas' : 'eis sem coordenadas'}
          </p>
          {imoveis.map(im => {
            const bairroObj = Array.isArray(im.bairro) ? im.bairro[0] : im.bairro
            return (
              <LinhaCoords
                key={im.id}
                imovel={{
                  id: im.id,
                  titulo: im.titulo,
                  endereco_resumido: im.endereco_resumido,
                  bairro_nome: bairroObj?.nome ?? null,
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
