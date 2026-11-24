import Link from 'next/link'
import type { Problema } from '@/lib/importacao/mapear'

export interface LinhaItem {
  id: string
  codigo: string
  titulo: string | null
  bairro_origem: string | null
  acao: 'criar' | 'atualizar' | 'ignorar'
  motivo: string | null
  status: string
  problemas: Problema[] | null
  mensagem: string | null
  imovel_id: string | null
}

const ST: Record<string, { t: string; c: string }> = {
  pendente:    { t: 'Na fila', c: 'text-amber-700 bg-amber-50' },
  processando: { t: 'Processando', c: 'text-blue-700 bg-blue-50' },
  criado:      { t: 'Criado', c: 'text-green-700 bg-green-50' },
  atualizado:  { t: 'Atualizado', c: 'text-violet-700 bg-violet-50' },
  sem_mudanca: { t: 'Sem mudança', c: 'text-gray-600 bg-gray-100' },
  ignorado:    { t: 'De fora', c: 'text-gray-500 bg-gray-100' },
  erro:        { t: 'Erro', c: 'text-red-700 bg-red-50' },
}

const ROTULO_ACAO = { criar: 'novo', atualizar: 'já existe', ignorar: '' }

export function ListaItens({ id, filtro, itens, progresso, total }: {
  id: string
  filtro: string
  itens: LinhaItem[]
  progresso: { pendentes: number; criados: number; atualizados: number; sem_mudanca: number; ignorados: number; erros: number }
  total: number
}) {
  const abas: Array<[string, string, number]> = [
    ['todos', 'Todos', total],
    ['pendente', 'Na fila', progresso.pendentes],
    ['criado', 'Criados', progresso.criados],
    ['atualizado', 'Atualizados', progresso.atualizados],
    ['sem_mudanca', 'Sem mudança', progresso.sem_mudanca],
    ['ignorado', 'De fora', progresso.ignorados],
    ['erro', 'Erros', progresso.erros],
  ]
  return (
    <section>
      <nav className="flex gap-1 overflow-x-auto mb-2 -mx-1 px-1" aria-label="Filtrar imóveis">
        {abas.filter(([k, , n]) => k === 'todos' || n > 0 || k === filtro).map(([k, r, n]) => (
          <Link
            key={k}
            href={`/painel/anuncios/importar/${id}${k === 'todos' ? '' : `?ver=${k}`}`}
            scroll={false}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full ${filtro === k ? 'bg-violet-700 text-white' : 'bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {r} <span className="tabular-nums opacity-70">{n}</span>
          </Link>
        ))}
      </nav>

      {itens.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-2xl border border-gray-100 p-6 text-center">Nada aqui.</p>
      ) : (
        <ul className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {itens.map(i => {
            const st = ST[i.status] ?? ST.erro
            const avisos = (i.problemas ?? []).filter(p => p.nivel === 'aviso' || p.nivel === 'erro')
            return (
              <li key={i.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {i.imovel_id && ['criado', 'atualizado', 'sem_mudanca'].includes(i.status) ? (
                        <Link href={`/painel/anuncios/${i.imovel_id}/editar`} className="hover:text-violet-700 hover:underline">{i.titulo ?? '(sem título)'}</Link>
                      ) : (i.titulo ?? '(sem título)')}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      cód. {i.codigo}
                      {i.bairro_origem && ` · ${i.bairro_origem}`}
                      {ROTULO_ACAO[i.acao] && ` · ${ROTULO_ACAO[i.acao]}`}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.c}`}>{st.t}</span>
                </div>
                {(i.motivo || i.mensagem) && (
                  <p className={`text-xs mt-1 ${i.status === 'erro' ? 'text-red-700' : 'text-gray-600'}`}>{i.mensagem ?? i.motivo}</p>
                )}
                {avisos.length > 0 && i.acao !== 'ignorar' && (
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {avisos.map((a, k) => (
                      <li key={k} className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">{a.texto}</li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {itens.length === 300 && <p className="text-[11px] text-gray-400 mt-2">Mostrando os 300 primeiros. Use os filtros acima.</p>}
    </section>
  )
}
