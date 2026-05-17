'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, UserPlus, X, Trash2, Loader2, ExternalLink } from 'lucide-react'
import {
  adicionarMorador, removerMorador,
  type ParentescoMorador, type AdicionarMoradorInput,
} from '../../actions'

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900"

const PARENTESCOS: { valor: ParentescoMorador; label: string }[] = [
  { valor: 'conjuge', label: 'Cônjuge' },
  { valor: 'filho', label: 'Filho(a)' },
  { valor: 'pai_mae', label: 'Pai / Mãe' },
  { valor: 'irmao', label: 'Irmão(ã)' },
  { valor: 'socio', label: 'Sócio' },
  { valor: 'dependente', label: 'Dependente' },
  { valor: 'outro', label: 'Outro' },
]

const LABEL_PARENTESCO = Object.fromEntries(PARENTESCOS.map(p => [p.valor, p.label]))

export interface MoradorRow {
  id: string
  parentesco: ParentescoMorador
  observacao: string | null
  pessoa: {
    id: string
    nome: string
    cpf_cnpj: string | null
    telefone: string | null
  } | null
}

export interface PessoaOpcao {
  id: string
  nome: string
  tipo: string
  cpf_cnpj: string | null
}

interface Props {
  contratoId: string
  moradores: MoradorRow[]
  pessoasDisponiveis: PessoaOpcao[]
  inquilinoId: string
}

export function MoradoresSecao({ contratoId, moradores, pessoasDisponiveis, inquilinoId }: Props) {
  const router = useRouter()
  const [modalAberto, setModalAberto] = useState(false)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const remover = (id: string, nome: string) => {
    if (!confirm(`Remover ${nome} dos moradores deste contrato?`)) return
    setRemovendo(id)
    startTransition(async () => {
      const r = await removerMorador(id)
      setRemovendo(null)
      if (r.error) { alert(r.error); return }
      router.refresh()
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Users size={14} className="text-violet-600" />
          Moradores adicionais
          <span className="text-xs font-normal text-gray-400">({moradores.length})</span>
        </h2>
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-800 border border-violet-200 hover:bg-violet-50 px-2.5 py-1 rounded-lg transition-colors"
        >
          <UserPlus size={12} /> Adicionar
        </button>
      </div>

      {moradores.length === 0 ? (
        <p className="text-xs text-gray-400">
          Ninguém além do inquilino contratante está vinculado a este contrato.
          Adicione cônjuge, filhos ou outros moradores se houver.
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {moradores.map(m => (
            <li key={m.id} className="py-2 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-900 truncate">
                    {m.pessoa?.nome ?? '(pessoa removida)'}
                  </span>
                  <span className="text-[11px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                    {LABEL_PARENTESCO[m.parentesco] ?? m.parentesco}
                  </span>
                  {m.pessoa && (
                    <Link
                      href={`/painel/clientes/${m.pessoa.id}`}
                      className="text-gray-400 hover:text-violet-700"
                      title="Ver ficha completa"
                    >
                      <ExternalLink size={11} />
                    </Link>
                  )}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {m.pessoa?.cpf_cnpj && <>CPF: {m.pessoa.cpf_cnpj}</>}
                  {m.pessoa?.cpf_cnpj && m.pessoa?.telefone && ' · '}
                  {m.pessoa?.telefone}
                  {m.observacao && <span className="block italic">&ldquo;{m.observacao}&rdquo;</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => m.pessoa && remover(m.id, m.pessoa.nome)}
                disabled={isPending && removendo === m.id}
                className="text-gray-300 hover:text-red-600 p-1 rounded"
                title="Remover morador"
              >
                {removendo === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {modalAberto && (
        <ModalAdicionar
          contratoId={contratoId}
          pessoasDisponiveis={pessoasDisponiveis.filter(
            p => p.id !== inquilinoId && !moradores.some(m => m.pessoa?.id === p.id)
          )}
          onFechar={() => setModalAberto(false)}
          onSucesso={() => { setModalAberto(false); router.refresh() }}
        />
      )}
    </section>
  )
}

function ModalAdicionar({
  contratoId, pessoasDisponiveis, onFechar, onSucesso,
}: {
  contratoId: string
  pessoasDisponiveis: PessoaOpcao[]
  onFechar: () => void
  onSucesso: () => void
}) {
  const [busca, setBusca] = useState('')
  const [pessoaId, setPessoaId] = useState('')
  const [parentesco, setParentesco] = useState<ParentescoMorador>('conjuge')
  const [observacao, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const filtradas = busca
    ? pessoasDisponiveis.filter(p =>
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (p.cpf_cnpj ?? '').includes(busca)
      )
    : pessoasDisponiveis

  const confirmar = () => {
    setErro('')
    if (!pessoaId) { setErro('Selecione uma pessoa.'); return }

    const payload: AdicionarMoradorInput = {
      contrato_id: contratoId,
      pessoa_id: pessoaId,
      parentesco,
      observacao: observacao || undefined,
    }
    startTransition(async () => {
      const r = await adicionarMorador(payload)
      if (r.error) { setErro(r.error); return }
      onSucesso()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl shadow-xl p-5 max-w-md w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-bold text-gray-900">Adicionar morador</h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-3 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Pessoa *</label>
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome ou CPF"
              className={`${inputCls} mb-2`}
            />
            {pessoasDisponiveis.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-3 bg-gray-50 rounded-lg">
                Nenhuma pessoa disponível.{' '}
                <Link href="/painel/clientes/novo" className="text-violet-700 underline">
                  Cadastrar nova pessoa
                </Link>
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
                {filtradas.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPessoaId(p.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-violet-50 ${
                      pessoaId === p.id ? 'bg-violet-50 ring-2 ring-violet-300' : ''
                    }`}
                  >
                    <div className="font-medium text-gray-900">{p.nome}</div>
                    <div className="text-[11px] text-gray-400">
                      {p.cpf_cnpj && <>{p.cpf_cnpj} · </>}
                      <span className="capitalize">{p.tipo}</span>
                    </div>
                  </button>
                ))}
                {filtradas.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3">Nenhum resultado para &ldquo;{busca}&rdquo;.</p>
                )}
              </div>
            )}
            <Link
              href="/painel/clientes/novo"
              className="text-[11px] text-violet-700 hover:underline mt-1.5 inline-block"
            >
              + Cadastrar nova pessoa
            </Link>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Parentesco / relação *</label>
            <select value={parentesco} onChange={e => setParentesco(e.target.value as ParentescoMorador)} className={inputCls}>
              {PARENTESCOS.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Observação</label>
            <textarea value={observacao} onChange={e => setObs(e.target.value)} rows={2}
              className={`${inputCls} resize-y`}
              placeholder="Detalhes opcionais (ex: filho menor de idade)" />
          </div>

          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-gray-100">
          <button onClick={onFechar} disabled={isPending}
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={isPending || !pessoaId}
            className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}
