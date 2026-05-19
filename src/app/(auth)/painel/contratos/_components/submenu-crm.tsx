'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileSignature, Users, Wallet, Cake, FileText, Receipt, MessageCircle, Trash2, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITENS = [
  { href: '/painel/inicio',        label: 'Início',     icon: LayoutDashboard, match: 'inicio' },
  { href: '/painel/contratos',     label: 'Contratos',  icon: FileSignature,   match: 'contratos' },
  { href: '/painel/clientes',      label: 'Clientes',   icon: Users,           match: 'clientes' },
  { href: '/painel/cobrancas',     label: 'Cobranças',  icon: MessageCircle,   match: 'cobrancas' },
  { href: '/painel/financeiro',    label: 'Financeiro', icon: Wallet,          match: 'financeiro' },
  { href: '/painel/relatorios',    label: 'Relatórios', icon: FileText,        match: 'relatorios' },
  { href: '/painel/agenda',        label: 'Agenda',     icon: Cake,            match: 'agenda' },
  { href: '/painel/perfil/recibo', label: 'Recibo',     icon: Receipt,         match: 'perfil/recibo' },
  { href: '/painel/lixeira',       label: 'Lixeira',    icon: Trash2,          match: 'lixeira' },
]

export function SubmenuCRM() {
  const pathname = usePathname()

  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
      {/* Header (Painel ← / CRM Locação) — só desktop */}
      <div className="hidden md:flex max-w-7xl mx-auto px-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/painel" className="flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 py-3">
            <ArrowLeft size={12} /> Painel
          </Link>
          <span className="text-gray-200">|</span>
          <span className="text-sm font-semibold text-gray-900">CRM Locação</span>
        </div>
        <nav className="flex">
          {ITENS.map(item => {
            const active = pathname.includes(item.match)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 lg:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  active
                    ? 'border-violet-700 text-violet-700'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                )}
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Mobile: back compacto + nav horizontal rolável */}
      <div className="md:hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50">
          <Link href="/painel" className="flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700">
            <ArrowLeft size={12} /> Painel
          </Link>
          <span className="text-xs font-semibold text-violet-700">CRM Locação</span>
        </div>
        <nav
          className="flex overflow-x-auto px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          style={{ overscrollBehaviorX: 'contain' }}
        >
          {ITENS.map(item => {
            const active = pathname.includes(item.match)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap shrink-0',
                  active
                    ? 'border-violet-700 text-violet-700'
                    : 'border-transparent text-gray-500'
                )}
              >
                <item.icon size={16} strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
