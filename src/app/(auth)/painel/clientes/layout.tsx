import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { SubmenuCRM } from '../contratos/_components/submenu-crm'

export default async function ClientesLayout({ children }: { children: React.ReactNode }) {
  await exigirAcessoCRM()
  return (
    <div className="min-h-screen bg-gray-50">
      <SubmenuCRM />
      <div className="max-w-7xl mx-auto">{children}</div>
    </div>
  )
}
