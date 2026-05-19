'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Plus, Heart, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITENS = [
  { href: '/',                    label: 'Início',    icon: Home,  matchExact: true },
  { href: '/painel/anuncios/novo', label: 'Anunciar', icon: Plus,  destaque: true   },
  { href: '/favoritos',           label: 'Favoritos', icon: Heart                   },
  { href: '/painel',              label: 'Perfil',    icon: User                    },
]

export function BottomNavMobile() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.05)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-4">
        {ITENS.map(item => {
          const Icon = item.icon
          const active = item.matchExact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors',
                  item.destaque
                    ? 'text-violet-700'
                    : active
                      ? 'text-violet-700'
                      : 'text-gray-500 hover:text-gray-900'
                )}
              >
                {item.destaque ? (
                  <span className="flex items-center justify-center w-10 h-10 -mt-1 rounded-full bg-violet-700 text-white shadow-md">
                    <Icon size={20} strokeWidth={2.5} />
                  </span>
                ) : (
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                )}
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
