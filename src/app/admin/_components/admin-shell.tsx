'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Home, Users, MapPin, FileText,
  FileDown, Settings, ExternalLink, Menu, X, LogOut, ShieldCheck, Tag, LayoutList, Mail, Map, Bell,
} from 'lucide-react'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/imoveis', label: 'Imóveis', icon: Home },
  { href: '/admin/usuarios', label: 'Usuários', icon: Users },
  { href: '/admin/bairros', label: 'Bairros', icon: MapPin },
  { href: '/admin/posts', label: 'Posts', icon: FileText },
  { href: '/admin/categorias', label: 'Categorias', icon: Tag },
  { href: '/admin/banners', label: 'Banners', icon: LayoutList },
  { href: '/admin/emails', label: 'E-mails', icon: Mail },
  { href: '/admin/push', label: 'Push', icon: Bell },
  { href: '/admin/geocode', label: 'Geocode', icon: Map },
  { href: '/admin/contratos', label: 'Contratos', icon: FileDown },
  { href: '/admin/seguros', label: 'Seguros', icon: ShieldCheck },
  { href: '/admin/site', label: 'Site', icon: Settings },
]

interface Props {
  children: React.ReactNode
  email: string
  nome: string | null
}

function NavItem({ href, label, icon: Icon, exact, onClick }: {
  href: string; label: string; icon: React.ElementType; exact?: boolean; onClick?: () => void
}) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-violet-700 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      <Icon size={18} className="shrink-0" />
      {label}
    </Link>
  )
}

export function AdminShell({ children, email, nome }: Props) {
  const [open, setOpen] = useState(false)

  const Sidebar = ({ onNav }: { onNav?: () => void }) => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-gray-800">
        <Link href="/admin">
          <Image src="/logo.png" alt="AluguelCuiabá" width={140} height={36}
            className="h-8 w-auto object-contain brightness-0 invert" />
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(item => (
          <NavItem key={item.href} {...item} onClick={onNav} />
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-gray-800 space-y-2">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <ExternalLink size={14} />
          Ver site
        </Link>
        <div className="px-3 py-2">
          <p className="text-xs text-gray-400 truncate">{nome ?? email}</p>
          <p className="text-xs text-gray-600 truncate">{email}</p>
        </div>
        <form action="/api/logout" method="POST">
          <Link href="/entrar" className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors w-full">
            <LogOut size={14} />
            Sair
          </Link>
        </form>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-gray-900 fixed inset-y-0 left-0 z-30">
        <Sidebar />
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white shadow-lg"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-gray-900 flex flex-col h-full shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
            <Sidebar onNav={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-60 min-h-screen">
        {children}
      </main>
    </div>
  )
}
