import { BottomNavMobile } from '@/components/bottom-nav-mobile'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* pb-20 reserva espaço pro bottom-nav fixed (mobile) — desktop não tem. */}
      <div className="pb-20 md:pb-0">
        {children}
      </div>
      <BottomNavMobile />
    </>
  )
}
