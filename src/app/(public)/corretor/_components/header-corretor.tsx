'use client'

// Header sticky exclusivo da landing /corretor.
// Topo (sobre o hero escuro): fundo transparente, texto branco.
// Ao rolar: fundo branco translúcido + sombra, texto escuro.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X, ArrowRight } from 'lucide-react'

const LINKS = [
  { label: 'Imóveis', href: '/' },
  { label: 'Blog', href: '/blog' },
  { label: 'Para corretor', href: '/corretor' },
  { label: 'Anunciar', href: '/painel/anuncios/novo' },
]

export function HeaderCorretor({ ctaHref }: { ctaHref: string }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Trava o scroll do body quando o menu mobile abre
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const linkColor = scrolled ? 'text-gray-600 hover:text-violet-700' : 'text-white/90 hover:text-white'
  const brandColor = scrolled ? 'text-violet-800' : 'text-white'

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className={`font-extrabold text-lg tracking-tight transition-colors ${brandColor}`}>
          Aluguel<span className="text-amber-400">Cuiabá</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {LINKS.map(l => (
            <Link key={l.label} href={l.href} className={`text-sm font-medium transition-colors ${linkColor}`}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={ctaHref}
            className="hidden sm:inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-lg shadow-amber-500/30 transition-all hover:scale-[1.03]"
          >
            Começar grátis <ArrowRight size={15} />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`md:hidden p-2 rounded-lg transition-colors ${scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'}`}
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-72 max-w-[85%] bg-white shadow-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <span className="font-extrabold text-lg text-violet-800">
                Aluguel<span className="text-amber-500">Cuiabá</span>
              </span>
              <button type="button" onClick={() => setOpen(false)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" aria-label="Fechar menu">
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {LINKS.map(l => (
                <Link
                  key={l.label}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="text-base font-medium text-gray-700 hover:text-violet-700 hover:bg-violet-50 px-3 py-3 rounded-xl transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <Link
              href={ctaHref}
              onClick={() => setOpen(false)}
              className="mt-4 inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-3 rounded-xl shadow-lg shadow-amber-500/30"
            >
              Começar grátis <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
