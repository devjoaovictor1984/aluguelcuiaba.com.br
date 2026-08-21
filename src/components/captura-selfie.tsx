'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, RefreshCw, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'

/**
 * Captura de selfie reutilizável (assinatura de termos/vistorias).
 *
 * Usa a câmera frontal via getUserMedia. Se o navegador bloquear ou não
 * suportar, cai pro <input type="file" capture="user"> (abre a câmera no
 * celular). Devolve a foto como data URL JPEG via onChange.
 */
interface Props {
  value: string | null
  onChange: (dataUrl: string | null) => void
  /** Texto de consentimento exibido acima da câmera. */
  consentimento?: string
  disabled?: boolean
}

const CONSENT_PADRAO =
  'Autorizo o registro da minha imagem (selfie) neste momento, junto da assinatura, ' +
  'exclusivamente como prova de identidade para este termo, nos termos da LGPD (Lei 13.709/2018).'

export function CapturaSelfie({ value, onChange, consentimento = CONSENT_PADRAO, disabled = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [camAtiva, setCamAtiva] = useState(false)
  // A câmera só entrega pixel depois do 1º frame decodificado. Antes disso o
  // vídeo já tem videoWidth, mas o canvas sai preto — daí a trava aqui.
  const [pronta, setPronta] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  // Encerra o stream ao desmontar ou quando a câmera é desativada.
  const pararCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCamAtiva(false)
    setPronta(false)
  }
  useEffect(() => () => pararCamera(), [])

  // Liga o stream no <video> DEPOIS que o React montou o elemento. Com
  // requestAnimationFrame isso corria junto do commit e o ref podia estar
  // null: o stream nunca era atribuído e o vídeo ficava preto até a pessoa
  // cancelar e abrir de novo.
  useEffect(() => {
    const v = videoRef.current
    const stream = streamRef.current
    if (!camAtiva || !v || !stream) return
    v.srcObject = stream
    v.play().catch(() => {})
  }, [camAtiva])

  const abrirCamera = async () => {
    setErro('')
    setCarregando(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('sem-suporte')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      setPronta(false)
      setCamAtiva(true) // o efeito acima atribui o stream após a montagem
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      // Sem permissão ou sem suporte → usa o fallback de upload (câmera nativa).
      setErro(
        msg === 'sem-suporte'
          ? 'Seu navegador não suporta câmera aqui. Use o botão de enviar foto.'
          : 'Não consegui abrir a câmera. Verifique a permissão ou envie uma foto pelo botão abaixo.'
      )
      fileRef.current?.click()
    } finally {
      setCarregando(false)
    }
  }

  const capturar = () => {
    const v = videoRef.current
    // HAVE_CURRENT_DATA (2) = já existe frame pra desenhar. Sem isso o
    // drawImage copia um quadro vazio e a selfie sai preta.
    if (!v || !v.videoWidth || v.readyState < 2) {
      setErro('A câmera ainda está abrindo. Tente de novo em 1 segundo.')
      return
    }
    const lado = Math.min(v.videoWidth, v.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = lado
    canvas.height = lado
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Recorta o quadrado central e espelha (selfie natural).
    const sx = (v.videoWidth - lado) / 2
    const sy = (v.videoHeight - lado) / 2
    ctx.translate(lado, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(v, sx, sy, lado, lado, 0, 0, lado, lado)
    onChange(canvas.toDataURL('image/jpeg', 0.85))
    pararCamera()
  }

  const onArquivo = (file: File | null) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setErro('Imagem maior que 5MB.'); return }
    const reader = new FileReader()
    reader.onload = () => onChange(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }

  const refazer = () => { onChange(null); setErro('') }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-2">
        <ShieldCheck size={14} className="shrink-0 mt-0.5 text-gray-400" />
        <span>{consentimento}</span>
      </div>

      {/* Foto já capturada */}
      {value ? (
        <div className="space-y-2">
          <div className="relative w-32 h-32 mx-auto rounded-2xl overflow-hidden border-2 border-violet-200 bg-gray-100">
            <Image src={value} alt="Selfie capturada" fill className="object-cover" unoptimized />
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={refazer}
              className="mx-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-violet-700"
            >
              <RefreshCw size={12} /> Tirar outra
            </button>
          )}
        </div>
      ) : camAtiva ? (
        <div className="space-y-2">
          <div className="relative w-full max-w-[280px] mx-auto aspect-square rounded-2xl overflow-hidden bg-black">
            {/* espelhado pra parecer espelho */}
            <video
              ref={videoRef}
              playsInline
              muted
              onLoadedData={() => setPronta(true)}
              onPlaying={() => setPronta(true)}
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {!pronta && (
              <div className="absolute inset-0 flex items-center justify-center text-white/80 text-xs gap-2">
                <Loader2 size={14} className="animate-spin" /> Preparando câmera…
              </div>
            )}
          </div>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={capturar}
              disabled={!pronta}
              className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
            >
              <Camera size={15} /> Capturar
            </button>
            <button
              type="button"
              onClick={pararCamera}
              className="text-sm text-gray-500 hover:text-gray-700 px-3"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={abrirCamera}
          disabled={disabled || carregando}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-violet-200 hover:border-violet-400 hover:bg-violet-50 text-violet-700 text-sm font-semibold py-4 rounded-xl disabled:opacity-50"
        >
          {carregando ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          Tirar selfie
        </button>
      )}

      {/* Fallback de upload (câmera nativa do celular via capture) */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={e => { onArquivo(e.target.files?.[0] ?? null); e.target.value = '' }}
      />

      {erro && (
        <p className="text-xs text-amber-700 flex items-start gap-1.5">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {erro}
        </p>
      )}
    </div>
  )
}
