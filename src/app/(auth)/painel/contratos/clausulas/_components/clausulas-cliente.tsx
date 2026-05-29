'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileSignature, Plus, Trash2, Save, X, Copy, Check, Loader2,
  AlertCircle, EyeOff, Eye, Download, Variable,
} from 'lucide-react'
import { TIPOS_CLAUSULA, PLACEHOLDERS, type TipoClausula } from '@/lib/contratos/placeholders'
import {
  criarClausula, atualizarClausula, alternarAtiva, excluirClausula,
  importarContratoModelo, importarClausulasFaltantes, reimportarClausulasAdministracao,
} from '../actions'

export interface ClausulaRow {
  id: string
  tipo: TipoClausula
  categoria: string
  titulo: string
  numero: number
  corpo: string
  ativa: boolean
  updated_at: string
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 text-sm transition"

export function ClausulasCliente({ clausulasIniciais }: { clausulasIniciais: ClausulaRow[] }) {
  const router = useRouter()
  const [clausulas, setClausulas] = useState(clausulasIniciais)
  const [tipoAtivo, setTipoAtivo] = useState<TipoClausula>('generica')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [criandoNova, setCriandoNova] = useState(false)
  const [mostrarPlaceholders, setMostrarPlaceholders] = useState(false)
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const filtradas = clausulas.filter(c => c.tipo === tipoAtivo)
  const totalAtivas = clausulas.filter(c => c.ativa).length
  const vazio = clausulas.length === 0

  const recarregar = () => router.refresh()

  const onImportarModelo = () => {
    setErro('')
    startTransition(async () => {
      const r = await importarContratoModelo()
      if (r.error) { setErro(r.error); return }
      recarregar()
    })
  }

  const onReimportarModelo = () => {
    if (!confirm(
      'ATENÇÃO: vai apagar TODAS as suas cláusulas atuais e reimportar o modelo padrão.\n\n' +
      'Edições que você fez serão PERDIDAS.\n\nConfirmar?'
    )) return
    setErro('')
    startTransition(async () => {
      const r = await importarContratoModelo(true)
      if (r.error) { setErro(r.error); return }
      recarregar()
    })
  }

  const onImportarFaltantes = () => {
    setErro('')
    startTransition(async () => {
      const r = await importarClausulasFaltantes()
      if (r.error) { setErro(r.error); return }
      if (r.mensagem) alert(r.mensagem)
      recarregar()
    })
  }

  const onReimportarAdmin = () => {
    if (!confirm(
      'Vai apagar e reimportar SOMENTE as cláusulas de administração (modelo atualizado).\n\n' +
      'Edições que você fez nas cláusulas de administração serão perdidas. As cláusulas de locação NÃO são afetadas.\n\nConfirmar?'
    )) return
    setErro('')
    startTransition(async () => {
      const r = await reimportarClausulasAdministracao()
      if (r.error) { setErro(r.error); return }
      if (r.mensagem) alert(r.mensagem)
      recarregar()
    })
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Cabeçalho */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileSignature className="text-violet-700" size={22} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Banco de cláusulas</h1>
            <p className="text-xs text-gray-500">
              {clausulas.length === 0
                ? 'Nenhuma cláusula cadastrada ainda'
                : `${totalAtivas} ativa${totalAtivas === 1 ? '' : 's'} de ${clausulas.length}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!vazio && (
            <>
              <button
                type="button"
                onClick={onImportarFaltantes}
                disabled={isPending}
                className="text-xs font-medium text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 disabled:opacity-50"
                title="Importa apenas as cláusulas novas do seed (preserva suas edições)"
              >
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Importar novas
              </button>
              <button
                type="button"
                onClick={onReimportarModelo}
                disabled={isPending}
                className="text-xs font-medium text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5 disabled:opacity-50"
                title="Apaga as atuais e reimporta o modelo atualizado"
              >
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Reimportar modelo
              </button>
              {tipoAtivo === 'administracao' && (
                <button
                  type="button"
                  onClick={onReimportarAdmin}
                  disabled={isPending}
                  className="text-xs font-medium text-violet-700 hover:bg-violet-50 px-3 py-1.5 rounded-lg border border-violet-200 flex items-center gap-1.5 disabled:opacity-50"
                  title="Apaga e reimporta só as cláusulas de administração (não toca nas de locação)"
                >
                  {isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  Atualizar administração
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => setMostrarPlaceholders(true)}
            className="text-xs font-medium text-violet-700 hover:bg-violet-50 px-3 py-1.5 rounded-lg border border-violet-200 flex items-center gap-1.5"
          >
            <Variable size={13} /> Ver placeholders
          </button>
        </div>
      </header>

      {/* Estado vazio: oferecer importação do modelo */}
      {vazio && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-6 text-center">
          <FileSignature size={28} className="text-violet-600 mx-auto mb-2" />
          <h2 className="text-base font-semibold text-violet-900 mb-1">Comece com o contrato modelo</h2>
          <p className="text-sm text-violet-800/90 mb-4 max-w-md mx-auto">
            Importa 28 cláusulas prontas: genéricas (partes, objeto, prazo, aluguel, mora, rescisão…), todas as variações de garantia (sem garantia, caução, fiador, seguro fiança) e seguro incêndio (3 modalidades). Você edita o que quiser depois.
          </p>
          <button
            type="button"
            onClick={onImportarModelo}
            disabled={isPending}
            className="inline-flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Importar contrato modelo
          </button>
          {erro && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-red-700 flex items-center gap-1.5 justify-center">
                <AlertCircle size={12} /> {erro}
              </p>
              {/* Quando a action diz "já tem cláusulas" mas a tela tá vazia,
                  é descompasso de cache. Oferece reimportação direta. */}
              {erro.toLowerCase().includes('já tem cláusulas') && (
                <div className="bg-white border border-amber-200 rounded-lg p-3 text-left">
                  <p className="text-[11px] text-gray-700 mb-2">
                    A tela está vazia mas o sistema diz que você já tem cláusulas no banco. Provável cache. Tenta:
                  </p>
                  <ol className="text-[11px] text-gray-600 list-decimal pl-4 space-y-0.5 mb-3">
                    <li>Hard refresh (<strong>Ctrl + Shift + R</strong>) — costuma resolver</li>
                    <li>Se persistir, clique no botão abaixo pra apagar tudo e reimportar do zero</li>
                  </ol>
                  <button
                    type="button"
                    onClick={onReimportarModelo}
                    disabled={isPending}
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg"
                  >
                    {isPending ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    Forçar reimportação (apaga e refaz)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tabs por tipo */}
      {!vazio && (
        <div className="flex flex-wrap gap-2 border-b border-gray-200">
          {TIPOS_CLAUSULA.map(t => {
            const quantas = clausulas.filter(c => c.tipo === t.valor).length
            const ativo = tipoAtivo === t.valor
            return (
              <button
                key={t.valor}
                type="button"
                onClick={() => { setTipoAtivo(t.valor); setCriandoNova(false); setEditandoId(null) }}
                className={`text-sm font-medium px-3 py-2 border-b-2 transition-colors ${
                  ativo
                    ? 'border-violet-700 text-violet-700'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                {t.label}
                {quantas > 0 && (
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${ativo ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
                    {quantas}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Descrição do tipo + botão adicionar */}
      {!vazio && (
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-500 max-w-md">
            {TIPOS_CLAUSULA.find(t => t.valor === tipoAtivo)?.descricao}
          </p>
          <button
            type="button"
            onClick={() => { setCriandoNova(true); setEditandoId(null) }}
            disabled={criandoNova}
            className="text-xs font-semibold text-violet-700 hover:bg-violet-50 px-3 py-1.5 rounded-lg border border-violet-200 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus size={13} /> Adicionar cláusula
          </button>
        </div>
      )}

      {/* Form de nova cláusula */}
      {criandoNova && (
        <ClausulaForm
          modo="novo"
          tipoFixo={tipoAtivo}
          onCancelar={() => setCriandoNova(false)}
          onSalvar={(nova) => {
            setClausulas(curr => [...curr, nova])
            setCriandoNova(false)
          }}
        />
      )}

      {/* Lista de cláusulas */}
      {!vazio && filtradas.length === 0 && !criandoNova && (
        <div className="text-center py-10 text-sm text-gray-400">
          Nenhuma cláusula cadastrada nesse tipo. Clique em &ldquo;Adicionar cláusula&rdquo; pra criar uma.
        </div>
      )}

      <div className="space-y-2">
        {filtradas.map(c => editandoId === c.id ? (
          <ClausulaForm
            key={c.id}
            modo="editar"
            tipoFixo={c.tipo}
            inicial={c}
            onCancelar={() => setEditandoId(null)}
            onSalvar={(atualizada) => {
              setClausulas(curr => curr.map(x => x.id === atualizada.id ? atualizada : x))
              setEditandoId(null)
            }}
          />
        ) : (
          <ClausulaCard
            key={c.id}
            clausula={c}
            onEditar={() => setEditandoId(c.id)}
            onAlternarAtiva={() => {
              startTransition(async () => {
                const r = await alternarAtiva(c.id, !c.ativa)
                if (!r.error) {
                  setClausulas(curr => curr.map(x => x.id === c.id ? { ...x, ativa: !x.ativa } : x))
                }
              })
            }}
            onExcluir={() => {
              if (!confirm(`Excluir a cláusula "${c.titulo}"? Essa ação é permanente.`)) return
              startTransition(async () => {
                const r = await excluirClausula(c.id)
                if (!r.error) {
                  setClausulas(curr => curr.filter(x => x.id !== c.id))
                }
              })
            }}
          />
        ))}
      </div>

      {mostrarPlaceholders && <PlaceholdersModal onFechar={() => setMostrarPlaceholders(false)} />}
    </div>
  )
}

// ── Card de cláusula (modo visualização) ──
function ClausulaCard({ clausula, onEditar, onAlternarAtiva, onExcluir }: {
  clausula: ClausulaRow
  onEditar: () => void
  onAlternarAtiva: () => void
  onExcluir: () => void
}) {
  return (
    <div className={`bg-white rounded-xl border ${clausula.ativa ? 'border-gray-200' : 'border-gray-100 opacity-60'} p-4 space-y-2`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
              {clausula.categoria}
            </span>
            <span className="text-[10px] font-mono text-gray-400">#{clausula.numero}</span>
            {!clausula.ativa && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                desativada
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-gray-900">{clausula.titulo}</h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onAlternarAtiva}
            className="p-1.5 text-gray-400 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
            title={clausula.ativa ? 'Desativar' : 'Ativar'}
          >
            {clausula.ativa ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            type="button"
            onClick={onEditar}
            className="text-xs font-semibold text-violet-700 hover:bg-violet-50 px-2.5 py-1 rounded"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={onExcluir}
            className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
            title="Excluir"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-3 leading-relaxed">
        {clausula.corpo}
      </p>
    </div>
  )
}

// ── Form de nova/editar cláusula ──
function ClausulaForm({ modo, tipoFixo, inicial, onCancelar, onSalvar }: {
  modo: 'novo' | 'editar'
  tipoFixo: TipoClausula
  inicial?: ClausulaRow
  onCancelar: () => void
  onSalvar: (c: ClausulaRow) => void
}) {
  const [categoria, setCategoria] = useState(inicial?.categoria ?? '')
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '')
  const [numero, setNumero] = useState<number>(inicial?.numero ?? 0)
  const [corpo, setCorpo] = useState(inicial?.corpo ?? '')
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const onSalvarClick = () => {
    setErro('')
    const payload = { tipo: tipoFixo, categoria, titulo, numero, corpo }
    startTransition(async () => {
      if (modo === 'novo') {
        const r = await criarClausula(payload)
        if (r.error || !r.id) { setErro(r.error ?? 'Falha ao criar.'); return }
        onSalvar({
          id: r.id, tipo: tipoFixo, categoria, titulo, numero, corpo,
          ativa: true, updated_at: new Date().toISOString(),
        })
      } else if (inicial) {
        const r = await atualizarClausula(inicial.id, payload)
        if (r.error) { setErro(r.error); return }
        onSalvar({ ...inicial, categoria, titulo, numero, corpo })
      }
    })
  }

  return (
    <div className="bg-white rounded-xl border-2 border-violet-300 p-4 space-y-3 shadow-sm">
      <div className="grid sm:grid-cols-[1fr_180px_80px] gap-2">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 block mb-1">Título</label>
          <input
            type="text"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            placeholder="Ex: Do objeto da locação"
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 block mb-1">Categoria</label>
          <input
            type="text"
            value={categoria}
            onChange={e => setCategoria(e.target.value.toLowerCase().replace(/[^a-z_]/g, ''))}
            placeholder="objeto"
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 block mb-1">Ordem</label>
          <input
            type="number"
            min={0}
            max={999}
            value={numero}
            onChange={e => setNumero(parseInt(e.target.value || '0', 10))}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 block mb-1">
          Corpo da cláusula
          <span className="text-gray-400 ml-1 normal-case font-normal">
            (use {'{{PLACEHOLDER}}'} pra variáveis — ex: {'{{LOCATARIO_NOME}}'})
          </span>
        </label>
        <textarea
          value={corpo}
          onChange={e => setCorpo(e.target.value)}
          rows={10}
          placeholder="Texto completo da cláusula, com placeholders entre chaves duplas..."
          className={`${inputCls} font-mono text-xs leading-relaxed resize-y`}
        />
      </div>

      {erro && (
        <p className="text-xs text-red-600 flex items-center gap-1.5">
          <AlertCircle size={13} /> {erro}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancelar}
          disabled={isPending}
          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 flex items-center gap-1"
        >
          <X size={12} /> Cancelar
        </button>
        <button
          type="button"
          onClick={onSalvarClick}
          disabled={isPending || !titulo.trim() || !categoria.trim() || !corpo.trim()}
          className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg"
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {modo === 'novo' ? 'Criar cláusula' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  )
}

// ── Modal de placeholders ──
function PlaceholdersModal({ onFechar }: { onFechar: () => void }) {
  const [copiado, setCopiado] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')

  const filtrados = PLACEHOLDERS.filter(p =>
    !filtro
    || p.chave.toLowerCase().includes(filtro.toLowerCase())
    || p.label.toLowerCase().includes(filtro.toLowerCase())
  )

  const copiar = (chave: string) => {
    navigator.clipboard.writeText(`{{${chave}}}`).catch(() => {})
    setCopiado(chave)
    setTimeout(() => setCopiado(null), 1200)
  }

  // Agrupa por origem
  const grupos: Record<string, typeof PLACEHOLDERS> = {}
  for (const p of filtrados) {
    if (!grupos[p.origem]) grupos[p.origem] = []
    grupos[p.origem].push(p)
  }

  const LABELS_ORIGEM: Record<string, string> = {
    locador: 'Locador / Proprietário',
    locatario: 'Locatário',
    conjuge_locatario: 'Cônjuge do locatário',
    admin: 'Administradora (sua imobiliária)',
    imovel: 'Imóvel',
    valores: 'Valores',
    prazo: 'Prazo',
    garantia: 'Caução',
    fiador: 'Fiador',
    seguro: 'Seguro',
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={onFechar}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
              <Variable size={16} className="text-violet-700" /> Placeholders disponíveis
            </h2>
            <p className="text-xs text-gray-500">Clique pra copiar; cole no corpo da cláusula.</p>
          </div>
          <button onClick={onFechar} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <input
            type="text"
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            placeholder="Filtrar (ex: locatario, cpf, endereco...)"
            className={inputCls}
          />
        </div>

        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {Object.entries(grupos).map(([origem, lista]) => (
            <section key={origem}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-violet-700 mb-2">
                {LABELS_ORIGEM[origem] ?? origem}
              </h3>
              <div className="space-y-1">
                {lista.map(p => (
                  <button
                    key={p.chave}
                    type="button"
                    onClick={() => copiar(p.chave)}
                    className="w-full flex items-center justify-between gap-3 text-left px-3 py-2 rounded-lg hover:bg-violet-50 border border-gray-100 hover:border-violet-200 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <code className="text-xs font-mono text-violet-700 font-semibold">{`{{${p.chave}}}`}</code>
                      <p className="text-[11px] text-gray-500 mt-0.5">{p.label} · <span className="text-gray-400 italic">ex: {p.exemplo}</span></p>
                    </div>
                    <div className="shrink-0 text-gray-400">
                      {copiado === p.chave ? <Check size={14} className="text-green-600" /> : <Copy size={13} />}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {filtrados.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">Nenhum placeholder encontrado.</p>
          )}
        </div>
      </div>
    </div>
  )
}
