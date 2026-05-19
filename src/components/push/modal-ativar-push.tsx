'use client'

import { useEffect, useState } from 'react'
import { Bell, X, CheckCircle2, AlertCircle, Loader2, Home as HomeIcon } from 'lucide-react'

const DISMISS_KEY = 'push_dismiss_at'
const DISMISS_DAYS = 7
const DELAY_MS = 10_000
const ATIVO_KEY = 'push_inscrito'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function suportaPush(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function ehIosNaoInstalado(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  const isIos = /iPhone|iPad|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  return isIos && !standalone
}

interface Props {
  publicKey: string
}

export function ModalAtivarPush({ publicKey }: Props) {
  const [mostrar, setMostrar] = useState(false)
  const [estado, setEstado] = useState<'idle' | 'inscrevendo' | 'sucesso' | 'erro' | 'ios-precisa-instalar'>('idle')
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!publicKey) return
    if (!suportaPush()) return
    if (Notification.permission === 'denied') return
    if (Notification.permission === 'granted') return // já dispostou, evita mostrar
    if (localStorage.getItem(ATIVO_KEY) === '1') return

    const dismissAt = parseInt(localStorage.getItem(DISMISS_KEY) ?? '0', 10)
    const recente = Date.now() - dismissAt < DISMISS_DAYS * 86400000
    if (recente) return

    const t = window.setTimeout(() => setMostrar(true), DELAY_MS)
    return () => window.clearTimeout(t)
  }, [publicKey])

  const fechar = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setMostrar(false)
  }

  const ativar = async () => {
    setErro('')
    if (ehIosNaoInstalado()) {
      setEstado('ios-precisa-instalar')
      return
    }
    setEstado('inscrevendo')
    try {
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
      localStorage.setItem(ATIVO_KEY, '1')
      setEstado('sucesso')
      setTimeout(() => setMostrar(false), 2500)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'falhou'
      setErro(msg)
      setEstado('erro')
    }
  }

  if (!mostrar) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-6 text-white relative">
          <button
            type="button"
            onClick={fechar}
            className="absolute right-3 top-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
            aria-label="Fechar"
          >
            <X size={15} />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-3">
            <Bell size={22} />
          </div>
          <h2 className="text-lg font-bold">Receba avisos de novos imóveis</h2>
          <p className="text-sm text-violet-100 mt-1">
            A gente te manda uma notificação assim que aparecer um novo imóvel pra alugar em Cuiabá. Sem spam.
          </p>
        </div>

        <div className="p-5">
          {estado === 'sucesso' ? (
            <div className="text-center py-4">
              <CheckCircle2 size={36} className="text-green-600 mx-auto mb-2" />
              <p className="font-semibold text-gray-900">Tudo certo!</p>
              <p className="text-xs text-gray-500 mt-0.5">Você receberá uma notificação quando houver imóvel novo.</p>
            </div>
          ) : estado === 'ios-precisa-instalar' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900 space-y-2">
              <p className="font-semibold flex items-center gap-1.5"><HomeIcon size={14} /> Adicione à tela inicial primeiro</p>
              <p className="text-xs leading-relaxed">
                No iPhone, toque no botão de compartilhar do Safari e escolha <strong>Adicionar à Tela de Início</strong>.
                Depois abra o ícone da tela e ative os avisos por aqui. (Limitação do iOS, não tem como contornar.)
              </p>
              <button
                type="button"
                onClick={fechar}
                className="w-full mt-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold py-2 rounded-xl"
              >
                Entendi
              </button>
            </div>
          ) : (
            <>
              {estado === 'erro' && (
                <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <span>Falha: {erro}. Tente de novo daqui a pouco.</span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fechar}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Agora não
                </button>
                <button
                  type="button"
                  onClick={ativar}
                  disabled={estado === 'inscrevendo'}
                  className="flex-1 py-3 rounded-xl bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2"
                >
                  {estado === 'inscrevendo' ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                  Ativar
                </button>
              </div>
              <p className="text-[11px] text-gray-400 text-center mt-3">
                Você pode desativar a qualquer momento nas configurações do navegador.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
