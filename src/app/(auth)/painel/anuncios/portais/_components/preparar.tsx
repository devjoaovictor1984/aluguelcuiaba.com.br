'use client'

import { useState } from 'react'
import { Download, ExternalLink, Copy, Check, ClipboardCheck } from 'lucide-react'

/**
 * Deixa tudo pronto ANTES de ter o Canal Pro:
 * 1. baixar o arquivo e testar no validador oficial (não precisa de plano);
 * 2. mensagem pronta pra mandar ao Canal Pro quando contratar.
 */
export function Preparar({ prontos, ligados, url, nome }: {
  prontos: number; ligados: number; url: string | null; nome: string
}) {
  const [copiado, setCopiado] = useState(false)

  const mensagem = [
    'Olá! Quero integrar meus anúncios de aluguel por feed XML no padrão VRSync.',
    '',
    `Anunciante: ${nome}`,
    `URL do feed: ${url ?? '(gerar a URL na tela Portais)'}`,
    '',
    'O feed é atualizado automaticamente pelo meu sistema (AluguelCuiabá).',
    'Podem ativar a leitura e me enviar o relatório de integração?',
  ].join('\n')

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagem)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* sem clipboard: o texto fica visível para copiar à mão */ }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-5 grid gap-5 sm:grid-cols-2">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <ClipboardCheck size={15} className="text-violet-600" /> Testar sem plano
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Baixe o arquivo que o portal vai ler e envie no validador oficial do Grupo OLX. Não precisa de
          conta no Canal Pro. Se der erro, mande a mensagem ao suporte do site.
        </p>
        <p className="text-xs text-gray-600 mt-2">
          <strong>{prontos}</strong> anúncio{prontos === 1 ? '' : 's'} pronto{prontos === 1 ? '' : 's'} para os portais
          {' · '}<strong>{ligados}</strong> ligado{ligados === 1 ? '' : 's'}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <a
            href={`/painel/anuncios/portais/arquivo-teste${ligados === 0 ? '?todos=1' : ''}`}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg ${prontos === 0 ? 'pointer-events-none bg-gray-100 text-gray-400' : 'text-white bg-violet-700 hover:bg-violet-800'}`}
            aria-disabled={prontos === 0}
          >
            <Download size={13} /> Baixar arquivo de teste
          </a>
          <a
            href="https://developers.grupozap.com/feeds/xml_validator/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-lg"
          >
            Abrir validador <ExternalLink size={12} />
          </a>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          {prontos === 0
            ? 'Nenhum anúncio passa nas regras ainda: veja o que está em vermelho na lista abaixo.'
            : ligados === 0
              ? 'Nenhum ligado ainda: o arquivo leva todos os prontos, só para testar.'
              : 'O arquivo leva só os ligados, igual ao que o portal vê.'}
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-900">Mensagem para o Canal Pro</h2>
        <p className="text-xs text-gray-500 mt-1">
          Quando contratar o plano, mande ao gerente ou ao suporte do Canal Pro.
        </p>
        <pre className="mt-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-gray-700 max-h-40 overflow-auto">{mensagem}</pre>
        <button
          type="button"
          onClick={copiar}
          disabled={!url}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-lg disabled:opacity-50"
        >
          {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? 'Copiado' : url ? 'Copiar mensagem' : 'Gere a URL primeiro'}
        </button>
      </div>
    </section>
  )
}
