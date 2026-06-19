'use client'

import { useState, useTransition } from 'react'
import { Loader2, Check, AlertCircle, Mail, ShieldCheck, PenLine } from 'lucide-react'
import { CapturaSelfie } from '@/components/captura-selfie'
import { SignaturePad } from './signature-pad'
import { solicitarOtp, confirmarAssinatura } from '../actions'

interface Props {
  token: string
  pdfUrl: string
  nome: string
  papel: string | null
  titulo: string
  jaAssinado: boolean
}

const TERMO =
  'Declaro que li e concordo com o conteúdo do contrato acima e assino-o eletronicamente. ' +
  'Autorizo o registro da minha selfie, do código enviado ao meu e-mail e dos dados de acesso ' +
  '(data, hora, IP e localização) como prova da minha autoria, nos termos da MP 2.200-2/2001 e da LGPD.'

export function FluxoAssinatura({ token, pdfUrl, nome, papel, titulo, jaAssinado }: Props) {
  const [otpEnviado, setOtpEnviado] = useState(false)
  const [emailMasc, setEmailMasc] = useState('')
  const [otp, setOtp] = useState('')
  const [selfie, setSelfie] = useState<string | null>(null)
  const [assinatura, setAssinatura] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [erro, setErro] = useState('')
  const [concluido, setConcluido] = useState(jaAssinado)
  const [isPending, startTransition] = useTransition()

  const pedirOtp = () => {
    setErro('')
    startTransition(async () => {
      const r = await solicitarOtp(token)
      if (r.error) { setErro(r.error); return }
      setOtpEnviado(true)
      setEmailMasc(r.email ?? '')
    })
  }

  const capturarGeo = (): Promise<string | null> =>
    new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        p => resolve(`${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}`),
        () => resolve(null),
        { timeout: 5000 },
      )
    })

  const assinar = () => {
    setErro('')
    if (otp.trim().length !== 6) { setErro('Digite o código de 6 dígitos enviado ao seu e-mail.'); return }
    if (!selfie) { setErro('Tire a selfie.'); return }
    if (!assinatura) { setErro('Desenhe sua assinatura.'); return }
    if (!consent) { setErro('Aceite o termo de consentimento.'); return }
    startTransition(async () => {
      const geo = await capturarGeo()
      const r = await confirmarAssinatura(token, {
        otp: otp.trim(), selfie_b64: selfie, assinatura_b64: assinatura, consentimento: consent, geo,
      })
      if (r.error) { setErro(r.error); return }
      setConcluido(true)
    })
  }

  if (concluido) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check size={30} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Assinatura registrada!</h2>
        <p className="text-sm text-gray-500">Obrigado, {nome}. Quando todas as partes assinarem, o contrato assinado é enviado por e-mail.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-sm text-violet-900">
        Olá <strong>{nome}</strong>{papel ? ` (${papel})` : ''} — você vai assinar o contrato <strong>{titulo}</strong>.
      </div>

      {/* Contrato */}
      <div className="rounded-2xl border border-gray-100 overflow-hidden">
        <iframe src={pdfUrl} title="Contrato" className="w-full" style={{ height: '60vh', border: 'none' }} />
        <div className="px-4 py-2 border-t border-gray-100 text-center bg-gray-50">
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-violet-700 hover:underline">Abrir o PDF em nova aba</a>
        </div>
      </div>

      {/* 1. OTP */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-2"><Mail size={14} className="text-violet-600" /> 1. Código por e-mail</h3>
        {!otpEnviado ? (
          <button type="button" onClick={pedirOtp} disabled={isPending} className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl">
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Enviar código pro meu e-mail
          </button>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-2">Enviamos um código para <strong>{emailMasc}</strong>.</p>
            <input
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              className="w-40 text-center tracking-[0.4em] font-mono text-lg px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button type="button" onClick={pedirOtp} disabled={isPending} className="ml-3 text-xs text-violet-700 hover:underline">Reenviar</button>
          </>
        )}
      </section>

      {/* 2. Selfie */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-2"><ShieldCheck size={14} className="text-violet-600" /> 2. Selfie</h3>
        <CapturaSelfie value={selfie} onChange={setSelfie} />
      </section>

      {/* 3. Assinatura */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-2"><PenLine size={14} className="text-violet-600" /> 3. Sua assinatura</h3>
        <SignaturePad value={assinatura} onChange={setAssinatura} />
      </section>

      {/* 4. Consentimento */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4">
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 accent-violet-600 shrink-0" />
          <span className="text-xs text-gray-600">{TERMO}</span>
        </label>
      </section>

      {erro && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2.5">
          <AlertCircle size={15} className="shrink-0 mt-0.5" /> <span>{erro}</span>
        </div>
      )}

      <button
        type="button"
        onClick={assinar}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl"
      >
        {isPending ? <Loader2 size={18} className="animate-spin" /> : <PenLine size={18} />}
        Assinar contrato
      </button>
    </div>
  )
}
