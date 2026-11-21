import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Plus, ExternalLink, Eye, Megaphone, KeyRound, RefreshCw, AlertCircle, CheckCircle2,
  ShieldCheck, List, Radio, Briefcase, UserCircle2, ChevronRight, Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getPerfil } from '@/lib/supabase/queries'
import { thumbSupabase } from '@/lib/img-thumb'
import { formatarPreco } from '@/lib/utils'
import { PLANOS } from '@/lib/constants'
import { PlanoActions } from './_components/plano-actions'

/**
 * Visão geral do painel (reformulada em 21/11/2026 — docs/painel-anuncios.md).
 *
 * Ordem pensada pra responder, de cima pra baixo: "tem algo pra eu resolver?",
 * "como estão meus anúncios?", "pra onde eu vou daqui?". Antes os avisos de
 * anúncio parado apareciam duas vezes, "Sair"/"Ver site" repetiam o menu e o
 * contador do plano usava o total, enquanto o limite conta ativo + alugado.
 */

const DIA = 86_400_000

interface ImovelResumo {
  id: string
  titulo: string
  status: string
  preco: number
  expira_em: string
  updated_at: string
  visualizacoes: number | null
  avisos_silenciados_ate: string | null
  fotos: Array<{ url: string }> | null
}

export default async function PainelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  // Só o que a tela usa, e UMA foto por anúncio (antes vinham todas).
  const [{ data: dados }, { data: perfil }] = await Promise.all([
    supabase
      .from('imoveis')
      .select('id, titulo, status, preco, expira_em, updated_at, visualizacoes, avisos_silenciados_ate, fotos(url, principal, ordem)')
      .eq('user_id', user.id)
      .order('principal', { referencedTable: 'fotos', ascending: false })
      .order('ordem', { referencedTable: 'fotos' })
      .limit(1, { referencedTable: 'fotos' })
      .order('updated_at', { ascending: false }),
    getPerfil(user.id),
  ])
  const lista = (dados ?? []) as unknown as ImovelResumo[]

  // eslint-disable-next-line react-hooks/purity -- server component dinâmico; data do request
  const agora = Date.now()
  const vencido = (i: ImovelResumo) => i.status === 'expirado' || (i.status === 'ativo' && new Date(i.expira_em).getTime() < agora)
  const noAr = lista.filter(i => i.status === 'ativo' && !vencido(i))
  const alugados = lista.filter(i => i.status === 'alugado').length
  const aRenovar = lista.filter(i => vencido(i) || (i.status === 'ativo' && new Date(i.expira_em).getTime() - agora <= 7 * DIA)).length
  const visitas = lista.reduce((s, i) => s + (i.visualizacoes ?? 0), 0)

  // Parado = no ar e sem edição há 30+ dias (respeita o "silenciar avisos").
  const parados = noAr
    .filter(i => !i.avisos_silenciados_ate || new Date(i.avisos_silenciados_ate).getTime() < agora)
    .map(i => ({ ...i, dias: Math.floor((agora - new Date(i.updated_at).getTime()) / DIA) }))
    .filter(i => i.dias >= 30)
    .sort((a, b) => b.dias - a.dias)

  // ── Conta / plano ──
  const isAdmin = perfil?.role === 'admin'
  const plano = (perfil?.plano ?? 'free') as keyof typeof PLANOS
  const nomePlano = PLANOS[plano]?.nome ?? 'Gratuito'
  const limite = PLANOS[plano]?.imoveis ?? 1
  const ilimitado = isAdmin || limite >= 999
  // Mesma conta do /painel/anuncios/novo: ocupa vaga o que está publicado ou alugado.
  const ocupados = lista.filter(i => i.status === 'ativo' || i.status === 'alugado').length
  const atingiuLimite = !ilimitado && ocupados >= limite
  const crmAtivo = !!(perfil as { crm_ativo?: boolean } | null)?.crm_ativo
  const podeUsarCRM = isAdmin || crmAtivo || plano === 'basico' || plano === 'profissional'

  const nome = perfil?.nome ?? user.email ?? ''
  const primeiroNome = nome.split(/[\s@]/)[0] || 'por aqui'
  const iniciais = nome.split(' ').slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join('')
  const camposFaltando = [
    !perfil?.nome && 'nome completo',
    !perfil?.cpf && 'CPF',
    !perfil?.telefone && 'telefone',
    !perfil?.endereco_logradouro && 'endereço',
    !perfil?.foto_url && 'foto de perfil',
  ].filter(Boolean) as string[]

  // ── "Precisa da sua atenção": tudo que pede ação, num lugar só ──
  type Tarefa = { tom: 'vermelho' | 'ambar'; titulo: string; detalhe: string; href: string; acao: string }
  const tarefas: Tarefa[] = []
  if (camposFaltando.length) {
    tarefas.push({
      tom: 'ambar', titulo: 'Complete seu cadastro',
      detalhe: `Falta: ${camposFaltando.join(', ')}. Sem isso o anúncio passa menos confiança.`,
      href: '/painel/perfil', acao: 'Completar',
    })
  }
  if (aRenovar > 0) {
    tarefas.push({
      tom: 'vermelho', titulo: `${aRenovar} anúncio${aRenovar === 1 ? '' : 's'} para renovar`,
      detalhe: 'Vencidos ou vencendo em até 7 dias. Vencido sai do site.',
      href: '/painel/anuncios?status=expirado', acao: 'Renovar',
    })
  }
  if (parados.length > 0) {
    tarefas.push({
      tom: parados[0].dias >= 60 ? 'vermelho' : 'ambar',
      titulo: `${parados.length} anúncio${parados.length === 1 ? '' : 's'} sem atualização há 30+ dias`,
      detalhe: `Anúncio atualizado sobe na busca. Mais antigo: “${parados[0].titulo}” (${parados[0].dias} dias).`,
      href: parados.length === 1 ? `/painel/anuncios/${parados[0].id}/editar` : '/painel/anuncios?status=ativo&ordem=atualizados',
      acao: 'Revisar',
    })
  }
  if (atingiuLimite) {
    tarefas.push({
      tom: 'ambar', titulo: `Limite do plano ${nomePlano} atingido`,
      detalhe: `${ocupados} de ${limite} vaga${limite === 1 ? '' : 's'} em uso. Para publicar outro, faça upgrade ou pause um anúncio.`,
      href: '/planos', acao: 'Ver planos',
    })
  }

  // Os 4 mais recentes mexidos (a consulta já vem por updated_at).
  const recentes = lista.slice(0, 4)

  const STATUS: Record<string, { label: string; cls: string }> = {
    ativo: { label: 'No ar', cls: 'text-green-700 bg-green-50' },
    alugado: { label: 'Alugado', cls: 'text-teal-700 bg-teal-50' },
    pausado: { label: 'Pausado', cls: 'text-gray-600 bg-gray-100' },
    expirado: { label: 'Expirado', cls: 'text-red-700 bg-red-50' },
    rascunho: { label: 'Rascunho', cls: 'text-amber-700 bg-amber-50' },
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 pb-24">

      {/* Saudação + ações principais */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Olá, {primeiroNome}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {lista.length === 0 ? 'Vamos publicar seu primeiro imóvel?' : 'Este é o resumo dos seus anúncios.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:border-violet-300 hover:text-violet-700 px-3.5 py-2.5 rounded-xl">
            <ExternalLink size={15} /> Ver site
          </a>
          {atingiuLimite ? (
            <Link href="/planos" className="inline-flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm">
              <Plus size={16} /> Ver planos
            </Link>
          ) : (
            <Link href="/painel/anuncios/novo" className="inline-flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm">
              <Plus size={16} /> Novo anúncio
            </Link>
          )}
        </div>
      </div>

      {/* Precisa da sua atenção */}
      <section className="mb-6" aria-labelledby="atencao">
        <h2 id="atencao" className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Precisa da sua atenção</h2>
        {tarefas.length === 0 ? (
          <div className="flex items-center gap-2.5 bg-green-50 ring-1 ring-green-200 text-green-800 text-sm rounded-2xl px-4 py-3">
            <CheckCircle2 size={18} className="shrink-0" />
            <span className="font-medium">Tudo em dia. Nenhum anúncio vencendo ou parado.</span>
          </div>
        ) : (
          <ul className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {tarefas.map(t => (
              <li key={t.titulo}>
                <Link href={t.href} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors rounded-2xl">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${t.tom === 'vermelho' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                    <AlertCircle size={16} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">{t.titulo}</span>
                    <span className="block text-xs text-gray-500 line-clamp-2">{t.detalhe}</span>
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-0.5 text-xs font-semibold text-violet-700">
                    {t.acao} <ChevronRight size={14} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Indicadores — atalhos pra lista filtrada */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Indicador href="/painel/anuncios?status=ativo" icone={<Megaphone size={16} />} cor="text-green-600 bg-green-50" valor={noAr.length} rotulo="No ar" />
        <Indicador href="/painel/anuncios?status=alugado" icone={<KeyRound size={16} />} cor="text-teal-600 bg-teal-50" valor={alugados} rotulo="Alugados" />
        <Indicador href="/painel/anuncios?status=expirado" icone={<RefreshCw size={16} />} cor="text-amber-600 bg-amber-50" valor={aRenovar} rotulo="A renovar" />
        <Indicador href="/painel/anuncios?ordem=visitas" icone={<Eye size={16} />} cor="text-violet-600 bg-violet-50" valor={visitas} rotulo="Visitas" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {/* Atalhos */}
        <section className="lg:col-span-2" aria-labelledby="atalhos">
          <h2 id="atalhos" className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Atalhos</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Atalho href="/painel/anuncios" icone={<List size={18} />} titulo="Meus anúncios" texto={`${lista.length} no total · editar, pausar, renovar`} />
            <Atalho href="/painel/anuncios/portais" icone={<Radio size={18} />} titulo="Portais" texto="Publicar no OLX, ZAP e Viva Real" />
            {podeUsarCRM && (
              <Atalho href="/painel/inicio" icone={<Briefcase size={18} />} titulo="CRM Locação" texto="Contratos, parcelas, recibos e repasses" destaque />
            )}
            <Atalho href="/painel/perfil" icone={<UserCircle2 size={18} />} titulo="Meu perfil" texto="Dados, foto e WhatsApp dos anúncios" />
          </div>
        </section>

        {/* Conta */}
        <section aria-labelledby="conta">
          <h2 id="conta" className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Sua conta</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <Link href="/painel/perfil" className="w-12 h-12 rounded-full overflow-hidden bg-violet-100 flex items-center justify-center shrink-0 ring-2 ring-violet-100">
                {perfil?.foto_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={perfil.foto_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-base font-bold text-violet-700">{iniciais || '?'}</span>}
              </Link>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1">
                  {perfil?.nome ?? 'Sem nome'}
                  {isAdmin && <ShieldCheck size={13} className="text-violet-500 shrink-0" />}
                </p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              {isAdmin ? (
                <>
                  <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide flex items-center gap-1">
                    <ShieldCheck size={12} /> Administrador · ilimitado
                  </p>
                  <Link href="/admin" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline">
                    Abrir painel admin <ChevronRight size={13} />
                  </Link>
                </>
              ) : (
                <>
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Plano {nomePlano}</p>
                    <p className="text-xs text-gray-500">
                      {ocupados}/{ilimitado ? '∞' : limite} vaga{limite === 1 ? '' : 's'}
                    </p>
                  </div>
                  {!ilimitado && (
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden" aria-hidden>
                      <div
                        className={`h-full rounded-full ${atingiuLimite ? 'bg-amber-500' : 'bg-violet-600'}`}
                        style={{ width: `${Math.min(100, (ocupados / Math.max(1, limite)) * 100)}%` }}
                      />
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1.5">Ocupa vaga o anúncio no ar ou alugado.</p>
                  <div className="mt-3">
                    {plano === 'free'
                      ? <Link href="/planos" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline">Fazer upgrade <ChevronRight size={13} /></Link>
                      : <PlanoActions plano={plano} />}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Últimos anúncios mexidos */}
      <section aria-labelledby="recentes">
        <div className="flex items-center justify-between mb-2">
          <h2 id="recentes" className="text-xs font-bold uppercase tracking-wider text-gray-400">Mexidos por último</h2>
          {lista.length > 0 && (
            <Link href="/painel/anuncios" className="text-xs font-semibold text-violet-700 hover:underline">Ver todos</Link>
          )}
        </div>
        {recentes.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 text-center py-10 px-4">
            <p className="font-semibold text-gray-700 mb-1">Nenhum anúncio ainda</p>
            <p className="text-sm text-gray-500 mb-4">Publique seu primeiro imóvel e comece a receber contatos.</p>
            <Link href="/painel/anuncios/novo" className="inline-flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">
              <Plus size={15} /> Publicar anúncio
            </Link>
          </div>
        ) : (
          <ul className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {recentes.map(im => {
              const st = STATUS[vencido(im) ? 'expirado' : im.status] ?? { label: im.status, cls: 'text-gray-600 bg-gray-100' }
              const foto = im.fotos?.[0]?.url
              const dias = Math.floor((agora - new Date(im.updated_at).getTime()) / DIA)
              return (
                <li key={im.id}>
                  <Link href={`/painel/anuncios/${im.id}/editar`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors rounded-2xl">
                    <span className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                      {foto
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={thumbSupabase(foto, 120)} alt="" loading="lazy" className="w-full h-full object-cover" />
                        : <span className="text-lg">🏠</span>}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-900 truncate">{im.titulo}</span>
                      <span className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-semibold text-gray-700">{formatarPreco(im.preco)}</span>
                        <span className="inline-flex items-center gap-0.5"><Clock size={11} />{dias === 0 ? 'hoje' : `há ${dias}d`}</span>
                      </span>
                    </span>
                    <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}

function Indicador({ href, icone, cor, valor, rotulo }: {
  href: string; icone: React.ReactNode; cor: string; valor: number; rotulo: string
}) {
  return (
    <Link href={href} className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 hover:border-violet-200 transition-colors">
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${cor}`}>{icone}</span>
      <span>
        <span className="block text-lg font-bold text-gray-900 leading-tight">{valor.toLocaleString('pt-BR')}</span>
        <span className="block text-xs text-gray-500">{rotulo}</span>
      </span>
    </Link>
  )
}

function Atalho({ href, icone, titulo, texto, destaque }: {
  href: string; icone: React.ReactNode; titulo: string; texto: string; destaque?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-colors ${
        destaque
          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm'
          : 'bg-white border border-gray-100 shadow-sm hover:border-violet-200'
      }`}
    >
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${destaque ? 'bg-white/15' : 'bg-violet-50 text-violet-600'}`}>
        {icone}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-semibold ${destaque ? '' : 'text-gray-900'}`}>{titulo}</span>
        <span className={`block text-xs truncate ${destaque ? 'text-violet-100' : 'text-gray-500'}`}>{texto}</span>
      </span>
      <ChevronRight size={16} className={destaque ? 'opacity-70' : 'text-gray-300'} />
    </Link>
  )
}
