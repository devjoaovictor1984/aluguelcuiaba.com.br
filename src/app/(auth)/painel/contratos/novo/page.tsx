import Link from 'next/link'
import {
  ArrowLeft, Lock, Building2, Users, Coins, ScrollText, ShieldOff,
  Handshake, Home, FilePlus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoCRM } from '@/lib/crm/acesso'
import { PLANOS } from '@/lib/constants'
import { WizardContrato } from './_components/wizard-contrato'

interface TemplateDefaults {
  tipo_atuacao: 'administracao' | 'intermediacao' | 'direto'
  garantia_tipo: 'fiador' | 'caucao' | 'seguro_fianca' | 'sem_garantia'
  /** Orienta o usuário a adicionar um Responsável pelo seguro (terceiro que não mora). */
  terceiro_seguro?: boolean
}

const TEMPLATES: Record<string, TemplateDefaults> = {
  'admin-seguro':          { tipo_atuacao: 'administracao', garantia_tipo: 'seguro_fianca' },
  'admin-seguro-terceiro': { tipo_atuacao: 'administracao', garantia_tipo: 'seguro_fianca', terceiro_seguro: true },
  'admin-caucao':          { tipo_atuacao: 'administracao', garantia_tipo: 'caucao' },
  'admin-fiador':          { tipo_atuacao: 'administracao', garantia_tipo: 'fiador' },
  'admin-sem':             { tipo_atuacao: 'administracao', garantia_tipo: 'sem_garantia' },
  'inter-seguro':          { tipo_atuacao: 'intermediacao', garantia_tipo: 'seguro_fianca' },
  'inter-caucao':          { tipo_atuacao: 'intermediacao', garantia_tipo: 'caucao' },
  'inter-fiador':          { tipo_atuacao: 'intermediacao', garantia_tipo: 'fiador' },
  'direto':                { tipo_atuacao: 'direto',        garantia_tipo: 'sem_garantia' },
}

// Cards visuais (ícones lucide, mantendo a identidade do sistema)
const TEMPLATE_CARDS = [
  { id: 'admin-seguro',          label: 'Administração + Seguro Fiança',           desc: 'Você administra · inquilino passa o seguro',     icone: Building2,  cor: 'violet' },
  { id: 'admin-seguro-terceiro', label: 'Administração + Seguro c/ Terceiro',      desc: 'Seguro passado por 3º (ex: pai), filho mora',    icone: Users,      cor: 'violet' },
  { id: 'admin-caucao',          label: 'Administração + Caução',                  desc: 'Você administra · garantia em dinheiro',         icone: Coins,      cor: 'violet' },
  { id: 'admin-fiador',          label: 'Administração + Fiador',                  desc: 'Você administra · fiador pessoa física',         icone: ScrollText, cor: 'violet' },
  { id: 'admin-sem',             label: 'Administração sem Garantia',              desc: 'Você administra · sem garantia locatícia',       icone: ShieldOff,  cor: 'violet' },
  { id: 'inter-seguro',          label: 'Intermediação + Seguro Fiança',          desc: 'Só intermediou · com seguro fiança',             icone: Handshake,  cor: 'sky' },
  { id: 'inter-caucao',          label: 'Intermediação + Caução',                 desc: 'Só intermediou · com caução',                    icone: Handshake,  cor: 'sky' },
  { id: 'inter-fiador',          label: 'Intermediação + Fiador',                 desc: 'Só intermediou · com fiador',                    icone: Handshake,  cor: 'sky' },
  { id: 'direto',                label: 'Direto Proprietário × Locatário',        desc: 'Sem corretor · contrato direto',                 icone: Home,       cor: 'emerald' },
  { id: 'personalizado',         label: 'Contrato Personalizado',                 desc: 'Começa em branco · você escolhe tudo',           icone: FilePlus,   cor: 'gray' },
] as const

const CARD_CLASSES: Record<string, string> = {
  violet:  'border-violet-100 hover:border-violet-400 hover:bg-violet-50 text-violet-700',
  sky:     'border-sky-100 hover:border-sky-400 hover:bg-sky-50 text-sky-700',
  emerald: 'border-emerald-100 hover:border-emerald-400 hover:bg-emerald-50 text-emerald-700',
  gray:    'border-gray-200 hover:border-gray-400 hover:bg-gray-50 text-gray-700',
}

export default async function NovoContratoPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>
}) {
  const acesso = await exigirAcessoCRM()
  const supabase = await createClient()
  const { template } = await searchParams
  const templateDefaults = template ? TEMPLATES[template] : null
  // 'personalizado' = começa em branco (sem menu, sem defaults)
  const ehPersonalizado = template === 'personalizado'

  // Limite de contratos por plano (mesma cota dos imóveis). Admin/profissional liberados.
  const plano = (acesso.plano ?? 'free') as keyof typeof PLANOS
  const limite = PLANOS[plano]?.imoveis ?? 1
  let cotaAtingida = false
  let totalContratos = 0
  if (acesso.role !== 'admin' && limite < 999) {
    const { count } = await supabase
      .from('contratos_locacao')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', acesso.userId)
      .is('deleted_at', null)
    totalContratos = count ?? 0
    cotaAtingida = totalContratos >= limite
  }

  if (cotaAtingida) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock size={28} className="text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Limite de contratos atingido</h1>
        <p className="text-gray-500 mb-1">
          O plano <strong>{PLANOS[plano]?.nome}</strong> permite até <strong>{limite} contratos ativos</strong>.
        </p>
        <p className="text-gray-400 text-sm mb-8">
          Você já tem {totalContratos} contrato{totalContratos === 1 ? '' : 's'} cadastrado{totalContratos === 1 ? '' : 's'}.
          Encerre ou exclua algum antes de criar novo, ou faça upgrade para Profissional (ilimitado).
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/planos" className="bg-violet-700 hover:bg-violet-800 text-white font-bold py-4 rounded-2xl transition-colors">
            Ver planos de assinatura
          </Link>
          <Link href="/painel/contratos" className="text-gray-500 hover:text-gray-700 text-sm py-2">
            Voltar para contratos
          </Link>
        </div>
      </div>
    )
  }

  const [{ data: imoveis }, { data: pessoas }, { data: contratosAtivos }] = await Promise.all([
    supabase
      .from('imoveis')
      .select('id, titulo, preco, endereco_resumido, proprietario_id, bairro:bairros(nome)')
      .eq('user_id', acesso.userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('pessoas')
      .select('id, tipo, nome, cpf_cnpj')
      .eq('user_id', acesso.userId)
      .is('deleted_at', null)
      .order('nome', { ascending: true }),
    // Pega contratos ativos pra marcar imóveis ocupados
    supabase
      .from('contratos_locacao')
      .select('codigo, imovel_id, status')
      .eq('user_id', acesso.userId)
      .in('status', ['ativo', 'inadimplente'])
      .is('deleted_at', null),
  ])

  // Mapeia imovel_id → código do contrato ativo
  const mapaOcupados = new Map<string, string>()
  for (const c of contratosAtivos ?? []) {
    if (c.imovel_id) mapaOcupados.set(c.imovel_id, c.codigo)
  }
  const imoveisMarcados = (imoveis ?? []).map(im => ({
    ...im,
    ocupado: mapaOcupados.has(im.id),
    contrato_vigente_codigo: mapaOcupados.get(im.id) ?? null,
  }))

  return (
    <div className="px-6 pt-6">
      <Link href="/painel/contratos" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-violet-700 mb-2">
        <ArrowLeft size={12} /> Voltar
      </Link>
      <h1 className="text-xl font-bold text-gray-900">Novo contrato</h1>
      <p className="text-sm text-gray-500 mb-4">
        Wizard em 4 etapas. Você pode voltar a qualquer momento.
        {limite < 999 && acesso.role !== 'admin' && (
          <span className="ml-1 text-gray-400">· {totalContratos}/{limite} no plano {PLANOS[plano]?.nome}</span>
        )}
      </p>

      {/* Menu visual de tipos de contrato — pré-preenche atuação + garantia */}
      {!templateDefaults && !ehPersonalizado && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Escolha o tipo de contrato</h2>
          <p className="text-[11px] text-gray-400 mb-3">Pré-preenche atuação e garantia conforme o tipo. Você ainda escolhe imóvel, pessoas e valores nas etapas seguintes.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {TEMPLATE_CARDS.map(t => {
              const Icone = t.icone
              return (
                <Link
                  key={t.id}
                  href={`/painel/contratos/novo?template=${t.id}`}
                  className={`flex flex-col gap-1.5 text-left p-3 rounded-xl border-2 transition-colors ${CARD_CLASSES[t.cor]}`}
                >
                  <Icone size={18} />
                  <p className="text-xs font-bold leading-tight">{t.label}</p>
                  <p className="text-[10px] text-gray-500 leading-tight">{t.desc}</p>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {templateDefaults && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 mb-4 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <p className="text-xs text-violet-800">
              <strong>Tipo escolhido:</strong> atuação <strong>{templateDefaults.tipo_atuacao}</strong> + garantia <strong>{templateDefaults.garantia_tipo.replace('_', ' ')}</strong>.
              Você pode alterar nas etapas do wizard.
            </p>
            <Link href="/painel/contratos/novo" className="text-[11px] text-violet-700 hover:underline shrink-0">
              Trocar tipo
            </Link>
          </div>
          {templateDefaults.terceiro_seguro && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
              ⚠ <strong>Seguro com terceiro responsável:</strong> coloque como <strong>inquilino</strong> quem vai
              <strong> morar</strong>. Depois de criar, vá em <strong>Pessoas vinculadas</strong> e adicione quem passou o
              seguro com o papel <strong>&ldquo;Responsável pelo seguro fiança&rdquo;</strong> (ele assina mas não recebe chaves).
            </p>
          )}
        </div>
      )}

      <WizardContrato
        imoveis={imoveisMarcados}
        pessoas={pessoas ?? []}
        templateDefaults={templateDefaults}
      />
    </div>
  )
}
