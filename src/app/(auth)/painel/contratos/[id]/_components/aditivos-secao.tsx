'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FilePlus2, Plus, Trash2, Loader2, X, FileText, Download, Pencil, Users } from 'lucide-react'
import { criarAditivo, atualizarAditivo, excluirAditivo, type TipoAditivo } from '../actions-aditivos'
import type { PessoaOpcao } from './moradores-secao'

export interface AditivoRow {
  id: string
  numero: number
  data_aditivo: string
  tipo: string
  titulo: string | null
  objeto: string
  testemunha_ids: string[] | null
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"

const TIPOS: Array<{ valor: TipoAditivo; label: string; modelo: string }> = [
  { valor: 'reajuste', label: 'Reajuste de aluguel', modelo: 'Fica reajustado o valor do aluguel mensal de R$ ___ para R$ ___ (___), com base no índice ___ acumulado no período, a partir de ___.' },
  { valor: 'prorrogacao', label: 'Prorrogação de prazo', modelo: 'Fica prorrogado o prazo de locação por mais ___ meses, passando o término para ___, mantidas as demais condições.' },
  { valor: 'garantia', label: 'Alteração de garantia', modelo: 'Fica alterada a modalidade de garantia locatícia de ___ para ___, conforme ___.' },
  { valor: 'valor', label: 'Alteração de valor / encargos', modelo: 'Fica alterado o valor de ___ para R$ ___ (___), a partir de ___.' },
  { valor: 'clausula', label: 'Inclusão / alteração de cláusula', modelo: 'Fica incluída/alterada a seguinte disposição: ___.' },
  { valor: 'outro', label: 'Outro', modelo: '' },
]

function fmtData(d: string): string {
  const s = d.slice(0, 10)
  const [y, m, dd] = s.split('-')
  return `${dd}/${m}/${y}`
}

function fmtCpf(s: string | null): string {
  if (!s) return 'sem CPF'
  const d = s.replace(/\D/g, '')
  if (d.length === 11) return `CPF ${d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')}`
  if (d.length === 14) return `CNPJ ${d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}`
  return s
}

const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS.map(t => [t.valor, t.label]))

const hoje = () => new Date().toISOString().slice(0, 10)

export function AditivosSecao({ contratoId, aditivos, pessoas }: {
  contratoId: string
  aditivos: AditivoRow[]
  /** Cadastro de pessoas, pra escolher as testemunhas. */
  pessoas: PessoaOpcao[]
}) {
  const router = useRouter()
  const [modalAberto, setModalAberto] = useState(false)
  // null = criando um novo; senão, o aditivo em edição
  const [editando, setEditando] = useState<AditivoRow | null>(null)
  const [tipo, setTipo] = useState<TipoAditivo>('reajuste')
  const [titulo, setTitulo] = useState('')
  const [dataAditivo, setDataAditivo] = useState(hoje)
  const [objeto, setObjeto] = useState('')
  const [testemunhaIds, setTestemunhaIds] = useState<string[]>([])
  const [erro, setErro] = useState('')
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const proximoNumero = aditivos.length + 1
  const nomePorId = useMemo(() => new Map(pessoas.map(p => [p.id, p.nome])), [pessoas])

  // Quem está cadastrado como testemunha vem primeiro, igual ao editor do contrato
  const pessoasOrdenadas = useMemo(() => [...pessoas].sort((a, b) => {
    if (a.tipo === 'testemunha' && b.tipo !== 'testemunha') return -1
    if (b.tipo === 'testemunha' && a.tipo !== 'testemunha') return 1
    return a.nome.localeCompare(b.nome)
  }), [pessoas])

  const escolherTipo = (t: TipoAditivo) => {
    setTipo(t)
    const modelo = TIPOS.find(x => x.valor === t)?.modelo ?? ''
    // só preenche o modelo se o campo ainda estiver vazio (não sobrescreve edição)
    if (!objeto.trim()) setObjeto(modelo)
  }

  const abrirNovo = () => {
    setEditando(null)
    setTitulo(''); setErro(''); setTestemunhaIds([])
    setDataAditivo(hoje())
    setTipo('reajuste')
    setObjeto(TIPOS[0].modelo)
    setModalAberto(true)
  }

  const abrirEdicao = (a: AditivoRow) => {
    setEditando(a)
    setTipo((TIPO_LABEL[a.tipo] ? a.tipo : 'outro') as TipoAditivo)
    setTitulo(a.titulo ?? '')
    setDataAditivo(a.data_aditivo.slice(0, 10))
    setObjeto(a.objeto)
    setTestemunhaIds(a.testemunha_ids ?? [])
    setErro('')
    setModalAberto(true)
  }

  const toggleTestemunha = (id: string) => {
    setErro('')
    if (testemunhaIds.includes(id)) {
      setTestemunhaIds(testemunhaIds.filter(x => x !== id))
    } else if (testemunhaIds.length >= 2) {
      setErro('Máximo 2 testemunhas. Desmarque uma antes.')
    } else {
      setTestemunhaIds([...testemunhaIds, id])
    }
  }

  const salvar = () => {
    setErro('')
    if (!objeto.trim()) { setErro('Descreva o que está sendo aditado.'); return }
    const input = { contrato_id: contratoId, tipo, titulo, data_aditivo: dataAditivo, objeto, testemunha_ids: testemunhaIds }
    startTransition(async () => {
      const r = editando
        ? await atualizarAditivo(editando.id, input)
        : await criarAditivo(input)
      if (r.error) { setErro(r.error); return }
      setModalAberto(false)
      setEditando(null)
      router.refresh()
      // abre o PDF já com o que acabou de ser salvo
      if (r.id) window.open(`/api/contratos/aditivos/${r.id}/pdf`, '_blank')
    })
  }

  const remover = (id: string) => {
    if (!confirm('Excluir este termo aditivo? Esta ação não pode ser desfeita.')) return
    setRemovendo(id)
    startTransition(async () => {
      const r = await excluirAditivo(id, contratoId)
      setRemovendo(null)
      if (r.error) { alert(r.error); return }
      router.refresh()
    })
  }

  const numeroModal = editando?.numero ?? proximoNumero

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
          onClick={abrirNovo}
          className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-800 border border-violet-200 hover:bg-violet-50 px-2.5 py-1 rounded-lg transition-colors"
        >
          <Plus size={12} /> Novo aditivo
        </button>
      </div>

      {aditivos.length === 0 ? (
        <p className="text-xs text-gray-400">
          Nenhum aditivo. Use depois que o contrato já está assinado e algo precisa mudar — reajuste fora de
          época, prorrogação de prazo, troca de garantia ou inclusão de cláusula. Gera um PDF próprio que
          referencia o contrato e é assinado pelas partes (Lei 8.245/91).
        </p>
      ) : (
        <ul className="space-y-2">
          {aditivos.map(a => {
            const testemunhas = (a.testemunha_ids ?? []).map(id => nomePorId.get(id)).filter(Boolean)
            return (
              <li key={a.id} className="flex items-start justify-between gap-2 border border-gray-100 rounded-xl p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold">{a.numero}º aditivo</span>
                    {a.titulo?.trim() || TIPO_LABEL[a.tipo] || 'Aditamento'}
                    <span className="text-[11px] font-normal text-gray-400">· {fmtData(a.data_aditivo)}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 whitespace-pre-wrap">{a.objeto}</p>
                  <p className={`text-[11px] mt-1 flex items-center gap-1 ${testemunhas.length ? 'text-gray-500' : 'text-amber-600'}`}>
                    <Users size={11} />
                    {testemunhas.length ? `Testemunhas: ${testemunhas.join(', ')}` : 'Sem testemunhas — o PDF sai com as linhas em branco'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => abrirEdicao(a)}
                    disabled={isPending}
                    className="flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-100 px-2 py-1.5 rounded-lg disabled:opacity-50"
                    title="Editar texto, data e testemunhas"
                  >
                    <Pencil size={13} /> Editar
                  </button>
                  <a
                    href={`/api/contratos/aditivos/${a.id}/pdf`}
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
            )
          })}
        </ul>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isPending && setModalAberto(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FilePlus2 size={16} className="text-violet-600" />
                {editando ? `Editar ${numeroModal}º termo aditivo` : `${numeroModal}º Termo aditivo`}
              </h2>
              <button type="button" onClick={() => setModalAberto(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X size={16} />
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mb-3">
              Vincula ao contrato e gera um PDF assinável. As demais cláusulas do contrato permanecem inalteradas.
              {editando && ' Editar aqui não muda valores nem parcelas — só o documento.'}
            </p>

            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                <select value={tipo} onChange={e => escolherTipo(e.target.value as TipoAditivo)} className={inputCls}>
                  {TIPOS.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data do aditivo</label>
                <input type="date" value={dataAditivo} onChange={e => setDataAditivo(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Título (opcional)</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Prorrogação 2027" className={inputCls} />
              </div>
            </div>

            <label className="block text-xs font-semibold text-gray-600 mb-1">O que está sendo aditado *</label>
            <textarea
              value={objeto}
              onChange={e => setObjeto(e.target.value)}
              rows={12}
              placeholder="Descreva a alteração. Use uma linha em branco entre parágrafos — cada um vira um item numerado (1.1, 1.2…) no PDF."
              className={`${inputCls} resize-y leading-relaxed`}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Linha em branco entre parágrafos numera cada item (1.1, 1.2…). Ratificação, foro, data e assinaturas
              o PDF já coloca sozinho.
            </p>

            {/* Testemunhas — até 2 do cadastro, igual ao contrato */}
            <div className="mt-4">
              <div className="flex items-baseline justify-between mb-1">
                <label className="text-xs font-semibold text-gray-600">Testemunhas</label>
                <span className="text-[10px] text-gray-400">Selecionadas: <strong>{testemunhaIds.length}/2</strong></span>
              </div>
              {pessoasOrdenadas.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Nenhuma pessoa cadastrada ainda. Cadastre em Clientes.</p>
              ) : (
                <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-lg p-1 grid sm:grid-cols-2 gap-1">
                  {pessoasOrdenadas.map(p => {
                    const selecionada = testemunhaIds.includes(p.id)
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          selecionada ? 'bg-violet-50 border border-violet-300' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selecionada}
                          onChange={() => toggleTestemunha(p.id)}
                          disabled={isPending || (!selecionada && testemunhaIds.length >= 2)}
                          className="accent-violet-600 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{p.nome}</p>
                          <p className="text-[10px] text-gray-500">
                            {p.tipo === 'testemunha' && <span className="text-violet-600 font-bold">testemunha · </span>}
                            {fmtCpf(p.cpf_cnpj)}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-1">
                Escolhidas saem com nome, CPF e RG na folha de assinatura. Sem escolher, o PDF deixa as linhas em branco.
              </p>
            </div>

            {erro && <p className="text-xs text-rose-600 mt-2">{erro}</p>}

            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setModalAberto(false)} disabled={isPending} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancelar
              </button>
              <button type="button" onClick={salvar} disabled={isPending || !objeto.trim()} className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {editando ? 'Salvar e abrir PDF' : 'Criar e gerar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
