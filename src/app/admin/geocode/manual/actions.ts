'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function salvarCoords(imovelId: string, lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: 'Coordenadas inválidas' }
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: 'Coordenadas fora do intervalo válido' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('imoveis')
    .update({ lat, lng })
    .eq('id', imovelId)

  if (error) return { error: error.message }

  revalidatePath('/admin/geocode')
  revalidatePath('/admin/geocode/manual')
  revalidatePath('/')
  return { ok: true }
}
