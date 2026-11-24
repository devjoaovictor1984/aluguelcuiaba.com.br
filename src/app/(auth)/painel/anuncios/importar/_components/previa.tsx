'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Play, RefreshCw, X, MapPin, AlertTriangle } from 'lucide-react'
import type { ResumoAnalise } from '@/lib/importacao/motor'
import { cancelar, comecarImportacao, reanalisar, salvarBairros } from '../actions'

type Bairro = { id: string; nome: string }

/** A prévia da análise: números, bairros sem par, opções e o botão de importar. */
export function Previa({ id, status, resumo, bairros, admin, deUrl }: {
  id: string; status: string; resumo: ResumoAnalise | null; bairros: Bairro[]; admin: boolean; deUrl: boolean
}) {
  const router = useRouter()
  const [pendente, start] = useTransition()
  const [erro, setErro] = useState('')
  const [escolhas, setEscolhas] = useState<Record<string, string>>({})
  const [op, setOp] = useState({
    publicar: false, atualizarExistentes: true, sobrescreverEdicoes: false,
    trazerDescartados: false, pausarAusentes: false, ignorarLimitePlano: false,
  })
  const ordenados = useMemo(() => [...bairros].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [bairros])

  const rodar = (f: () => Promise<{ error?: string }>) => start(async () => {
    setErro('')
    try {
      const r = await f()
      if (r.error) setErro(r.error)
    } catch {
      setErro('Falha de conexão. Tente de novo.')
    }
    router.refresh()
  })

  if (status === 'erro') {
    return (
      <div className="flex gap-2 mb-5">
        {deUrl && (
          <button onClick={() => rodar(() => reanalisar(id))} disabled={pendente} className="inline-flex items-center gap-1.5 bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-60">
            {pendente ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Tentar de novo
          </button>
        )}
        {erro && <p className="text-sm text-red-700">{erro}</p>}
      </div>
    )
  }
  if (!resumo) return null

  const vaoEntrar = resumo.novos + resumo.ja_importados + (op.trazerDescartados ? resumo.descartados : 0)
  const semPar = resumo.bairros_sem_par ?? []
  const motivos = Object.entries(resumo.motivos ?? {}).sort((a, b) => b[1] - a[1])

  const salvar = () => rodar(() => salvarBairros(id, Object.entries(escolhas).filter(([, v]) => v).map(([nome, bairroId]) => ({ nome, bairroId }))))
  const checar = (k: keyof typeof op, rotulo: React.ReactNode, ajuda?: string) => (
    <label className="flex items-start gap-2 text-sm text-gray-700">
      <input type="checkbox" checked={op[k]} onChange={e => setOp(o => ({ ...o, [k]: e.target.checked }))} className="mt-1 accent-violet-700" />
      <span>{rotulo}{ajuda && <span className="block text-[11px] text-gray-400">{ajuda}</span>}</span>
    </label>
  )

  return (
    <div className="space-y-5 mb-6">
      {/* Números */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Numero valor={resumo.no_arquivo} rotulo="no arquivo" />
        <Numero valor={resumo.novos} rotulo="novos" cor="text-green-700" />
        <Numero valor={resumo.ja_importados} rotulo="já importados (atualiza)" cor="text-violet-700" />
        <Numero valor={resumo.ignorados} rotulo="ficam de fora" cor="text-gray-500" />
      </section>

      {resumo.no_arquivo === 0 && (
        <p className="text-sm text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-xl px-4 py-3">
          O arquivo foi lido, mas não tem nenhum imóvel. Confira se a URL é a do feed completo.
        </p>
      )}

      {(motivos.length > 0 || resumo.duplicados_no_arquivo > 0) && (
        <section className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Por que alguns ficam de fora</h2>
          <ul className="text-sm text-gray-600 space-y-1">
            {motivos.map(([m, n]) => <li key={m} className="flex justify-between gap-3"><span>{m}</span><span className="tabular-nums text-gray-900">{n}</span></li>)}
            {resumo.duplicados_no_arquivo > 0 && (
              <li className="flex justify-between gap-3"><span>Código repetido no próprio arquivo (fica o primeiro)</span><span className="tabular-nums text-gray-900">{resumo.duplicados_no_arquivo}</span></li>
            )}
          </ul>
        </section>
      )}

      {(resumo.sem_fotos > 0 || resumo.com_avisos > 0 || resumo.ausentes > 0) && (
        <section className="bg-amber-50/60 ring-1 ring-amber-100 rounded-2xl p-4 text-sm text-amber-900 space-y-1">
          {resumo.com_avisos > 0 && <p>{resumo.com_avisos} imóve{resumo.com_avisos === 1 ? 'l tem' : 'is têm'} algo para completar depois (CEP, área, tipo…). Veja na lista abaixo.</p>}
          {resumo.sem_fotos > 0 && <p>{resumo.sem_fotos} sem nenhuma foto no arquivo: entram como rascunho.</p>}
          {resumo.ausentes > 0 && <p>{resumo.ausentes} anúncio{resumo.ausentes === 1 ? '' : 's'} importado{resumo.ausentes === 1 ? '' : 's'} antes e no ar <strong>não está{resumo.ausentes === 1 ? '' : 'ão'} mais neste arquivo</strong>. No fim você escolhe se pausa.</p>}
        </section>
      )}

      {/* Bairros sem par */}
      {semPar.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><MapPin size={15} className="text-violet-600" /> Bairros que não reconhecemos</h2>
          <p className="text-xs text-gray-500 mb-3">
            Escolha o bairro daqui para cada nome. Fica salvo para as próximas importações. Sem escolher, o imóvel entra como rascunho sem bairro.
          </p>
          <ul className="space-y-2">
            {semPar.map(b => (
              <li key={b.nome} className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-800 min-w-40">{b.nome} <span className="text-gray-400 text-xs">({b.qtd})</span></span>
                <select
                  value={escolhas[b.nome] ?? ''}
                  onChange={e => setEscolhas(s => ({ ...s, [b.nome]: e.target.value }))}
                  className="flex-1 min-w-48 text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                  aria-label={`Bairro para ${b.nome}`}
                >
                  <option value="">— escolher —</option>
                  {ordenados.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </li>
            ))}
          </ul>
          <button onClick={salvar} disabled={pendente || !Object.values(escolhas).some(Boolean)} className="mt-3 text-sm font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 disabled:opacity-50 px-3 py-2 rounded-lg">
            Salvar bairros
          </button>
        </section>
      )}

      {/* Opções */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Como importar</h2>
        {checar('publicar', <>Já <strong>publicar</strong> os que estiverem completos</>, 'Completo = bairro, valor, WhatsApp e ao menos 1 foto. Respeita o limite de anúncios do plano; o resto fica como rascunho.')}
        {resumo.ja_importados > 0 && checar('atualizarExistentes', <>Atualizar os <strong>{resumo.ja_importados}</strong> que já vieram antes</>, 'Preço, texto, fotos… O que você mudou aqui depois de importar fica como está.')}
        {resumo.ja_importados > 0 && op.atualizarExistentes && checar('sobrescreverEdicoes', <>Sobrescrever também o que <strong>eu editei aqui</strong></>, 'O sistema de origem passa a mandar em tudo.')}
        {resumo.descartados > 0 && checar('trazerDescartados', <>Trazer de volta os <strong>{resumo.descartados}</strong> que eu apaguei aqui</>)}
        {admin && checar('ignorarLimitePlano', <>Admin: publicar <strong>sem</strong> o limite do plano</>)}
      </section>

      {erro && (
        <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-xl px-3 py-2" role="alert">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {erro}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => rodar(() => comecarImportacao(id, op))}
          disabled={pendente || vaoEntrar === 0}
          className="inline-flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-3 rounded-xl"
        >
          {pendente ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Importar {vaoEntrar} imóve{vaoEntrar === 1 ? 'l' : 'is'}
        </button>
        {deUrl && (
          <button onClick={() => rodar(() => reanalisar(id))} disabled={pendente} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:bg-gray-100 px-3 py-3 rounded-xl">
            <RefreshCw size={15} /> Ler a URL de novo
          </button>
        )}
        <button onClick={() => rodar(() => cancelar(id))} disabled={pendente} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:bg-gray-100 px-3 py-3 rounded-xl">
          <X size={15} /> Descartar
        </button>
      </div>
    </div>
  )
}

function Numero({ valor, rotulo, cor = 'text-gray-900' }: { valor: number; rotulo: string; cor?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3">
      <p className={`text-2xl font-bold tabular-nums ${cor}`}>{valor ?? 0}</p>
      <p className="text-[11px] text-gray-500">{rotulo}</p>
    </div>
  )
}
