import {
  HelpCircle, LayoutDashboard, Users, FileText, Bell,
  TrendingUp, ClipboardCheck, Home, Calendar, DollarSign,
  Settings, Mail, Map, BarChart3,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Whitelist de ícones (não dá pra montar dinâmico no client sem perder tree-shaking;
// admin escreve o nome exato como string e a gente mapeia)
const ICONES: Record<string, LucideIcon> = {
  HelpCircle, LayoutDashboard, Users, FileText, Bell,
  TrendingUp, ClipboardCheck, Home, Calendar, DollarSign,
  Settings, Mail, Map, BarChart3,
}

export function iconePorNome(nome: string | null | undefined): LucideIcon {
  if (!nome) return HelpCircle
  return ICONES[nome] ?? HelpCircle
}
