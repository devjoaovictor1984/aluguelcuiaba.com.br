'use client'

import { gerarLinkWhatsApp, gerarMensagemWhatsApp, formatarPreco } from '@/lib/utils'
import type { Imovel } from '@/types'

const WPP_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.507 3.936 1.395 5.617L0 24l6.545-1.371A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.651-.498-5.178-1.367l-.371-.221-3.882.813.827-3.796-.242-.392A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
  </svg>
)

const SHARE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
)

export function BarraAcoesImovel({ imovel }: { imovel: Imovel }) {
  const slug = imovel.slug ?? imovel.id
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/imoveis/${slug}`
  const partes: string[] = []
  if (imovel.quartos > 0) partes.push(`${imovel.quartos} quarto${imovel.quartos > 1 ? 's' : ''}`)
  if (imovel.banheiros > 0) partes.push(`${imovel.banheiros} banheiro${imovel.banheiros > 1 ? 's' : ''}`)
  if (imovel.vagas > 0) partes.push(`${imovel.vagas} vaga${imovel.vagas > 1 ? 's' : ''}`)
  if (imovel.area_m2) partes.push(`${imovel.area_m2}m²`)

  const linkWpp = gerarLinkWhatsApp(
    imovel.whatsapp,
    gerarMensagemWhatsApp(imovel.titulo, imovel.bairro?.nome, {
      preco: imovel.preco,
      partes,
      link: url,
    })
  )

  const compartilharWhatsApp = () => {
    const msg = [
      `*${imovel.titulo}*`,
      `\u{1F4CD} ${imovel.bairro?.nome ?? 'Cuiabá'}${imovel.bairro?.nome ? ', Cuiabá' : ''}`,
      `\u{1F4B0} ${formatarPreco(imovel.preco)}/mês`,
      partes.length > 0 ? `\u{1F3E0} ${partes.join(' · ')}` : '',
      '',
      'Encontrei no AluguelCuiabá:',
      url,
    ].filter(Boolean).join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 backdrop-blur-sm border-t border-gray-200 flex gap-2.5 px-4 pt-3"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <a
        href={linkWpp}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold py-4 rounded-2xl text-base transition-colors"
      >
        {WPP_ICON}
        Falar pelo WhatsApp
      </a>

      <button
        onClick={compartilharWhatsApp}
        className="w-16 flex flex-col items-center justify-center gap-0.5 border-2 border-gray-200 rounded-2xl text-gray-500 hover:border-green-400 hover:text-green-600 active:bg-gray-50 transition-colors"
        aria-label="Compartilhar no WhatsApp"
      >
        {SHARE_ICON}
        <span className="text-[10px] font-medium">Enviar</span>
      </button>
    </div>
  )
}
