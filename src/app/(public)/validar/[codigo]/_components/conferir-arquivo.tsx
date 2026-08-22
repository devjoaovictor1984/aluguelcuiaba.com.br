'use client'

import { useState } from 'react'
import { FileCheck2, FileX2, Loader2, Upload } from 'lucide-react'

/**
 * Confere o PDF que a pessoa tem em mãos contra o hash da via congelada.
 *
 * O arquivo NÃO é enviado pra lugar nenhum: o SHA-256 é calculado no próprio
 * navegador (WebCrypto) e só o resultado da comparação aparece na tela. Isso
 * importa porque quem confere costuma ser terceiro — cartório, banco — e o
 * contrato tem dado pessoal das partes.
 */
export function ConferirArquivo({ hashEsperado }: { hashEsperado: string }) {
  const [estado, setEstado] = useState<'parado' | 'lendo' | 'confere' | 'difere'>('parado')
  const [hashLido, setHashLido] = useState('')

  const conferir = async (arquivo: File | undefined) => {
    if (!arquivo) return
    setEstado('lendo')
    try {
      const buf = await arquivo.arrayBuffer()
      const digest = await crypto.subtle.digest('SHA-256', buf)
      const hex = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      setHashLido(hex)
      setEstado(hex === hashEsperado ? 'confere' : 'difere')
    } catch {
      setEstado('difere')
      setHashLido('')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">Conferir o arquivo que você recebeu</h2>
      <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
        Selecione o PDF do contrato assinado. A conferência acontece no seu próprio
        navegador — o arquivo não é enviado para nenhum servidor.
      </p>

      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-violet-300 rounded-xl px-4 py-5 cursor-pointer text-sm text-gray-500 hover:text-violet-700 transition-colors">
        {estado === 'lendo' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {estado === 'lendo' ? 'Conferindo…' : 'Escolher o PDF'}
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={e => conferir(e.target.files?.[0])}
        />
      </label>

      {estado === 'confere' && (
        <div className="mt-3 flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
          <FileCheck2 size={16} className="text-green-600 shrink-0 mt-0.5" />
          <div className="text-xs text-green-800">
            <strong>Confere.</strong> Este arquivo é idêntico, byte a byte, à via assinada
            registrada aqui. Não foi alterado depois da assinatura.
          </div>
        </div>
      )}

      {estado === 'difere' && (
        <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
          <FileX2 size={16} className="text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-800">
            <strong>Não confere.</strong> Este arquivo é diferente da via registrada. Pode ser
            outro documento, uma cópia impressa e digitalizada de novo, um PDF reexportado por
            outro programa — ou uma alteração. Peça a via original a quem enviou.
            {hashLido && (
              <div className="font-mono text-[10px] mt-1.5 break-all text-red-700">
                deste arquivo: {hashLido}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
