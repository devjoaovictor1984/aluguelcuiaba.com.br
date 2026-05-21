import Image from 'next/image'
import Link from 'next/link'
import { MapPin, BedDouble, Bath, Car } from 'lucide-react'
import { gerarLinkWhatsApp, gerarMensagemWhatsApp, tempoRelativo, buildImovelUrl } from '@/lib/utils'
import { PrecoImovel } from '@/components/preco-imovel'
import { BotaoFavorito } from '@/components/botao-favorito'
import type { Imovel } from '@/types'

interface Props {
  imovel: Imovel
}

export function ImovelCard({ imovel }: Props) {
  const fotoUrl = imovel.fotos?.find(f => f.principal)?.url || imovel.fotos?.[0]?.url
  const linkWpp = gerarLinkWhatsApp(
    imovel.whatsapp,
    gerarMensagemWhatsApp(imovel.titulo, imovel.bairro?.nome)
  )
  const alugado = imovel.status === 'alugado'

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group relative">
      <div className="relative h-32 sm:h-48 bg-gray-100">
        <Link href={buildImovelUrl(imovel)} className="absolute inset-0 overflow-hidden block">
          {fotoUrl ? (
            <Image
              src={fotoUrl}
              alt={imovel.titulo}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 50vw, 50vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-300">
              <span className="text-sm">Sem foto</span>
            </div>
          )}
        </Link>
        {imovel.destaque && !alugado && (
          <span className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full z-10">
            Destaque
          </span>
        )}
        {!alugado && (
          <span className="absolute top-2 right-2 bg-white/90 text-gray-700 text-xs px-2 py-0.5 rounded-full capitalize font-medium z-10">
            {imovel.tipo}
          </span>
        )}
        <BotaoFavorito imovelId={imovel.id} />
        {alugado && (
          <div className="absolute inset-0 bg-black/15 pointer-events-none z-[5]" />
        )}
      </div>

      {alugado && (
        <div className="absolute top-0 right-0 w-28 h-28 overflow-hidden pointer-events-none z-30">
          <div className="absolute top-[22px] -right-[34px] w-36 rotate-45 bg-red-600 text-white text-center py-1 text-[11px] font-extrabold uppercase tracking-widest shadow-lg ring-1 ring-red-900/30">
            Alugado
          </div>
        </div>
      )}

      <div className="p-2.5 sm:p-3">
        <PrecoImovel preco={imovel.preco} precoAntigo={imovel.preco_antigo} size="md" perMes />

        <Link
          href={buildImovelUrl(imovel)}
          className="block font-medium text-gray-900 text-xs sm:text-sm mt-1 sm:mt-1.5 hover:text-violet-700 line-clamp-2 sm:line-clamp-1 transition-colors"
        >
          {imovel.titulo}
        </Link>

        {imovel.bairro && (
          <p className="flex items-center gap-1 text-xs text-gray-400 mt-1 line-clamp-1">
            <MapPin size={11} className="shrink-0" />
            {imovel.bairro.nome}
            {imovel.condominio && <span className="hidden sm:inline"> · {imovel.condominio.nome}</span>}
          </p>
        )}

        <div className="flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2 text-xs text-gray-400 flex-wrap">
          {imovel.quartos > 0 && (
            <span className="flex items-center gap-0.5 sm:gap-1">
              <BedDouble size={11} />{imovel.quartos}q
            </span>
          )}
          {imovel.banheiros > 0 && (
            <span className="flex items-center gap-0.5 sm:gap-1">
              <Bath size={11} />{imovel.banheiros}bh
            </span>
          )}
          {imovel.vagas > 0 && (
            <span className="flex items-center gap-0.5 sm:gap-1">
              <Car size={11} />{imovel.vagas}vg
            </span>
          )}
          {imovel.area_m2 && <span>{imovel.area_m2}m²</span>}
        </div>

        <p className="text-[10px] text-gray-300 mt-1.5">{tempoRelativo(imovel.created_at)}</p>

        <div className="hidden sm:flex gap-2 mt-2">
          <a
            href={linkWpp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded-lg transition-colors font-medium"
          >
            WhatsApp
          </a>
          <Link
            href={buildImovelUrl(imovel)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            Ver
          </Link>
        </div>
      </div>
    </div>
  )
}
