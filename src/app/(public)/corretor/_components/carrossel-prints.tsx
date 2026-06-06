'use client'

// Carrossel de prints do sistema (scroll-snap horizontal + setas + dots).
// PLACEHOLDERS: cada slide tem uma moldura com conteúdo estilizado. Pra usar
// prints reais, troque o miolo de cada <Slide> por:
//   <Imagem src="/prints/dashboard.png" alt="..." aspect="16/9" />
// (coloque os arquivos em /public/prints e importe { Imagem } de '@/components/imagem')
import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface SlideDef {
  legenda: string
  cor: string
  // tipo de placeholder visual
  variante: 'dashboard' | 'recibo' | 'lista' | 'relatorio' | 'pagamentos' | 'mobile' | 'anuncio' | 'cadastro'
}

const SLIDES: SlideDef[] = [
  { legenda: 'Controle financeiro por mês', cor: 'from-violet-100 to-indigo-100', variante: 'dashboard' },
  { legenda: 'Recibo em PDF com 1 clique', cor: 'from-amber-100 to-orange-100', variante: 'recibo' },
  { legenda: 'Contratos e parcelas no mesmo lugar', cor: 'from-emerald-100 to-teal-100', variante: 'lista' },
  { legenda: 'Relatório para o proprietário', cor: 'from-violet-100 to-fuchsia-100', variante: 'relatorio' },
  { legenda: 'Controle de pagamentos', cor: 'from-sky-100 to-blue-100', variante: 'pagamentos' },
  { legenda: 'Painel no celular', cor: 'from-violet-100 to-amber-100', variante: 'mobile' },
  { legenda: 'Anúncio com mapa e WhatsApp', cor: 'from-green-100 to-emerald-100', variante: 'anuncio' },
  { legenda: 'Cadastro de imóvel completo', cor: 'from-orange-100 to-amber-100', variante: 'cadastro' },
]

export function CarrosselPrints() {
  const scroller = useRef<HTMLDivElement>(null)
  const [ativo, setAtivo] = useState(0)

  const mover = (dir: -1 | 1) => {
    const el = scroller.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-slide]')
    const passo = card ? card.offsetWidth + 16 : el.clientWidth
    el.scrollBy({ left: dir * passo, behavior: 'smooth' })
  }

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-slide]')
    const passo = card ? card.offsetWidth + 16 : el.clientWidth
    setAtivo(Math.round(el.scrollLeft / passo))
  }

  return (
    <div className="relative">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((s, i) => (
          <div
            key={i}
            data-slide
            className="snap-center shrink-0 w-[85%] sm:w-[60%] lg:w-[42%]"
          >
            <div className="rounded-3xl border border-gray-100 shadow-lg shadow-violet-900/5 overflow-hidden bg-white">
              {/* Moldura tipo navegador */}
              <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-100">
                <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-300" />
              </div>
              {/* PLACEHOLDER visual — trocar por print real */}
              <div className={`aspect-[16/10] bg-gradient-to-br ${s.cor} p-4`}>
                <PlaceholderPrint variante={s.variante} />
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-700 mt-3 text-center">{s.legenda}</p>
          </div>
        ))}
      </div>

      {/* Setas */}
      <button
        type="button" onClick={() => mover(-1)} aria-label="Anterior"
        className="absolute -left-2 top-1/3 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center text-gray-600 hover:text-violet-700 hover:scale-105 transition-all"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button" onClick={() => mover(1)} aria-label="Próximo"
        className="absolute -right-2 top-1/3 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center text-gray-600 hover:text-violet-700 hover:scale-105 transition-all"
      >
        <ChevronRight size={20} />
      </button>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-2">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${i === ativo ? 'w-5 bg-violet-700' : 'w-1.5 bg-gray-300'}`}
          />
        ))}
      </div>
    </div>
  )
}

/* Placeholders estilizados (sem imagem) — só pra dar volume visual até os prints reais. */
function PlaceholderPrint({ variante }: { variante: SlideDef['variante'] }) {
  if (variante === 'recibo') {
    return (
      <div className="bg-white rounded-xl h-full p-4 shadow-sm flex flex-col">
        <div className="h-3 w-1/3 bg-violet-700 rounded mb-3" />
        <div className="h-2 w-1/2 bg-gray-200 rounded mb-1" />
        <div className="bg-violet-50 rounded-lg p-3 my-3 text-center">
          <div className="text-[9px] font-bold tracking-wider text-violet-600">VALOR DO RECIBO</div>
          <div className="text-lg font-extrabold text-violet-700">R$ 1.900</div>
        </div>
        <div className="space-y-1.5 mt-auto">
          {[1, 2, 3].map(i => <div key={i} className="h-1.5 bg-gray-100 rounded" />)}
        </div>
      </div>
    )
  }
  if (variante === 'mobile') {
    return (
      <div className="h-full flex items-end justify-center">
        <div className="w-28 bg-white rounded-t-2xl shadow-sm border border-gray-100 border-b-0 p-2 space-y-1.5">
          <div className="h-2 w-2/3 bg-violet-200 rounded mx-auto" />
          <div className="grid grid-cols-2 gap-1">
            <div className="h-6 bg-green-100 rounded" /><div className="h-6 bg-amber-100 rounded" />
          </div>
          <div className="grid grid-cols-4 gap-0.5 pt-1 border-t border-gray-100">
            {[0, 1, 2, 3].map(i => <div key={i} className={`h-3 rounded ${i === 0 ? 'bg-violet-400' : 'bg-gray-100'}`} />)}
          </div>
        </div>
      </div>
    )
  }
  if (variante === 'dashboard' || variante === 'relatorio' || variante === 'pagamentos') {
    return (
      <div className="bg-white rounded-xl h-full p-3 shadow-sm space-y-2">
        <div className="h-2.5 w-1/3 bg-violet-200 rounded" />
        <div className="grid grid-cols-4 gap-1.5">
          <div className="h-9 bg-green-100 rounded" /><div className="h-9 bg-amber-100 rounded" />
          <div className="h-9 bg-violet-100 rounded" /><div className="h-9 bg-sky-100 rounded" />
        </div>
        <div className="flex items-end gap-1 h-10 pt-1">
          {[50, 70, 40, 85, 60, 75, 95].map((h, i) => (
            <div key={i} className="flex-1 bg-violet-300 rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    )
  }
  // lista / anuncio / cadastro
  return (
    <div className="bg-white rounded-xl h-full p-3 shadow-sm space-y-1.5">
      <div className="h-2.5 w-1/2 bg-violet-200 rounded mb-1" />
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gray-100 shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-1.5 bg-gray-200 rounded w-2/3" />
            <div className="h-1.5 bg-gray-100 rounded w-1/3" />
          </div>
          <div className="h-4 w-10 rounded bg-green-100 shrink-0" />
        </div>
      ))}
    </div>
  )
}
