'use client'

import { useEffect, useState } from 'react'

/**
 * Monta os filhos APENAS em viewport desktop (≥ md / 768px).
 *
 * Diferente do `hidden md:block` (que só esconde via CSS mas ainda MONTA
 * o componente), isto evita montar de fato no mobile. Necessário pro mapa
 * Leaflet: inicializar num container display:none (tamanho zero) gera
 * "Invalid LatLng (NaN,NaN)" / "_leaflet_pos undefined" e derruba a página.
 */
export function SomenteDesktop({ children }: { children: React.ReactNode }) {
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setDesktop(mq.matches)
    const onChange = () => setDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return desktop ? <>{children}</> : null
}
