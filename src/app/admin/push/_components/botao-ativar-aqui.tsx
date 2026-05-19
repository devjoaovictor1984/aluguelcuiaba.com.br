'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellOff, Check, Loader2, AlertCircle, X } from 'lucide-react'

interface Props {
  publicKey: string
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function BotaoAtivarAqui({ publicKey }: Props) {
  const router = useRouter()
  const [suporta, setSuporta] = useState(false)
  const [permissao, setPermissao] = useState<NotificationPermission>('default')
  const [inscrito, setInscrito] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro' | 'aviso'; texto: string } | null>(null)

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSuporta(ok)
    if (!ok) return
    setPermissao(Notification.permission)
    // Confere se já tem subscription neste browser
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription())
      .then(s => setInscrito(!!s))
      .catch(() => null)
  }, [])

  const inscrever = () => {
    setMsg(null)
    startTransition(async () => {
      try {
        if (Notification.permission === 'default') {
          const r = await Notification.requestPermission()
          if (r !== 'granted') {
            setMsg({ tipo: 'aviso', texto: 'Permissão negada. Você precisa permitir notificações pelo cadeado da barra de endereço.' })
            setPermissao(r)
            return
          }
          setPermissao(r)
        } else if (Notification.permission === 'denied') {
          setMsg({ tipo: 'aviso', texto: 'Notificações bloqueadas neste navegador. Clica no cadeado da barra, Configurações do site → Notificações → Permitir, e recarrega.' })
          return
        }

        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        })
        const json = sub.toJSON()
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: json.endpoint,
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
            user_agent: navigator.userAgent.slice(0, 200),
          }),
        })
        if (!res.ok) throw new Error(`API respondeu ${res.status}`)
        setInscrito(true)
        setMsg({ tipo: 'ok', texto: 'Inscrito! Dispositivo aparece na lista abaixo.' })
        router.refresh()
      } catch (e) {
        const erro = e instanceof Error ? e.message : 'falhou'
        setMsg({ tipo: 'erro', texto: erro })
      }
    })
  }

  const desinscrever = () => {
    if (!confirm('Desinscrever este dispositivo? Você não receberá mais pushes aqui.')) return
    setMsg(null)
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!sub) {
          setInscrito(false)
          return
        }
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        })
        setInscrito(false)
        setMsg({ tipo: 'ok', texto: 'Dispositivo desinscrito.' })
        router.refresh()
      } catch (e) {
        setMsg({ tipo: 'erro', texto: e instanceof Error ? e.message : 'falhou' })
      }
    })
  }

  if (!suporta) {
    return (
      <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">
        <AlertCircle size={13} className="shrink-0 mt-0.5" />
        <span>Este navegador não suporta Web Push. Use Chrome/Edge/Firefox no desktop ou um PWA instalado no iOS.</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        {inscrito ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1.5 rounded-full">
              <Check size={12} /> Inscrito neste dispositivo
            </span>
            <button
              type="button"
              onClick={desinscrever}
              disabled={isPending}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 px-2 py-1 disabled:opacity-50"
            >
              {isPending ? <Loader2 size={11} className="animate-spin" /> : <BellOff size={11} />}
              Desinscrever
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={inscrever}
            disabled={isPending || permissao === 'denied'}
            className="flex items-center gap-1.5 text-sm font-semibold bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white px-4 py-2 rounded-xl"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
            Ativar push neste dispositivo
          </button>
        )}
        <span className="text-[11px] text-gray-400">
          Permissão atual: <strong className={
            permissao === 'granted' ? 'text-green-600'
            : permissao === 'denied' ? 'text-red-600'
            : 'text-gray-500'
          }>{permissao}</strong>
        </span>
      </div>

      {msg && (
        <div className={`flex items-start gap-2 text-xs rounded-lg p-2 ${
          msg.tipo === 'ok' ? 'bg-green-50 text-green-800 border border-green-100'
          : msg.tipo === 'aviso' ? 'bg-amber-50 text-amber-800 border border-amber-100'
          : 'bg-red-50 text-red-800 border border-red-100'
        }`}>
          {msg.tipo === 'ok' ? <Check size={13} className="shrink-0 mt-0.5" />
            : msg.tipo === 'aviso' ? <AlertCircle size={13} className="shrink-0 mt-0.5" />
            : <X size={13} className="shrink-0 mt-0.5" />}
          <span>{msg.texto}</span>
        </div>
      )}
    </div>
  )
}
