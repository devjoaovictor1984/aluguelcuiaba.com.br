'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  AlertTriangle, HelpCircle, Lightbulb, ThumbsUp, Plus, Copy, Check, Ban,
  Loader2, ChevronDown, ChevronRight, CircleCheck, RotateCcw, Link2, Clock,
} from 'lucide-react'
import {
  abrirSessaoHomologacao, revogarSessaoHomologacao,
  resolverApontamento, reabrirApontamento,
} from '../actions'

interface Sessao {
  id: string
  nome: string
  organizacao: string | null
  observacao: string | null
  token: string
  expiraEm: string
  revogadaEm: string | null
  primeiroAcessoEm: string | null
  ultimoAcessoEm: string | null
  acessos: number
  criadaEm: string
}

interface Apontamento {
  id: string
  sessaoId: string
  tipo: string
  titulo: string
  detalhe: string | null
  contexto: unknown
  eventos: unknown
  resolvidoEm: string | null
  resolucao: string | null
  criadoEm: string
}

const TIPO_UI: Record<string, { label: string; icone: typeof AlertTriangle; cls: string }> = {
  erro:     { label: 'Está errado', icone: AlertTriangle, cls: 'bg-rose-50 text-rose-700 ring-rose-100' },
  duvida:   { label: 'Dúvida',      icone: HelpCircle,    cls: 'bg-amber-50 text-amber-700 ring-amber-100' },
  sugestao: { label: 'Sugestão',    icone: Lightbulb,     cls: 'bg-violet-50 text-violet-700 ring-violet-100' },
  ok:       { label: 'Está certo',  icone: ThumbsUp,      cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
}

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

/** Fora do componente: `Date.now()` no corpo do render viola react-hooks/purity. */
function jaVenceu(iso: string): boolean {
  return new Date(iso).getTime() < Date.now()
}

export function PainelHomologacao({ sessoes, apontamentos, baseUrl }: {
  sessoes: Sessao[]
  apontamentos: Apontamento[]
  baseUrl: string
}) {
  const [criando, setCriando] = useState(false)
  const [filtro, setFiltro] = useState<'abertos' | 'todos'>('abertos')
  const [erro, setErro] = useState('')

  const porSessao = useMemo(
    () => new Map(sessoes.map(s => [s.id, s])),
    [sessoes],
  )

  const lista = apontamentos.filter(a => filtro === 'todos' || !a.resolvidoEm)
  const abertos = apontamentos.filter(a => !a.resolvidoEm).length

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Homologação</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Acessos temporários para a equipe da corretora, e o que eles anotaram.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCriando(v => !v)}
          className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
        >
          <Plus size={15} /> Novo acesso
        </button>
      </div>

      {erro && <p className="text-sm text-rose-700 bg-rose-50 rounded-xl px-4 py-3">{erro}</p>}

      {criando && <FormNovoAcesso baseUrl={baseUrl} onErro={setErro} onPronto={() => setCriando(false)} />}

      {/* Sessões */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-900">Acessos</h2>
        {sessoes.length === 0 ? (
          <div className="rounded-2xl bg-white ring-1 ring-gray-100 p-8 text-center">
            <p className="text-sm text-gray-500">Nenhum acesso criado ainda.</p>
          </div>
        ) : (
          sessoes.map(s => <CartaoSessao key={s.id} sessao={s} baseUrl={baseUrl} onErro={setErro} />)
        )}
      </section>

      {/* Apontamentos */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900">
            Anotações {abertos > 0 && <span className="text-gray-400 font-medium">· {abertos} em aberto</span>}
          </h2>
          <div className="flex gap-1 text-xs">
            {(['abertos', 'todos'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`px-2.5 py-1 rounded-lg font-semibold ${
                  filtro === f ? 'bg-violet-700 text-white' : 'bg-white ring-1 ring-gray-200 text-gray-600'
                }`}
              >
                {f === 'abertos' ? 'Em aberto' : 'Todas'}
              </button>
            ))}
          </div>
        </div>

        {lista.length === 0 ? (
          <div className="rounded-2xl bg-white ring-1 ring-gray-100 p-8 text-center">
            <p className="text-sm text-gray-500">
              {filtro === 'abertos' ? 'Nada em aberto.' : 'Nenhuma anotação ainda.'}
            </p>
          </div>
        ) : (
          lista.map(a => (
            <CartaoApontamento
              key={a.id}
              apontamento={a}
              sessao={porSessao.get(a.sessaoId)}
              onErro={setErro}
            />
          ))
        )}
      </section>
    </div>
  )
}

/* ── Novo acesso ───────────────────────────────────────────────────── */

function FormNovoAcesso({ baseUrl, onErro, onPronto }: {
  baseUrl: string
  onErro: (e: string) => void
  onPronto: () => void
}) {
  const [nome, setNome] = useState('')
  const [organizacao, setOrganizacao] = useState('Maximiza Seguros')
  const [observacao, setObservacao] = useState('')
  const [dias, setDias] = useState(14)
  const [link, setLink] = useState('')
  const [isPending, startTransition] = useTransition()

  const input = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-900'

  const criar = () => {
    onErro('')
    startTransition(async () => {
      const r = await abrirSessaoHomologacao({ nome, organizacao, observacao, dias })
      if (r.error) { onErro(r.error); return }
      setLink(`${baseUrl}/homologacao/${r.token}`)
    })
  }

  if (link) {
    return (
      <section className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-4 space-y-2.5">
        <h3 className="text-sm font-bold text-emerald-900">Acesso criado</h3>
        <p className="text-xs text-emerald-800">
          Este link aparece <strong>uma vez</strong> em destaque, mas continua
          disponível no cartão do acesso abaixo. Quem abrir entra direto — trate
          como senha.
        </p>
        <CopiarLink link={link} />
        <button
          type="button"
          onClick={onPronto}
          className="text-xs font-semibold text-emerald-800 underline"
        >
          Fechar
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4 space-y-3">
      <h3 className="text-sm font-bold text-gray-900">Novo acesso</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Para quem</label>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Equipe técnica" className={input} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Organização</label>
          <input value={organizacao} onChange={e => setOrganizacao(e.target.value)} className={input} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Validade (dias)</label>
          <input
            type="number" min={1} max={90} value={dias}
            onChange={e => setDias(parseInt(e.target.value, 10) || 1)}
            className={input}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Observação <span className="text-gray-400">(só você vê)</span>
          </label>
          <input value={observacao} onChange={e => setObservacao(e.target.value)} className={input} />
        </div>
      </div>
      <button
        type="button"
        onClick={criar}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-700 hover:bg-violet-800 disabled:opacity-50 py-3 text-sm font-bold text-white"
      >
        {isPending ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
        {isPending ? 'Criando…' : 'Gerar link'}
      </button>
    </section>
  )
}

function CopiarLink({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(link)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1800)
      }}
      className="w-full flex items-center gap-2 rounded-xl bg-white ring-1 ring-gray-200 px-3 py-2.5 text-left hover:ring-violet-300"
    >
      {copiado ? <Check size={14} className="text-emerald-600 shrink-0" /> : <Copy size={14} className="text-gray-400 shrink-0" />}
      <code className="text-[11px] text-gray-700 truncate flex-1">{link}</code>
      <span className="text-[11px] font-bold text-violet-700 shrink-0">
        {copiado ? 'copiado' : 'copiar'}
      </span>
    </button>
  )
}

/* ── Sessão ────────────────────────────────────────────────────────── */

function CartaoSessao({ sessao: s, baseUrl, onErro }: {
  sessao: Sessao
  baseUrl: string
  onErro: (e: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [aberto, setAberto] = useState(false)

  const venceu = jaVenceu(s.expiraEm)
  const ativa = !s.revogadaEm && !venceu

  const revogar = () => {
    onErro('')
    startTransition(async () => {
      const r = await revogarSessaoHomologacao(s.id)
      if (r.error) onErro(r.error)
    })
  }

  return (
    <div className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">
            {s.nome}
            {s.organizacao && <span className="font-normal text-gray-500"> · {s.organizacao}</span>}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
            <Clock size={10} />
            {ativa ? `vence em ${dataHora(s.expiraEm)}` : s.revogadaEm ? 'revogado' : 'vencido'}
            {' · '}
            {s.acessos > 0 ? `${s.acessos} acesso(s), último ${dataHora(s.ultimoAcessoEm)}` : 'nunca aberto'}
          </p>
          {s.observacao && <p className="text-[11px] text-gray-400 mt-0.5">{s.observacao}</p>}
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
          ativa ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {ativa ? 'ativo' : 'encerrado'}
        </span>
      </div>

      {ativa && (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => setAberto(v => !v)}
            className="text-xs font-semibold text-violet-700 flex items-center gap-1"
          >
            {aberto ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Ver o link
          </button>
          {aberto && <CopiarLink link={`${baseUrl}/homologacao/${s.token}`} />}
          <button
            type="button"
            onClick={revogar}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 disabled:opacity-50"
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
            Revogar agora
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Apontamento ───────────────────────────────────────────────────── */

function CartaoApontamento({ apontamento: a, sessao, onErro }: {
  apontamento: Apontamento
  sessao?: Sessao
  onErro: (e: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [resolucao, setResolucao] = useState('')
  const [isPending, startTransition] = useTransition()

  const ui = TIPO_UI[a.tipo] ?? TIPO_UI.duvida
  const Icone = ui.icone
  const ctx = (a.contexto ?? {}) as Record<string, unknown>

  const resolver = () => {
    onErro('')
    startTransition(async () => {
      const r = await resolverApontamento(a.id, resolucao)
      if (r.error) onErro(r.error)
    })
  }

  const reabrir = () => {
    onErro('')
    startTransition(async () => {
      const r = await reabrirApontamento(a.id)
      if (r.error) onErro(r.error)
    })
  }

  return (
    <div className={`rounded-2xl bg-white ring-1 shadow-sm p-4 ${
      a.resolvidoEm ? 'ring-gray-100 opacity-70' : 'ring-gray-100'
    }`}>
      <div className="flex items-start gap-2.5">
        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold ring-1 shrink-0 ${ui.cls}`}>
          <Icone size={11} /> {ui.label}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold text-gray-900 ${a.resolvidoEm ? 'line-through' : ''}`}>
            {a.titulo}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {sessao?.nome ?? 'sessão removida'} · {dataHora(a.criadoEm)}
            {typeof ctx.rota === 'string' && <> · <code className="text-gray-600">{ctx.rota}</code></>}
          </p>
          {a.detalhe && (
            <p className="text-sm text-gray-600 leading-snug mt-1.5 whitespace-pre-wrap">{a.detalhe}</p>
          )}
        </div>
      </div>

      {/* Contexto — o que estava na tela quando escreveram */}
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {ctx.produto ? <Etiqueta>{String(ctx.produto)}</Etiqueta> : null}
        {ctx.seguradora ? <Etiqueta>{String(ctx.seguradora)}</Etiqueta> : null}
        {ctx.status ? <Etiqueta>status: {String(ctx.status)}</Etiqueta> : null}
        {ctx.maximizaId ? <Etiqueta>análise {String(ctx.maximizaId)}</Etiqueta> : null}
        {ctx.codigoSeguro ? <Etiqueta>seguro {String(ctx.codigoSeguro)}</Etiqueta> : null}
      </div>

      {!!a.eventos && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setAberto(v => !v)}
            className="text-xs font-semibold text-violet-700 flex items-center gap-1"
          >
            {aberto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Chamadas à API no momento da anotação
          </button>
          {aberto && (
            <pre className="mt-2 text-[10px] bg-gray-900 text-gray-100 rounded-xl p-3 overflow-x-auto max-h-80 overflow-y-auto">
              {JSON.stringify(a.eventos, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-50">
        {a.resolvidoEm ? (
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] text-emerald-700 flex items-start gap-1.5">
              <CircleCheck size={12} className="mt-0.5 shrink-0" />
              <span>
                Tratado em {dataHora(a.resolvidoEm)}
                {a.resolucao && <> — {a.resolucao}</>}
              </span>
            </p>
            <button
              type="button"
              onClick={reabrir}
              disabled={isPending}
              className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1 shrink-0"
            >
              <RotateCcw size={11} /> Reabrir
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={resolucao}
              onChange={e => setResolucao(e.target.value)}
              placeholder="O que foi feito (opcional)"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-xs text-gray-900"
            />
            <button
              type="button"
              onClick={resolver}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-50 px-3 py-2 text-xs font-bold text-white shrink-0"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <CircleCheck size={12} />}
              Tratado
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold bg-gray-50 text-gray-600 rounded-md px-1.5 py-0.5">
      {children}
    </span>
  )
}
