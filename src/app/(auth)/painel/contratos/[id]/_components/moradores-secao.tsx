'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, UserPlus, X, Trash2, Loader2, ExternalLink, Building2, Handshake, Home } from 'lucide-react'
import {
  adicionarMorador, removerMorador,
  type ParentescoMorador, type PapelVinculo, type AdicionarMoradorInput,
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

const PAPEIS: { valor: PapelVinculo; label: string; descricao: string; icone: React.ElementType; cor: string; bg: string }[] = [
  {
    valor: 'inquilino_solidario',
    label: 'Inquilino solidário',
    descricao: 'Co-responsável pelo aluguel · assina o contrato e responde pelo pagamento',
    icone: Handshake, cor: 'text-blue-700', bg: 'bg-blue-100',
  },
  {
    valor: 'socio_signatario',
    label: 'Sócio signatário',
    descricao: 'Sócio da empresa locatária (PJ) · assina o contrato em nome da empresa',
    icone: Building2, cor: 'text-amber-700', bg: 'bg-amber-100',
  },
  {
    valor: 'morador',
    label: 'Morador adicional',
    descricao: 'Mora junto · família ou dependente sem responsabilidade financeira',
    icone: Home, cor: 'text-violet-700', bg: 'bg-violet-100',
  },
]
const PAPEL_INFO: Record<PapelVinculo, typeof PAPEIS[number]> =
  Object.fromEntries(PAPEIS.map(p => [p.valor, p])) as Record<PapelVinculo, typeof PAPEIS[number]>

export interface MoradorRow {
  id: string
  papel: PapelVinculo
  parentesco: ParentescoMorador | null
  mora_no_imovel: boolean
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
  inquilinoEhPJ: boolean
}

export function MoradoresSecao({ contratoId, moradores, pessoasDisponiveis, inquilinoId, inquilinoEhPJ }: Props) {
  const router = useRouter()
  const [modalAberto, setModalAberto] = useState(false)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const remover = (id: string, nome: string) => {
    if (!confirm(`Remover ${nome} deste contrato?`)) return
    setRemovendo(id)
    startTransition(async () => {
      const r = await removerMorador(id)
      setRemovendo(null)
      if (r.error) { alert(r.error); return }
      router.refresh()
    })
  }

  const solidarios = moradores.filter(m => m.papel === 'inquilino_solidario')
  const socios = moradores.filter(m => m.papel === 'socio_signatario')
  const moradoresLista = moradores.filter(m => m.papel === 'morador')

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Users size={14} className="text-violet-600" />
          Pessoas vinculadas ao contrato
          <span className="text-xs font-normal text-gray-400">({moradores.length})</span>
          {inquilinoEhPJ && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">
              INQUILINO PJ
            </span>
          )}
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
          Ninguém além do inquilino contratante está vinculado a este contrato. Adicione:
          <span className="block mt-1.5 ml-3">• <strong>Inquilinos solidários</strong> se mais de uma pessoa assina e paga o aluguel</span>
          {inquilinoEhPJ && (
            <span className="block ml-3">• <strong>Sócios signatários</strong> que assinam em nome da empresa</span>
          )}
          <span className="block ml-3">• <strong>Moradores</strong> (família, filhos, dependentes)</span>
        </p>
      ) : (
        <div className="space-y-4">
          {solidarios.length > 0 && (
            <GrupoVinculados
              papel="inquilino_solidario"
              itens={solidarios}
              onRemover={remover}
              removendo={removendo}
              isPending={isPending}
            />
          )}
          {socios.length > 0 && (
            <GrupoVinculados
              papel="socio_signatario"
              itens={socios}
              onRemover={remover}
              removendo={removendo}
              isPending={isPending}
            />
          )}
          {moradoresLista.length > 0 && (
            <GrupoVinculados
              papel="morador"
              itens={moradoresLista}
              onRemover={remover}
              removendo={removendo}
              isPending={isPending}
            />
          )}
        </div>
      )}

      {modalAberto && (
        <ModalAdicionar
          contratoId={contratoId}
          inquilinoEhPJ={inquilinoEhPJ}
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

function GrupoVinculados({
  papel, itens, onRemover, removendo, isPending,
}: {
  papel: PapelVinculo
  itens: MoradorRow[]
  onRemover: (id: string, nome: string) => void
  removendo: string | null
  isPending: boolean
}) {
  const info = PAPEL_INFO[papel]
  const Icone = info.icone
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icone size={12} className={info.cor} />
        <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${info.cor}`}>
          {info.label}{itens.length > 1 ? 's' : ''} ({itens.length})
        </h3>
      </div>
      <ul className="divide-y divide-gray-50 border border-gray-50 rounded-lg">
        {itens.map(m => (
          <li key={m.id} className="py-2 px-2 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-gray-900 truncate">
                  {m.pessoa?.nome ?? '(pessoa removida)'}
                </span>
                {m.parentesco && (
                  <span className={`text-[10px] ${info.bg} ${info.cor} px-1.5 py-0.5 rounded-full`}>
                    {LABEL_PARENTESCO[m.parentesco] ?? m.parentesco}
                  </span>
                )}
                {!m.mora_no_imovel && (
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    não mora no imóvel
                  </span>
                )}
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
                {m.pessoa?.cpf_cnpj && <>{m.pessoa.cpf_cnpj.length > 14 ? 'CNPJ' : 'CPF'}: {m.pessoa.cpf_cnpj}</>}
                {m.pessoa?.cpf_cnpj && m.pessoa?.telefone && ' · '}
                {m.pessoa?.telefone}
                {m.observacao && <span className="block italic">&ldquo;{m.observacao}&rdquo;</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => m.pessoa && onRemover(m.id, m.pessoa.nome)}
              disabled={isPending && removendo === m.id}
              className="text-gray-300 hover:text-red-600 p-1 rounded"
              title="Remover"
            >
              {removendo === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ModalAdicionar({
  contratoId, pessoasDisponiveis, inquilinoEhPJ, onFechar, onSucesso,
}: {
  contratoId: string
  pessoasDisponiveis: PessoaOpcao[]
  inquilinoEhPJ: boolean
  onFechar: () => void
  onSucesso: () => void
}) {
  const [papel, setPapel] = useState<PapelVinculo>(inquilinoEhPJ ? 'socio_signatario' : 'morador')
  const [busca, setBusca] = useState('')
  const [pessoaId, setPessoaId] = useState('')
  const [parentesco, setParentesco] = useState<ParentescoMorador | ''>('')
  const [moraNoImovel, setMoraNoImovel] = useState(true)
  const [observacao, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  // Defaults conforme papel
  const trocarPapel = (novo: PapelVinculo) => {
    setPapel(novo)
    setMoraNoImovel(novo === 'morador')
    if (novo === 'morador' && !parentesco) setParentesco('conjuge')
    if (novo !== 'morador') setParentesco('')
  }

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
      papel,
      parentesco: parentesco || null,
      mora_no_imovel: moraNoImovel,
      observacao: observacao || undefined,
    }
    startTransition(async () => {
      const r = await adicionarMorador(payload)
      if (r.error) { setErro(r.error); return }
      onSucesso()
    })
  }

  const papelInfo = PAPEL_INFO[papel]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl shadow-xl p-5 max-w-md w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-bold text-gray-900">Adicionar pessoa ao contrato</h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-3 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Papel no contrato *</label>
            <div className="grid gap-1.5">
              {PAPEIS.map(p => {
                const Icone = p.icone
                const ativo = papel === p.valor
                return (
                  <button
                    key={p.valor}
                    type="button"
                    onClick={() => trocarPapel(p.valor)}
                    className={`text-left flex items-start gap-2 p-2.5 rounded-lg border transition-colors ${
                      ativo
                        ? `${p.bg} border-current ${p.cor}`
                        : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <Icone size={14} className={ativo ? p.cor : 'text-gray-400'} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${ativo ? p.cor : 'text-gray-700'}`}>{p.label}</p>
                      <p className="text-[11px] text-gray-500 leading-snug">{p.descricao}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Pessoa *</label>
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome ou CPF/CNPJ"
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
              <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
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

          {papel === 'morador' && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Parentesco</label>
              <select value={parentesco} onChange={e => setParentesco(e.target.value as ParentescoMorador)} className={inputCls}>
                <option value="">— escolher —</option>
                {PARENTESCOS.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
              </select>
            </div>
          )}

          {papel !== 'morador' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={moraNoImovel}
                onChange={e => setMoraNoImovel(e.target.checked)}
                className="w-4 h-4 accent-violet-600"
              />
              <span className="text-xs text-gray-700">Mora no imóvel</span>
            </label>
          )}

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Observação</label>
            <textarea value={observacao} onChange={e => setObs(e.target.value)} rows={2}
              className={`${inputCls} resize-y`}
              placeholder={
                papel === 'inquilino_solidario' ? 'Ex: percentual de responsabilidade no aluguel' :
                papel === 'socio_signatario' ? 'Ex: sócio administrador, % de participação' :
                'Ex: filho menor de idade'
              } />
          </div>

          {erro && <p className="text-xs text-red-600">{erro}</p>}

          <p className={`text-[11px] ${papelInfo.bg} ${papelInfo.cor} rounded-lg px-3 py-2`}>
            ℹ️ {papelInfo.descricao}
          </p>
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
