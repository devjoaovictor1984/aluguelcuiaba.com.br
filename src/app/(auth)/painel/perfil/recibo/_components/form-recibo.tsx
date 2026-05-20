'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Upload, Trash2, Loader2, Save, Check, FileText, PenLine, Image as ImageIcon,
} from 'lucide-react'
import {
  uploadArquivoRecibo, removerArquivoRecibo, salvarConfigRecibo,
  type ArquivoRecibo,
} from '../../actions-recibo'

interface Props {
  perfilNome: string | null
  recibo_logo_url: string | null
  recibo_emitente_nome: string | null
  recibo_assinatura_url: string | null
  recibo_mostrar_linha: boolean
  recibo_assinatura_sobre_linha: boolean
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"

export function FormRecibo(props: Props) {
  const router = useRouter()
  const [logoUrl, setLogoUrl] = useState(props.recibo_logo_url)
  const [assinaturaUrl, setAssinaturaUrl] = useState(props.recibo_assinatura_url)
  const [emitenteNome, setEmitenteNome] = useState(props.recibo_emitente_nome ?? '')
  const [mostrarLinha, setMostrarLinha] = useState(props.recibo_mostrar_linha)
  const [sobreLinha, setSobreLinha] = useState(props.recibo_assinatura_sobre_linha)

  const [salvoEm, setSalvoEm] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const nomeFinal = emitenteNome.trim() || props.perfilNome || 'AluguelCuiabá'

  const salvar = () => {
    setErro('')
    startTransition(async () => {
      const r = await salvarConfigRecibo({
        recibo_emitente_nome: emitenteNome.trim() || null,
        recibo_mostrar_linha: mostrarLinha,
        recibo_assinatura_sobre_linha: sobreLinha,
      })
      if (r.error) { setErro(r.error); return }
      setSalvoEm(new Date().toLocaleTimeString('pt-BR'))
      router.refresh()
    })
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-5">
      {/* Coluna esquerda: configurações */}
      <div className="space-y-4">
        <UploadBox
          tipo="logo"
          icone={<ImageIcon size={16} />}
          titulo="Logo do recibo"
          descricao="Aparece no cabeçalho do PDF. Recomendado: 300×100px, fundo transparente."
          url={logoUrl}
          onTrocar={url => setLogoUrl(url)}
        />

        <UploadBox
          tipo="assinatura"
          icone={<PenLine size={16} />}
          titulo="Imagem da assinatura"
          descricao="PNG transparente da sua assinatura. Recomendado: 400×150px."
          url={assinaturaUrl}
          onTrocar={url => setAssinaturaUrl(url)}
        />

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Nome para assinatura</h2>
            <input
              type="text"
              value={emitenteNome}
              onChange={e => setEmitenteNome(e.target.value)}
              placeholder={props.perfilNome ?? 'Seu nome'}
              className={inputCls}
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Aparece embaixo da linha de assinatura. Em branco usa o nome do seu perfil ({props.perfilNome ?? '—'}).
            </p>
          </div>

          <div className="space-y-2 pt-3 border-t border-gray-50">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={mostrarLinha}
                onChange={e => setMostrarLinha(e.target.checked)}
                className="w-4 h-4 accent-violet-600"
              />
              <span className="text-sm text-gray-700">Mostrar linha de assinatura no recibo</span>
            </label>
            {mostrarLinha && (
              <p className="text-[11px] text-gray-400 ml-6">
                Layout: assinatura PNG aparece acima da linha com um espaço, e o nome embaixo. Limpo e profissional.
              </p>
            )}
            {!mostrarLinha && (
              <p className="text-[11px] text-gray-400 ml-6">
                Sem linha — o recibo fica em branco no lugar da assinatura (válido como recibo digital).
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-50">
            <div className="text-xs text-gray-400">
              {salvoEm && <span className="text-green-700 flex items-center gap-1"><Check size={12} /> Salvo às {salvoEm}</span>}
              {erro && <span className="text-red-600">{erro}</span>}
            </div>
            <button
              type="button"
              onClick={salvar}
              disabled={isPending}
              className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar
            </button>
          </div>
        </section>
      </div>

      {/* Coluna direita: preview */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1">
            <FileText size={12} /> Preview do recibo
          </h3>
          <PreviewRecibo
            logoUrl={logoUrl}
            assinaturaUrl={assinaturaUrl}
            mostrarLinha={mostrarLinha}
            nomeAssinatura={nomeFinal}
          />
          <p className="text-[10px] text-gray-400 mt-3 text-center">
            Esboço aproximado. O PDF final tem layout A4 completo.
          </p>
        </div>
      </aside>
    </div>
  )
}

function UploadBox({
  tipo, icone, titulo, descricao, url, onTrocar,
}: {
  tipo: ArquivoRecibo
  icone: React.ReactNode
  titulo: string
  descricao: string
  url: string | null
  onTrocar: (url: string | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()

  const escolher = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErro('')
    setEnviando(true)

    const fd = new FormData()
    fd.set('tipo', tipo)
    fd.set('file', file)
    const r = await uploadArquivoRecibo(fd)
    setEnviando(false)
    if (r.error) { setErro(r.error); return }
    if (r.url) onTrocar(r.url)
    router.refresh()
  }

  const remover = async () => {
    if (!confirm(`Remover ${titulo.toLowerCase()}?`)) return
    setEnviando(true)
    const r = await removerArquivoRecibo(tipo)
    setEnviando(false)
    if (r.error) { setErro(r.error); return }
    onTrocar(null)
    router.refresh()
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
          {icone}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-700">{titulo}</h2>
          <p className="text-xs text-gray-500">{descricao}</p>
        </div>
      </div>

      {url ? (
        <div className="flex items-center gap-3">
          <div className="relative w-32 h-20 bg-gray-50 border border-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
            <Image src={url} alt={titulo} fill className="object-contain p-2" unoptimized />
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={enviando}
              className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-800 border border-violet-200 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              {enviando ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Trocar
            </button>
            <button
              type="button"
              onClick={remover}
              disabled={enviando}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 size={12} /> Remover
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={enviando}
          className="w-full border-2 border-dashed border-gray-200 hover:border-violet-300 hover:bg-violet-50/40 rounded-xl px-3 py-5 text-center transition-colors"
        >
          {enviando ? (
            <Loader2 size={18} className="mx-auto text-violet-500 animate-spin" />
          ) : (
            <>
              <Upload size={18} className="mx-auto text-gray-400 mb-1" />
              <p className="text-xs text-gray-600 font-medium">Clique para enviar</p>
              <p className="text-[11px] text-gray-400">JPG, PNG ou WEBP · até 3MB</p>
            </>
          )}
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={escolher}
        className="hidden"
      />
      {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}
    </section>
  )
}

function PreviewRecibo({
  logoUrl, assinaturaUrl, mostrarLinha, nomeAssinatura,
}: {
  logoUrl: string | null
  assinaturaUrl: string | null
  mostrarLinha: boolean
  nomeAssinatura: string
}) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-3 aspect-[210/297] text-[9px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b-2 border-violet-600 mb-3">
        <div className="flex-1">
          {logoUrl ? (
            <div className="relative h-6 w-20">
              <Image src={logoUrl} alt="logo" fill className="object-contain object-left" unoptimized />
            </div>
          ) : (
            <div className="text-gray-300 text-[8px] italic">[sem logo]</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[6px] text-violet-700 font-bold tracking-wider">RECIBO Nº</div>
          <div className="text-base font-bold text-gray-900 leading-none">0001</div>
        </div>
      </div>

      <div className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-700 mb-3">
        Recibo de Aluguel
      </div>

      <div className="bg-violet-50 rounded p-2 text-center mb-3">
        <div className="text-[6px] text-violet-700 font-bold tracking-wider">VALOR RECEBIDO</div>
        <div className="text-lg font-bold text-violet-700 leading-tight">R$ 1.900,00</div>
        <div className="text-[7px] italic text-gray-500">um mil e novecentos reais</div>
      </div>

      <div className="text-gray-500 text-[8px] leading-relaxed mb-3">
        Recebi de <strong className="text-gray-900">João da Silva</strong>, CPF ..., a importância de R$ 1.900,00 referente ao aluguel do mês de ...
      </div>

      {/* Tabela mock */}
      <div className="border border-gray-200 rounded mb-3">
        <div className="flex justify-between px-1.5 py-1 bg-gray-50 border-b border-gray-200 text-[6px] font-bold text-gray-500 uppercase">
          <span>Descrição</span><span>Valor</span>
        </div>
        <div className="flex justify-between px-1.5 py-1 text-[7px] text-gray-700">
          <span>Aluguel</span><span>R$ 1.900,00</span>
        </div>
      </div>

      {/* Assinatura — assinatura PNG acima, espaço, linha embaixo */}
      <div className="mt-auto pt-4">
        <div className="flex justify-center">
          <div className="w-3/5">
            {/* Imagem da assinatura — sempre acima da linha com espaço */}
            {assinaturaUrl && (
              <div className="relative h-7 mb-1.5">
                <Image src={assinaturaUrl} alt="assinatura" fill className="object-contain" unoptimized />
              </div>
            )}
            {/* Linha + nome (se ativada) */}
            {mostrarLinha ? (
              <div className="border-t border-gray-900 pt-0.5 text-center text-[7px] text-gray-700">
                {nomeAssinatura}
              </div>
            ) : assinaturaUrl ? (
              <div className="text-center text-[7px] text-gray-700">
                {nomeAssinatura}
              </div>
            ) : (
              <div className="text-center text-[7px] text-gray-300 italic">
                (sem linha de assinatura)
              </div>
            )}
          </div>
        </div>
        <div className="text-right text-[7px] text-gray-400 mt-3">
          Cuiabá, 17/05/2026
        </div>
      </div>
    </div>
  )
}
