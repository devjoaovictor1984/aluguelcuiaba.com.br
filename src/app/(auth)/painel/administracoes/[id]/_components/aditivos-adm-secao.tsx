'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FilePlus2, Plus, Trash2, Loader2, X, FileText, Download } from 'lucide-react'
import { criarAditivoAdm, excluirAditivoAdm, type TipoAditivoAdm } from '../actions-aditivos-adm'

export interface AditivoAdmRow {
  id: string
  numero: number
  data_aditivo: string
  tipo: string
  titulo: string | null
  objeto: string
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"

const TIPOS: Array<{ valor: TipoAditivoAdm; label: string; modelo: string }> = [
  { valor: 'taxa', label: 'Alteração da taxa de administração', modelo: 'Fica alterada a taxa de administração de ___ para ___, a partir de ___.' },
  { valor: 'prorrogacao', label: 'Prorrogação de prazo', modelo: 'Fica prorrogado o prazo do contrato de administração por mais ___ meses, passando o término para ___, mantidas as demais condições.' },
  { valor: 'exclusividade', label: 'Alteração de exclusividade', modelo: 'Fica alterado o regime de exclusividade para ___, a partir de ___.' },
  { valor: 'repasse', label: 'Alteração de repasse', modelo: 'Fica alterada a forma/data de repasse de ___ para ___.' },
  { valor: 'clausula', label: 'Inclusão / alteração de cláusula', modelo: 'Fica incluída/alterada a seguinte disposição: ___.' },
  { valor: 'outro', label: 'Outro', modelo: '' },
]

const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS.map(t => [t.valor, t.label]))

function fmtData(d: string): string {
  const s = d.slice(0, 10)
  const [y, m, dd] = s.split('-')
  return `${dd}/${m}/${y}`
}

export function AditivosAdmSecao({ contratoId, aditivos }: { contratoId: string; aditivos: AditivoAdmRow[] }) {
  const router = useRouter()
  const [modalAberto, setModalAberto] = useState(false)
  const [tipo, setTipo] = useState<TipoAditivoAdm>('taxa')
  const [titulo, setTitulo] = useState('')
  const [dataAditivo, setDataAditivo] = useState(() => new Date().toISOString().slice(0, 10))
  const [objeto, setObjeto] = useState('')
  const [erro, setErro] = useState('')
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const proximoNumero = aditivos.length + 1

  const escolherTipo = (t: TipoAditivoAdm) => {
    setTipo(t)
    const modelo = TIPOS.find(x => x.valor === t)?.modelo ?? ''
    if (!objeto.trim()) setObjeto(modelo)
  }

  const limpar = () => {
    setTipo('taxa'); setTitulo(''); setObjeto(''); setErro('')
    setDataAditivo(new Date().toISOString().slice(0, 10))
  }

  const criar = () => {
    setErro('')
    if (!objeto.trim()) { setErro('Descreva o que está sendo aditado.'); return }
    startTransition(async () => {
      const r = await criarAditivoAdm({ contrato_id: contratoId, tipo, titulo, data_aditivo: dataAditivo, objeto })
      if (r.error) { setErro(r.error); return }
      limpar()
      setModalAberto(false)
      router.refresh()
      if (r.id) window.open(`/api/contratos-admin/aditivos/${r.id}/pdf`, '_blank')
    })
  }

  const remover = (id: string) => {
    if (!confirm('Excluir este termo aditivo? Esta ação não pode ser desfeita.')) return
    setRemovendo(id)
    startTransition(async () => {
      const r = await excluirAditivoAdm(id, contratoId)
      setRemovendo(null)
      if (r.error) { alert(r.error); return }
      router.refresh()
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <FilePlus2 size={14} className="text-violet-600" />
          Termos aditivos
          <span className="text-xs font-normal text-gray-400">({aditivos.length})</span>
        </h2>
        <button
          type="button"
          onClick={() => { limpar(); escolherTipo('taxa'); setModalAberto(true) }}
          className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-800 border border-violet-200 hover:bg-violet-50 px-2.5 py-1 rounded-lg transition-colors"
        >
          <Plus size={12} /> Novo aditivo
        </button>
      </div>

      {aditivos.length === 0 ? (
        <p className="text-xs text-gray-400">
          Nenhum aditivo. Use depois que o contrato de administração já está assinado e algo precisa mudar —
          alteração de taxa, prorrogação de prazo, mudança de exclusividade ou inclusão de cláusula. Gera um PDF
          próprio que referencia o contrato e é assinado pela administradora e proprietária.
        </p>
      ) : (
        <ul className="space-y-2">
          {aditivos.map(a => (
            <li key={a.id} className="flex items-start justify-between gap-2 border border-gray-100 rounded-xl p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold">{a.numero}º aditivo</span>
                  {a.titulo?.trim() || TIPO_LABEL[a.tipo] || 'Aditamento'}
                  <span className="text-[11px] font-normal text-gray-400">· {fmtData(a.data_aditivo)}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2 whitespace-pre-wrap">{a.objeto}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={`/api/contratos-admin/aditivos/${a.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-violet-700 hover:bg-violet-50 px-2 py-1.5 rounded-lg"
                  title="Abrir PDF do aditivo"
                >
                  <FileText size={13} /> PDF
                </a>
                <button
                  type="button"
                  onClick={() => remover(a.id)}
                  disabled={isPending}
                  className="text-gray-300 hover:text-rose-600 p-1.5 disabled:opacity-50"
                  title="Excluir aditivo"
                >
                  {removendo === a.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isPending && setModalAberto(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FilePlus2 size={16} className="text-violet-600" /> {proximoNumero}º Termo aditivo
              </h2>
              <button type="button" onClick={() => setModalAberto(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X size={16} />
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mb-3">
              Vincula ao contrato de administração e gera um PDF assinável. As demais cláusulas permanecem inalteradas.
            </p>

            <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
            <select value={tipo} onChange={e => escolherTipo(e.target.value as TipoAditivoAdm)} className={`${inputCls} mb-3`}>
              {TIPOS.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data do aditivo</label>
                <input type="date" value={dataAditivo} onChange={e => setDataAditivo(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Título (opcional)</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Nova taxa 2027" className={inputCls} />
              </div>
            </div>

            <label className="block text-xs font-semibold text-gray-600 mb-1">O que está sendo aditado *</label>
            <textarea
              value={objeto}
              onChange={e => setObjeto(e.target.value)}
              rows={7}
              placeholder="Descreva a alteração. Deixe uma linha em branco entre parágrafos — cada um vira um item numerado (1.1, 1.2…) no PDF."
              className={`${inputCls} resize-y`}
            />

            {erro && <p className="text-xs text-rose-600 mt-2">{erro}</p>}

            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setModalAberto(false)} disabled={isPending} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancelar
              </button>
              <button type="button" onClick={criar} disabled={isPending || !objeto.trim()} className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Criar e gerar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
