import { exigirAcessoCRM } from '@/lib/crm/acesso'

export default async function LixeiraLayout({ children }: { children: React.ReactNode }) {
  await exigirAcessoCRM()
  return <div className="max-w-7xl mx-auto">{children}</div>
}
