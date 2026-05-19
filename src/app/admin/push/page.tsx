import { Bell, AlertCircle, CheckCircle2, Smartphone } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { FormTestePush } from './_components/form-teste-push'
import { BotaoAtivarAqui } from './_components/botao-ativar-aqui'

export const dynamic = 'force-dynamic'

export default async function AdminPushPage() {
  const admin = createAdminClient()

  const { count: totalSubs, error: countErr } = await admin
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true })

  const v14Faltando = !!countErr

  // Lista resumida pra debug (últimas 10 subscrições)
  const { data: subs } = v14Faltando
    ? { data: [] as Array<{ id: string; user_agent: string | null; created_at: string; last_seen: string }> }
    : await admin
        .from('push_subscriptions')
        .select('id, user_agent, created_at, last_seen')
        .order('last_seen', { ascending: false })
        .limit(10)

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT
  const vapidOk = !!vapidPublic && !!vapidPrivate && !!vapidSubject

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bell size={22} className="text-violet-600" /> Push notifications
        </h1>
        <p className="text-sm text-gray-500">Disparar notificação manualmente para todos os dispositivos inscritos.</p>
      </div>

      {/* Checklist do setup */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Status do setup</h2>
        <div className="space-y-2 text-sm">
          <ItemCheck ok={vapidOk} label={`VAPID keys (${vapidOk ? 'configuradas' : 'NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT faltando na Vercel'})`} />
          <ItemCheck ok={!v14Faltando} label={`Tabela push_subscriptions (${v14Faltando ? 'rode crm_v14_push_subscriptions.sql no Supabase' : 'ok'})`} />
          <ItemCheck ok={(totalSubs ?? 0) > 0} label={`Dispositivos inscritos: ${totalSubs ?? 0}`} warning={(totalSubs ?? 0) === 0 && !v14Faltando} />
        </div>
        {v14Faltando && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3 font-mono break-all">
            {countErr?.message}
          </p>
        )}
      </section>

      {/* Ativar neste dispositivo */}
      {vapidPublic && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Este dispositivo</h2>
          <p className="text-xs text-gray-500 mb-3">
            Atalho pra inscrever ou desinscrever o browser atual sem precisar esperar o modal da home.
          </p>
          <BotaoAtivarAqui publicKey={vapidPublic} />
        </section>
      )}

      {/* Form de envio */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Disparar push de teste</h2>
        {!vapidOk ? (
          <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>Configure as 3 env vars VAPID na Vercel antes de testar.</span>
          </div>
        ) : (totalSubs ?? 0) === 0 ? (
          <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <Smartphone size={15} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Nenhum dispositivo inscrito ainda</p>
              <p className="text-xs">
                Abre o site em uma aba anônima no celular ou desktop, espera 10s e clica em "Ativar" no modal.
                Depois volta aqui e dispara um teste.
              </p>
            </div>
          </div>
        ) : (
          <FormTestePush totalSubs={totalSubs ?? 0} />
        )}
      </section>

      {/* Subs recentes */}
      {!v14Faltando && subs && subs.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Últimas inscrições</h2>
          <ul className="space-y-1.5 text-xs">
            {subs.map(s => (
              <li key={s.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                <Smartphone size={13} className="text-gray-400 shrink-0" />
                <span className="flex-1 truncate text-gray-700">{s.user_agent ?? 'desconhecido'}</span>
                <span className="text-gray-400 shrink-0">{new Date(s.created_at).toLocaleString('pt-BR')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function ItemCheck({ ok, label, warning }: { ok: boolean; label: string; warning?: boolean }) {
  const cor = ok ? 'text-green-700' : warning ? 'text-amber-700' : 'text-red-700'
  const Icon = ok ? CheckCircle2 : AlertCircle
  return (
    <div className={`flex items-center gap-2 ${cor}`}>
      <Icon size={14} className="shrink-0" />
      <span>{label}</span>
    </div>
  )
}
