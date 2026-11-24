'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Link2, FileUp, Loader2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { importarDeUrl, importarArquivoEnviado, pedirEnvioArquivo } from '../actions'

/**
 * Começa uma importação: cola a URL do XML (o que o sistema da imobiliária
 * manda para o ZAP) ou envia o arquivo. Nada é criado aqui — sai uma prévia.
 * `alvoUserId`: o admin importando para outra conta.
 */
export function NovaImportacao({ alvoUserId, desabilitado }: { alvoUserId?: string | null; desabilitado?: string | null }) {
  const router = useRouter()
  const [modo, setModo] = useState<'url' | 'arquivo'>('url')
  const [url, setUrl] = useState('')
  const [nome, setNome] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [etapa, setEtapa] = useState('')
  const [erro, setErro] = useState('')
  const inputArquivo = useRef<HTMLInputElement>(null)
  const ocupado = !!etapa

  const irPara = (id: string) => router.push(`/painel/anuncios/importar/${id}`)

  async function enviarUrl(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!/^https?:\/\//i.test(url.trim())) { setErro('Cole a URL completa, começando com https://'); return }
    setEtapa('Baixando e lendo o XML… (arquivo grande pode levar alguns minutos)')
    try {
      const r = await importarDeUrl({ url, nome, salvarFonte: true, alvoUserId })
      if (r.id) return irPara(r.id)
      setErro(r.error ?? 'Não deu certo.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha de conexão. Tente de novo.')
    } finally {
      setEtapa('')
    }
  }

  async function enviarArquivo(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!arquivo) { setErro('Escolha o arquivo .xml'); return }
    try {
      setEtapa('Preparando o envio…')
      const p = await pedirEnvioArquivo({ nome: arquivo.name, tamanho: arquivo.size, alvoUserId })
      if (p.error || !p.path || !p.token) { setErro(p.error ?? 'Falha ao preparar o envio'); return }

      setEtapa(`Enviando ${(arquivo.size / 1048576).toFixed(1)} MB…`)
      const { error: eu } = await createClient().storage.from('importacoes')
        .uploadToSignedUrl(p.path, p.token, arquivo, { contentType: arquivo.type || 'application/xml' })
      if (eu) { setErro(`Falha ao enviar: ${eu.message}`); return }

      setEtapa('Lendo o XML…')
      const r = await importarArquivoEnviado({ path: p.path, nome: arquivo.name, alvoUserId })
      if (r.id) return irPara(r.id)
      setErro(r.error ?? 'Não deu certo.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha de conexão. Tente de novo.')
    } finally {
      setEtapa('')
    }
  }

  const aba = (m: 'url' | 'arquivo', icone: React.ReactNode, rotulo: string) => (
    <button
      type="button"
      onClick={() => { setModo(m); setErro('') }}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${modo === m ? 'bg-violet-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {icone} {rotulo}
    </button>
  )

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">Nova importação</h2>
      <p className="text-xs text-gray-500 mb-3">
        Primeiro sai uma <strong>prévia</strong>: quantos imóveis vêm, o que fica de fora e por quê. Nada é criado até você confirmar.
      </p>

      {desabilitado ? (
        <p className="text-sm text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-xl px-4 py-3">{desabilitado}</p>
      ) : (
        <>
          <div className="flex gap-1 mb-4" role="tablist">
            {aba('url', <Link2 size={15} />, 'Pela URL')}
            {aba('arquivo', <FileUp size={15} />, 'Enviar arquivo')}
          </div>

          {modo === 'url' ? (
            <form onSubmit={enviarUrl} className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">URL do XML</span>
                <input
                  type="url" inputMode="url" required value={url} onChange={e => setUrl(e.target.value)} disabled={ocupado}
                  placeholder="https://sistema-da-imobiliaria.com.br/feed/zap.xml"
                  className="mt-1 w-full font-mono text-xs border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <span className="block text-[11px] text-gray-400 mt-1">
                  É a mesma URL que o sistema da imobiliária cadastra no Canal Pro (ZAP / Viva Real / OLX). Fica salva para importar de novo.
                </span>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Nome (opcional)</span>
                <input
                  type="text" value={nome} onChange={e => setNome(e.target.value)} disabled={ocupado} maxLength={120}
                  placeholder="Ex.: Sistema da Imobiliária X"
                  className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </label>
              <Botao ocupado={ocupado} texto="Analisar URL" />
            </form>
          ) : (
            <form onSubmit={enviarArquivo} className="space-y-3">
              <button
                type="button" onClick={() => inputArquivo.current?.click()} disabled={ocupado}
                className="w-full border-2 border-dashed border-gray-200 hover:border-violet-400 rounded-xl px-4 py-6 text-sm text-gray-500 text-center transition-colors"
              >
                {arquivo ? <><strong className="text-gray-800">{arquivo.name}</strong> · {(arquivo.size / 1048576).toFixed(1)} MB</> : 'Escolher o arquivo .xml (até 80 MB)'}
              </button>
              <input
                ref={inputArquivo} type="file" accept=".xml,.gz,text/xml,application/xml,application/gzip" className="hidden"
                onChange={e => setArquivo(e.target.files?.[0] ?? null)}
              />
              <Botao ocupado={ocupado} texto="Enviar e analisar" />
            </form>
          )}

          {etapa && (
            <p className="flex items-center gap-2 text-xs text-violet-700 mt-3" role="status">
              <Loader2 size={14} className="animate-spin" /> {etapa}
            </p>
          )}
          {erro && (
            <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-xl px-3 py-2 mt-3" role="alert">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {erro}
            </p>
          )}
        </>
      )}
    </section>
  )
}

function Botao({ ocupado, texto }: { ocupado: boolean; texto: string }) {
  return (
    <button
      type="submit" disabled={ocupado}
      className="inline-flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
    >
      {ocupado && <Loader2 size={15} className="animate-spin" />} {texto}
    </button>
  )
}
