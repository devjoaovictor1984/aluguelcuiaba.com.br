import Link from 'next/link'
import { MapPin, Hand } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { BackfillButton } from './_components/backfill-button'
import { BackfillBairrosButton } from './_components/backfill-bairros-button'

export default async function AdminGeocodePage() {
  const supabase = createAdminClient()

  const { count: totalSem } = await supabase
    .from('imoveis')
    .select('id', { count: 'exact', head: true })
    .is('lat', null)
    .eq('status', 'ativo')

  const { count: totalCom } = await supabase
    .from('imoveis')
    .select('id', { count: 'exact', head: true })
    .not('lat', 'is', null)
    .eq('status', 'ativo')

  const { count: bairrosSem } = await supabase
    .from('bairros')
    .select('id', { count: 'exact', head: true })
    .or('lat.is.null,lng.is.null')

  const { count: bairrosCom } = await supabase
    .from('bairros')
    .select('id', { count: 'exact', head: true })
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <MapPin size={20} className="text-violet-600" />
        <h1 className="text-xl font-bold text-gray-900">Geocodificação de Imóveis</h1>
      </div>

      <p className="text-sm text-gray-500">
        Preenche as coordenadas (latitude/longitude) dos imóveis a partir do endereço,
        usando a API gratuita do OpenStreetMap (Nominatim). Necessário para o mapa
        funcionar.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-green-600">{totalCom ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Com coordenadas</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-amber-600">{totalSem ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Sem coordenadas</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
        <strong>Atenção:</strong> A Nominatim limita 1 requisição/segundo. Imóveis sem
        rua + número podem não ser encontrados — nesse caso o sistema usa as coordenadas
        do bairro como fallback (faça primeiro o &quot;Geocodar bairros&quot; abaixo).
      </div>

      {/* Bairros */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Coordenadas dos bairros</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Usadas como fallback quando o endereço do imóvel não pode ser geocodado.
            {' '}{bairrosCom ?? 0} bairro{(bairrosCom ?? 0) === 1 ? '' : 's'} com coordenadas
            {' '}· {bairrosSem ?? 0} sem.
          </p>
        </div>
        <BackfillBairrosButton total={bairrosSem ?? 0} />
      </div>

      {/* Imóveis */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Coordenadas dos imóveis</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Tenta primeiro o endereço completo. Se falhar, usa as coords do bairro.
          </p>
        </div>
        <BackfillButton totalSem={totalSem ?? 0} />
      </div>

      {(totalSem ?? 0) > 0 && (
        <Link
          href="/admin/geocode/manual"
          className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 p-4 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
            <Hand size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Marcar manualmente</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Para imóveis cujo endereço não foi encontrado — cole as coordenadas do Google Maps.
            </p>
          </div>
          <span className="text-xs text-violet-700 font-semibold">→</span>
        </Link>
      )}
    </div>
  )
}
