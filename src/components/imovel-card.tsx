import Image from 'next/image'
import Link from 'next/link'
import { MapPin, BedDouble, Bath, Car } from 'lucide-react'
import { formatarPreco, gerarLinkWhatsApp, gerarMensagemWhatsApp, tempoRelativo } from '@/lib/utils'
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group">
      <Link href={`/imoveis/${imovel.slug ?? imovel.id}`} className="block relative h-32 sm:h-48 bg-gray-100 overflow-hidden">
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
        {imovel.destaque && (
          <span className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            Destaque
          </span>
        )}
        <span className="absolute top-2 right-2 bg-white/90 text-gray-700 text-xs px-2 py-0.5 rounded-full capitalize font-medium">
          {imovel.tipo}
        </span>
      </Link>

      <div className="p-2.5 sm:p-3">
        <p className="font-bold text-orange-500 text-base sm:text-lg leading-none">
          {formatarPreco(imovel.preco)}
          <span className="text-xs sm:text-sm font-normal text-gray-400">/mês</span>
        </p>

        <Link
          href={`/imoveis/${imovel.slug ?? imovel.id}`}
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
            href={`/imoveis/${imovel.slug ?? imovel.id}`}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            Ver
          </Link>
        </div>
      </div>
    </div>
  )
}
