'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileSignature, Users, Wallet, Cake, FileText, Receipt, MessageCircle, ArrowLeft } from 'lucide-react'
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
]

export function SubmenuCRM() {
  const pathname = usePathname()

  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
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
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
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
    </div>
  )
}
