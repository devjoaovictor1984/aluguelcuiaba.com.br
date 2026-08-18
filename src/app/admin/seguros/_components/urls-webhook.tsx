'use client'

import { useState } from 'react'
import { Copy, Check, Webhook, AlertTriangle } from 'lucide-react'

/**
 * As URLs de webhook, montadas com o segredo real do ambiente.
 *
 * Existe porque não havia como saber qual URL entregar. O segredo vive em
 * variável de ambiente marcada como sensível na Vercel — nem o admin
 * consegue lê-la pelo painel de lá —, e o valor de produção é diferente
 * do de desenvolvimento. Montar a URL "na mão" com o segredo local
 * produzia um endereço que responde 404 em produção, medido em 18/08.
 *
 * Quem renderiza é o servidor, que tem acesso à variável. A página é
 * admin-only, e o aviso abaixo existe porque a URL É a credencial: quem
 * a tiver pode postar avisos de mudança de análise.
 */
export function UrlsWebhook({ urls }: { urls: Array<{ evento: string; url: string }> }) {
  const [copiado, setCopiado] = useState<string | null>(null)

  const copiar = async (texto: string, chave: string) => {
    await navigator.clipboard.writeText(texto)
    setCopiado(chave)
    setTimeout(() => setCopiado(null), 1800)
  }

  const todas = urls.map(u => u.url).join('\n')

  return (
    <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4">
      <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
        <Webhook size={15} className="text-violet-600" /> URLs de webhook
      </h2>
      <p className="text-[11px] text-gray-500 mt-0.5 mb-3">
        É isto que a corretora precisa cadastrar do lado dela. As URLs abaixo
        já vêm com o segredo deste ambiente.
      </p>

      <div className="space-y-1.5">
        {urls.map(u => (
          <button
            key={u.evento}
            type="button"
            onClick={() => copiar(u.url, u.evento)}
            className="w-full flex items-center gap-2 rounded-xl ring-1 ring-gray-200 px-3 py-2.5 text-left hover:ring-violet-300"
          >
            {copiado === u.evento
              ? <Check size={13} className="text-emerald-600 shrink-0" />
              : <Copy size={13} className="text-gray-400 shrink-0" />}
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                {u.evento}
              </span>
              <code className="block text-[11px] text-gray-700 truncate">{u.url}</code>
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => copiar(todas, 'todas')}
        className="mt-2 w-full rounded-xl bg-violet-700 hover:bg-violet-800 px-3 py-2.5 text-xs font-bold text-white"
      >
        {copiado === 'todas' ? 'Copiadas' : 'Copiar as três'}
      </button>

      <p className="text-[11px] text-amber-900 bg-amber-50 rounded-lg px-3 py-2 mt-3 flex items-start gap-1.5 leading-snug">
        <AlertTriangle size={11} className="mt-0.5 shrink-0 text-amber-600" />
        <span>
          A URL <strong>é</strong> a credencial — quem a tiver pode nos enviar
          avisos de mudança de análise. Mande por canal privado ao contato
          técnico, nunca em grupo. (Mesmo assim não confiamos no corpo do
          aviso: reconsultamos tudo com o nosso token.)
        </span>
      </p>
    </section>
  )
}
