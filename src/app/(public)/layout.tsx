import { BottomNavMobile } from '@/components/bottom-nav-mobile'
import { RegisterSW } from '@/components/push/register-sw'
import { ModalAtivarPush } from '@/components/push/modal-ativar-push'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

  return (
    <>
      {/* pb-20 reserva espaço pro bottom-nav fixed (mobile) — desktop não tem. */}
      <div className="pb-20 md:pb-0">
        {children}
      </div>
      <BottomNavMobile />
      <RegisterSW />
      {vapidPublic && <ModalAtivarPush publicKey={vapidPublic} />}
    </>
  )
}
