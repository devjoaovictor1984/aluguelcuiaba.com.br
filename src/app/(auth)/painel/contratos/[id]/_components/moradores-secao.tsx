'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, UserPlus, X, Trash2, Loader2, ExternalLink, Building2, Handshake, Home, ShieldCheck, UserCheck, Coins, Scale, Zap, AlertTriangle, CheckCircle2, Pencil } from 'lucide-react'
import {
  adicionarMorador, removerMorador,
  type ParentescoMorador, type PapelVinculo, type AdicionarMoradorInput,
} from '../../actions'
import {
  salvarResponsabilidadesUsuario, confirmarTitularidade, registrarCienciaSeguradora,
} from '../actions-usuario-autorizado'
import {
  CONSUMOS, PRAZO_TITULARIDADE_PADRAO, rotuloUsuarioAutorizado, statusTitularidade,
  type Consumo, type Finalidade,
} from '@/lib/contratos/usuario-autorizado'

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
  {
    valor: 'responsavel_seguro',
    label: 'Responsável pelo seguro fiança',
    descricao: 'Passou o seguro mas pode não morar (ex: pai do inquilino) · assina como interveniente anuente, não recebe chaves',
    icone: ShieldCheck, cor: 'text-emerald-700', bg: 'bg-emerald-100',
  },
  {
    valor: 'conjuge_responsavel_seguro',
    label: 'Cônjuge do responsável pelo seguro',
    descricao: 'Assina só se a seguradora exigir · não mora nem recebe chaves',
    icone: UserCheck, cor: 'text-teal-700', bg: 'bg-teal-100',
  },
  {
    valor: 'ocupante_autorizado',
    label: 'Ocupante autorizado',
    descricao: 'Usa o imóvel sem ser locatário (ex.: sala usada pelo genro, seguro no nome do sogro) · assina como interveniente anuente, recebe as chaves e assume só o que for marcado — não vira locatário, fiador nem solidário',
    icone: UserCheck, cor: 'text-sky-700', bg: 'bg-sky-100',
  },
  {
    valor: 'caucionante',
    label: 'Caucionante',
    descricao: 'Terceiro que paga a caução · assina como interveniente anuente, não recebe chaves',
    icone: Coins, cor: 'text-orange-700', bg: 'bg-orange-100',
  },
  {
    valor: 'interveniente_anuente',
    label: 'Representante legal / Interveniente anuente',
    descricao: 'Representante legal de uma das partes ou terceiro anuente · assina o contrato, não mora nem recebe chaves',
    icone: Scale, cor: 'text-rose-700', bg: 'bg-rose-100',
  },
]
const PAPEL_INFO: Record<PapelVinculo, typeof PAPEIS[number]> =
  Object.fromEntries(PAPEIS.map(p => [p.valor, p])) as Record<PapelVinculo, typeof PAPEIS[number]>

/** Info do papel com o nome certo pra finalidade (comercial → "Usuário comercial autorizado"). */
function infoPapel(papel: PapelVinculo, finalidade: Finalidade): typeof PAPEIS[number] {
  const info = PAPEL_INFO[papel]
  return papel === 'ocupante_autorizado' ? { ...info, label: rotuloUsuarioAutorizado(finalidade) } : info
}

const fmtDataBR = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')

export interface MoradorRow {
  id: string
  papel: PapelVinculo
  parentesco: ParentescoMorador | null
  mora_no_imovel: boolean
  observacao: string | null
  consumos_titular?: string[] | null
  atividade_no_imovel?: string | null
  titularidade_confirmada_em?: string | null
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
  finalidade?: Finalidade
  garantiaTipo?: string | null
  chavesEntreguesEm?: string | null
  prazoTitularidadeDiasUteis?: number | null
  seguradoraCiente?: { em: string | null; obs: string | null }
}

export function MoradoresSecao({
  contratoId, moradores, pessoasDisponiveis, inquilinoId, inquilinoEhPJ,
  finalidade = 'residencial', garantiaTipo = null, chavesEntreguesEm = null,
  prazoTitularidadeDiasUteis = PRAZO_TITULARIDADE_PADRAO, seguradoraCiente = { em: null, obs: null },
}: Props) {
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

  // Agrupa por papel, na ordem definida em PAPEIS
  const gruposPorPapel = PAPEIS
    .map(p => ({ papel: p.valor, itens: moradores.filter(m => m.papel === p.valor) }))
    .filter(g => g.itens.length > 0)

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
          {gruposPorPapel.map(g => (
            <GrupoVinculados
              key={g.papel}
              papel={g.papel}
              itens={g.itens}
              onRemover={remover}
              removendo={removendo}
              isPending={isPending}
              finalidade={finalidade}
              chavesEntreguesEm={chavesEntreguesEm}
              prazoTitularidadeDiasUteis={prazoTitularidadeDiasUteis ?? PRAZO_TITULARIDADE_PADRAO}
            />
          ))}
        </div>
      )}

      {garantiaTipo === 'seguro_fianca' && moradores.some(m => m.papel === 'ocupante_autorizado') && (
        <CienciaSeguradora contratoId={contratoId} ciente={seguradoraCiente} finalidade={finalidade} />
      )}

      {modalAberto && (
        <ModalAdicionar
          contratoId={contratoId}
          finalidade={finalidade}
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
  papel, itens, onRemover, removendo, isPending, finalidade, chavesEntreguesEm, prazoTitularidadeDiasUteis,
}: {
  papel: PapelVinculo
  itens: MoradorRow[]
  onRemover: (id: string, nome: string) => void
  removendo: string | null
  isPending: boolean
  finalidade: Finalidade
  chavesEntreguesEm: string | null
  prazoTitularidadeDiasUteis: number
}) {
  const info = infoPapel(papel, finalidade)
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
                {!m.mora_no_imovel && m.papel !== 'ocupante_autorizado' && (
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
              {m.papel === 'ocupante_autorizado' && (
                <UsuarioAutorizadoDetalhes
                  m={m}
                  finalidade={finalidade}
                  chavesEntreguesEm={chavesEntreguesEm}
                  prazoTitularidadeDiasUteis={prazoTitularidadeDiasUteis}
                />
              )}
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

// ── Usuário autorizado: responsabilidades, titularidade e seguradora ──

function UsuarioAutorizadoDetalhes({
  m, finalidade, chavesEntreguesEm, prazoTitularidadeDiasUteis,
}: {
  m: MoradorRow
  finalidade: Finalidade
  chavesEntreguesEm: string | null
  prazoTitularidadeDiasUteis: number
}) {
  const [editando, setEditando] = useState(false)
  const [comprovando, setComprovando] = useState(false)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const consumos = (m.consumos_titular ?? []) as Consumo[]
  const st = statusTitularidade({
    consumos_titular: consumos,
    titularidade_confirmada_em: m.titularidade_confirmada_em,
    chaves_entregues_em: chavesEntreguesEm,
    prazo_dias_uteis: prazoTitularidadeDiasUteis,
  })
  const nomesConsumo = consumos.map(c => CONSUMOS.find(x => x.valor === c)?.label ?? c).join(', ')

  const desfazer = () => {
    if (!confirm('Desfazer a confirmação da troca de titularidade?')) return
    const fd = new FormData()
    fd.set('morador_id', m.id)
    fd.set('desfazer', '1')
    startTransition(async () => {
      const r = await confirmarTitularidade(fd)
      if (r.error) { alert(r.error); return }
      router.refresh()
    })
  }

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded-full">assina como interveniente anuente</span>
        <span className="bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded-full">recebe as chaves</span>
        {m.atividade_no_imovel && (
          <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{m.atividade_no_imovel}</span>
        )}
        {consumos.length > 0 && (
          <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Zap size={10} /> titular de: {nomesConsumo}
          </span>
        )}
        {st.status === 'confirmada' && (
          <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 size={10} /> troca comprovada em {fmtDataBR(m.titularidade_confirmada_em)}
            <button type="button" onClick={desfazer} disabled={isPending} className="underline ml-1">desfazer</button>
          </span>
        )}
        {st.status === 'aguardando_chaves' && (
          <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">troca: prazo conta da entrega das chaves</span>
        )}
        {st.status === 'no_prazo' && (
          <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">troca pendente · prazo até {fmtDataBR(st.prazo_ate)}</span>
        )}
        {st.status === 'atrasada' && (
          <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <AlertTriangle size={10} /> troca atrasada · prazo era {fmtDataBR(st.prazo_ate)}
          </span>
        )}
      </div>
      <div className="flex gap-3 text-[11px]">
        <button type="button" onClick={() => setEditando(true)} className="text-violet-700 hover:underline flex items-center gap-1">
          <Pencil size={10} /> Responsabilidades
        </button>
        {consumos.length > 0 && st.status !== 'confirmada' && (
          <button type="button" onClick={() => setComprovando(true)} className="text-violet-700 hover:underline">
            Comprovar troca de titularidade
          </button>
        )}
      </div>
      {editando && (
        <ModalResponsabilidades
          m={m}
          finalidade={finalidade}
          prazoInicial={prazoTitularidadeDiasUteis}
          onFechar={() => setEditando(false)}
          onSucesso={() => { setEditando(false); router.refresh() }}
        />
      )}
      {comprovando && (
        <ModalComprovante
          titulo="Comprovar troca de titularidade"
          ajuda="A troca só conta como feita com o comprovante da concessionária. A cláusula assinada não basta."
          rotuloData="Data da transferência"
          arquivoObrigatorio
          campos={{ morador_id: m.id }}
          acao={confirmarTitularidade}
          onFechar={() => setComprovando(false)}
          onSucesso={() => { setComprovando(false); router.refresh() }}
        />
      )}
    </div>
  )
}

/** Checkboxes das contas + atividade. Usado no modal de adicionar e no de editar. */
function CamposResponsabilidade({
  finalidade, consumos, setConsumos, atividade, setAtividade,
}: {
  finalidade: Finalidade
  consumos: Consumo[]
  setConsumos: (c: Consumo[]) => void
  atividade: string
  setAtividade: (s: string) => void
}) {
  const alternar = (c: Consumo) =>
    setConsumos(consumos.includes(c) ? consumos.filter(x => x !== c) : [...consumos, c])
  return (
    <div className="space-y-3 border border-sky-100 bg-sky-50/40 rounded-lg p-3">
      <div>
        <p className="text-xs font-medium text-gray-700">Participação</p>
        <p className="text-[11px] text-gray-500 leading-snug">
          Assina como interveniente anuente, recebe as chaves e usa o imóvel. Não vira locatário, fiador
          nem devedor solidário do aluguel.
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-gray-700 mb-1">Contas que ficam no nome dele(a)</p>
        <div className="grid grid-cols-2 gap-1">
          {CONSUMOS.map(c => (
            <label key={c.valor} className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
              <input type="checkbox" checked={consumos.includes(c.valor)} onChange={() => alternar(c.valor)}
                className="w-4 h-4 accent-violet-600" />
              {c.label}
            </label>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          Marcada = obrigação de transferir a titularidade no prazo, com comprovante. Sem marcar, ele só fica autorizado a pedir.
        </p>
      </div>
      {finalidade !== 'residencial' && (
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Atividade no imóvel</label>
          <input value={atividade} onChange={e => setAtividade(e.target.value)} className={inputCls}
            placeholder="Ex: escritório de advocacia, OAB/MT nº 00000" maxLength={300} />
        </div>
      )}
    </div>
  )
}

function ModalResponsabilidades({
  m, finalidade, prazoInicial, onFechar, onSucesso,
}: {
  m: MoradorRow
  finalidade: Finalidade
  prazoInicial: number
  onFechar: () => void
  onSucesso: () => void
}) {
  const [consumos, setConsumos] = useState<Consumo[]>((m.consumos_titular ?? []) as Consumo[])
  const [atividade, setAtividade] = useState(m.atividade_no_imovel ?? '')
  const [prazo, setPrazo] = useState(String(prazoInicial))
  const [confirmo, setConfirmo] = useState(false)
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const salvar = () => {
    setErro('')
    if (!confirmo) { setErro('Confirme a alteração das responsabilidades.'); return }
    startTransition(async () => {
      const r = await salvarResponsabilidadesUsuario({
        morador_id: m.id,
        atividade_no_imovel: atividade || null,
        consumos_titular: consumos,
        prazo_titularidade_dias_uteis: consumos.length ? Number(prazo) : null,
      })
      if (r.error) { setErro(r.error); return }
      onSucesso()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl shadow-xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-gray-900">Responsabilidades · {m.pessoa?.nome}</h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <CamposResponsabilidade finalidade={finalidade} consumos={consumos} setConsumos={setConsumos}
          atividade={atividade} setAtividade={setAtividade} />
        {consumos.length > 0 && (
          <div className="mt-3">
            <label className="text-xs font-medium text-gray-700 block mb-1">Prazo da troca (dias úteis após a entrega das chaves)</label>
            <input type="number" min={1} max={90} value={prazo} onChange={e => setPrazo(e.target.value)} className={`${inputCls} w-28`} />
          </div>
        )}
        <label className="flex items-start gap-2 mt-3 cursor-pointer">
          <input type="checkbox" checked={confirmo} onChange={e => setConfirmo(e.target.checked)} className="w-4 h-4 mt-0.5 accent-violet-600" />
          <span className="text-[11px] text-gray-600">
            Confirmo a alteração. Ela muda as cláusulas do próximo PDF gerado e fica registrada no histórico do contrato.
          </span>
        </label>
        {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
          <button onClick={onFechar} disabled={isPending} className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100">Cancelar</button>
          <button onClick={salvar} disabled={isPending}
            className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            {isPending && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

/** Data + observação + arquivo, enviado pra uma server action que recebe FormData. */
function ModalComprovante({
  titulo, ajuda, rotuloData, arquivoObrigatorio = false, comObs = false, campos, acao, onFechar, onSucesso,
}: {
  titulo: string
  ajuda: string
  rotuloData: string
  arquivoObrigatorio?: boolean
  comObs?: boolean
  campos: Record<string, string>
  acao: (fd: FormData) => Promise<{ error?: string; ok?: boolean }>
  onFechar: () => void
  onSucesso: () => void
}) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [erro, setErro] = useState('')
  const [isPending, startTransition] = useTransition()

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErro('')
    const fd = new FormData(e.currentTarget)
    for (const [k, v] of Object.entries(campos)) fd.set(k, v)
    startTransition(async () => {
      const r = await acao(fd)
      if (r.error) { setErro(r.error); return }
      onSucesso()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <form onSubmit={enviar} className="bg-white rounded-2xl shadow-xl p-5 max-w-md w-full space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h3 className="font-bold text-gray-900">{titulo}</h3>
          <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-[11px] text-gray-500">{ajuda}</p>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">{rotuloData}</label>
          <input type="date" name="data" defaultValue={hoje} required className={inputCls} />
        </div>
        {comObs && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Observação</label>
            <textarea name="obs" rows={2} className={`${inputCls} resize-y`} placeholder="Ex: e-mail da Tokio Marine confirmando, protocolo nº ..." />
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Comprovante (PDF ou imagem){arquivoObrigatorio ? ' *' : ''}
          </label>
          <input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" required={arquivoObrigatorio}
            className="text-xs text-gray-600" />
        </div>
        {erro && <p className="text-xs text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
          <button type="button" onClick={onFechar} disabled={isPending} className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100">Cancelar</button>
          <button type="submit" disabled={isPending}
            className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            {isPending && <Loader2 size={14} className="animate-spin" />} Registrar
          </button>
        </div>
      </form>
    </div>
  )
}

function CienciaSeguradora({
  contratoId, ciente, finalidade,
}: {
  contratoId: string
  ciente: { em: string | null; obs: string | null }
  finalidade: Finalidade
}) {
  const [aberto, setAberto] = useState(false)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const rot = rotuloUsuarioAutorizado(finalidade).toLowerCase()

  const desfazer = () => {
    if (!confirm('Desfazer o registro de ciência da seguradora?')) return
    const fd = new FormData()
    fd.set('contrato_id', contratoId)
    fd.set('desfazer', '1')
    startTransition(async () => {
      const r = await registrarCienciaSeguradora(fd)
      if ('error' in r) { alert(r.error); return }
      router.refresh()
    })
  }

  if (ciente.em) {
    return (
      <div className="mt-3 text-[11px] bg-emerald-50 text-emerald-800 rounded-lg px-3 py-2 flex items-start gap-2">
        <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
        <span className="flex-1">
          Seguradora ciente do {rot} em {fmtDataBR(ciente.em)}{ciente.obs ? ` — ${ciente.obs}` : ''}.
        </span>
        <button type="button" onClick={desfazer} disabled={isPending} className="underline">desfazer</button>
      </div>
    )
  }
  return (
    <div className="mt-3 text-[11px] bg-amber-50 text-amber-800 rounded-lg px-3 py-2 flex items-start gap-2">
      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      <span className="flex-1">
        O seguro fiança foi aprovado em nome do locatário, mas o imóvel será usado pelo {rot}. Informe a
        seguradora e registre aqui a ciência dela. Até lá o contrato fica com alerta no checklist.
      </span>
      <button type="button" onClick={() => setAberto(true)} className="underline font-semibold whitespace-nowrap">Registrar ciência</button>
      {aberto && (
        <ModalComprovante
          titulo="Ciência da seguradora"
          ajuda="Registre quando e como a seguradora foi informada. O comprovante (e-mail, aceite) é opcional, mas recomendado."
          rotuloData="Data da ciência"
          comObs
          campos={{ contrato_id: contratoId }}
          acao={registrarCienciaSeguradora}
          onFechar={() => setAberto(false)}
          onSucesso={() => { setAberto(false); router.refresh() }}
        />
      )}
    </div>
  )
}

function ModalAdicionar({
  contratoId, pessoasDisponiveis, inquilinoEhPJ, finalidade, onFechar, onSucesso,
}: {
  contratoId: string
  pessoasDisponiveis: PessoaOpcao[]
  inquilinoEhPJ: boolean
  finalidade: Finalidade
  onFechar: () => void
  onSucesso: () => void
}) {
  const [papel, setPapel] = useState<PapelVinculo>(inquilinoEhPJ ? 'socio_signatario' : 'morador')
  const [consumos, setConsumos] = useState<Consumo[]>([])
  const [atividade, setAtividade] = useState('')
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
    setMoraNoImovel(novo === 'morador' || novo === 'ocupante_autorizado')
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
      ...(papel === 'ocupante_autorizado' ? { consumos_titular: consumos, atividade_no_imovel: atividade || null } : {}),
    }
    startTransition(async () => {
      const r = await adicionarMorador(payload)
      if (r.error) { setErro(r.error); return }
      onSucesso()
    })
  }

  const papelInfo = infoPapel(papel, finalidade)

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
              {PAPEIS.map(p0 => {
                const p = infoPapel(p0.valor, finalidade)
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

          {papel === 'ocupante_autorizado' && (
            <CamposResponsabilidade finalidade={finalidade} consumos={consumos} setConsumos={setConsumos}
              atividade={atividade} setAtividade={setAtividade} />
          )}

          {papel !== 'morador' && papel !== 'ocupante_autorizado' && (
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
