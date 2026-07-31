'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileSignature, Briefcase, Users, MessageCircle, Wallet,
  FileText, Cake, Receipt, Trash2, Home, Plus, LogOut, Menu, X, List,
  UserCheck, Flame,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ItemNav {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number }>
  match: string[]  // arrays de prefixos pra detectar ativo
  notMatch?: string[]  // prefixos que NÃO devem ativar (ex: subrota com item próprio)
}

const GRUPO_CRM: ItemNav[] = [
  { href: '/painel/inicio',         label: 'Início',         icon: LayoutDashboard, match: ['/painel/inicio'] },
  { href: '/painel/contratos',      label: 'Contratos',      icon: FileSignature,   match: ['/painel/contratos'] },
  { href: '/painel/administracoes', label: 'Administrações', icon: Briefcase,       match: ['/painel/administracoes'] },
  { href: '/painel/clientes',       label: 'Clientes',       icon: Users,           match: ['/painel/clientes'] },
  { href: '/painel/cobrancas',      label: 'Cobranças',      icon: MessageCircle,   match: ['/painel/cobrancas'] },
  { href: '/painel/financeiro',     label: 'Financeiro',     icon: Wallet,          match: ['/painel/financeiro'] },
  { href: '/painel/relatorios',     label: 'Relatórios',     icon: FileText,        match: ['/painel/relatorios'] },
  { href: '/painel/agenda',         label: 'Agenda',         icon: Cake,            match: ['/painel/agenda'] },
]

const GRUPO_SEGUROS: ItemNav[] = [
  { href: '/painel/seguros/fianca',   label: 'Seguro fiança',   icon: UserCheck, match: ['/painel/seguros/fianca'] },
  { href: '/painel/seguros/incendio', label: 'Seguro incêndio', icon: Flame,     match: ['/painel/seguros/incendio'] },
]

const GRUPO_ANUNCIOS: ItemNav[] = [
  { href: '/painel',               label: 'Meus anúncios',  icon: Home, match: ['/painel'] },
  { href: '/painel/anuncios',      label: 'Listar anúncios', icon: List, match: ['/painel/anuncios'], notMatch: ['/painel/anuncios/novo'] },
  { href: '/painel/anuncios/novo', label: 'Novo anúncio',   icon: Plus, match: ['/painel/anuncios/novo'] },
]

const GRUPO_CONTA: ItemNav[] = [
  { href: '/painel/perfil/recibo', label: 'Recibo',  icon: Receipt, match: ['/painel/perfil/recibo'] },
  { href: '/painel/lixeira',       label: 'Lixeira', icon: Trash2,  match: ['/painel/lixeira'] },
]

interface Props {
  userNome: string | null
  userEmail: string
  fotoUrl: string | null
  plano: string
  isAdmin: boolean
  logoutAction: () => void  // server action
}

export function SidebarPainel({ userNome, userEmail, fotoUrl, plano, isAdmin, logoutAction }: Props) {
  const pathname = usePathname()
  const [drawerAberto, setDrawerAberto] = useState(false)

  const isAtivo = (item: ItemNav) => {
    // `/painel` matches "/painel" exato OR "/painel?...". "/painel/inicio" etc não.
    if (item.href === '/painel') {
      return pathname === '/painel'
    }
    if (item.notMatch?.some(p => pathname === p || pathname.startsWith(p + '/'))) {
      return false
    }
    return item.match.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))
  }

  const renderItem = (item: ItemNav, ativo: boolean) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={() => setDrawerAberto(false)}
      className={cn(
        'group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative',
        ativo
          ? 'bg-violet-50 text-violet-900'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      )}
    >
      {ativo && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-violet-700 rounded-r" />}
      <item.icon size={18} />
      <span className="flex-1">{item.label}</span>
    </Link>
  )

  const renderGrupo = (titulo: string, itens: ItemNav[]) => (
    <div className="space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 py-2">
        {titulo}
      </p>
      {itens.map(i => renderItem(i, isAtivo(i)))}
    </div>
  )

  const conteudoSidebar = (
    <>
      {/* Cabeçalho com logo */}
      <div className="px-4 py-5 border-b border-gray-100">
        <Link href="/painel" onClick={() => setDrawerAberto(false)} className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-violet-700 text-white flex items-center justify-center font-bold shadow-sm">
            A
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">AluguelCuiabá</p>
            <p className="text-[10px] text-gray-400">Painel</p>
          </div>
        </Link>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {renderGrupo('CRM Locação', GRUPO_CRM)}
        {renderGrupo('Seguros', GRUPO_SEGUROS)}
        {renderGrupo('Anúncios', GRUPO_ANUNCIOS)}
        {renderGrupo('Conta', GRUPO_CONTA)}
      </nav>

      {/* Rodapé com usuário */}
      <div className="border-t border-gray-100 p-3">
        <Link
          href="/painel/perfil"
          onClick={() => setDrawerAberto(false)}
          className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-violet-100 overflow-hidden shrink-0 flex items-center justify-center">
            {fotoUrl ? (
              <Image src={fotoUrl} alt={userNome ?? 'avatar'} width={36} height={36} className="object-cover w-full h-full" unoptimized />
            ) : (
              <span className="text-sm font-bold text-violet-700">
                {(userNome ?? userEmail).slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">
              {userNome ?? 'Sem nome'}
            </p>
            <p className="text-[10px] text-gray-500 truncate">
              {isAdmin ? '👑 Admin' : `Plano ${plano}`}
            </p>
          </div>
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={13} />
            Sair
          </button>
        </form>
      </div>
    </>
  )

  return (
    <>
      {/* Sidebar desktop fixa */}
      <aside className="hidden lg:flex fixed top-0 left-0 bottom-0 w-60 bg-white border-r border-gray-100 flex-col z-30">
        {conteudoSidebar}
      </aside>

      {/* Topbar mobile */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-100 flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setDrawerAberto(true)}
          aria-label="Abrir menu"
          className="p-1 -m-1 text-gray-700 hover:text-violet-700"
        >
          <Menu size={22} />
        </button>
        <Link href="/painel" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-700 text-white flex items-center justify-center font-bold text-xs">A</div>
          <span className="text-sm font-bold text-gray-900">AluguelCuiabá</span>
        </Link>
        <Link href="/painel/perfil" className="w-8 h-8 rounded-full bg-violet-100 overflow-hidden flex items-center justify-center">
          {fotoUrl ? (
            <Image src={fotoUrl} alt={userNome ?? 'avatar'} width={32} height={32} className="object-cover w-full h-full" unoptimized />
          ) : (
            <span className="text-xs font-bold text-violet-700">
              {(userNome ?? userEmail).slice(0, 1).toUpperCase()}
            </span>
          )}
        </Link>
      </header>

      {/* Drawer mobile */}
      {drawerAberto && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerAberto(false)}
            aria-hidden
          />
          <aside className="relative bg-white w-72 max-w-[85vw] flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            <button
              type="button"
              onClick={() => setDrawerAberto(false)}
              aria-label="Fechar"
              className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-700 z-10"
            >
              <X size={20} />
            </button>
            {conteudoSidebar}
          </aside>
        </div>
      )}
    </>
  )
}
