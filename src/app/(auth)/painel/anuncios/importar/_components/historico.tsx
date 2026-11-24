import Link from 'next/link'

export interface LinhaHistorico {
  id: string
  origem: 'url' | 'arquivo'
  url: string | null
  arquivo_nome: string | null
  status: string
  resumo: { no_arquivo?: number; novos?: number; ja_importados?: number } | null
  total: number
  criado_em: string
  concluido_em: string | null
  automatica: boolean
  erro: string | null
}

export const ROTULO_STATUS: Record<string, { texto: string; cls: string }> = {
  analisando: { texto: 'Analisando', cls: 'text-blue-700 bg-blue-50' },
  pronta:     { texto: 'Prévia pronta', cls: 'text-violet-700 bg-violet-50' },
  importando: { texto: 'Importando', cls: 'text-amber-700 bg-amber-50' },
  concluida:  { texto: 'Concluída', cls: 'text-green-700 bg-green-50' },
  cancelada:  { texto: 'Cancelada', cls: 'text-gray-600 bg-gray-100' },
  erro:       { texto: 'Erro', cls: 'text-red-700 bg-red-50' },
}

export function HistoricoImportacoes({ linhas }: { linhas: LinhaHistorico[] }) {
  if (!linhas.length) return null
  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Histórico</h2>
      <ul className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
        {linhas.map(l => {
          const st = ROTULO_STATUS[l.status] ?? ROTULO_STATUS.erro
          const origem = l.origem === 'url' ? (l.url ?? '') : (l.arquivo_nome ?? 'Arquivo enviado')
          return (
            <li key={l.id}>
              <Link href={`/painel/anuncios/importar/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">{origem}</p>
                  <p className="text-[11px] text-gray-400">
                    {new Date(l.criado_em).toLocaleString('pt-BR')}
                    {l.automatica && ' · automática'}
                    {l.resumo?.no_arquivo != null && ` · ${l.resumo.no_arquivo} no arquivo, ${l.resumo.novos ?? 0} novos, ${l.resumo.ja_importados ?? 0} já importados`}
                  </p>
                  {l.erro && <p className="text-[11px] text-red-600 truncate">{l.erro}</p>}
                </div>
                <span className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full ${st.cls}`}>{st.texto}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
