import Link from 'next/link'
import type { Metadata } from 'next'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ArrowRight, Check, X, MessageCircle,
  FileSpreadsheet, Receipt, Bell, Repeat, Calculator, FileSignature,
  MapPin, Home, Users, Wallet, FilePieChart, Smartphone, Tag,
  Sparkles, CheckCircle2, Clock, Award, MapPinned,
} from 'lucide-react'

async function getWhatsAppNumber(): Promise<string> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('site_config').select('valor').eq('chave', 'contato_whatsapp').maybeSingle()
    return data?.valor || '5565999999999'
  } catch {
    return '5565999999999'
  }
}

export const metadata: Metadata = {
  title: 'CRM para Corretor de Aluguel em Cuiabá | AluguelCuiabá',
  description: 'Sistema para corretores e pequenas imobiliárias de Cuiabá anunciarem imóveis, receberem contatos no WhatsApp e organizarem contratos, cobranças, recibos e repasses.',
  keywords: [
    'crm imobiliário cuiabá',
    'sistema para corretor de aluguel',
    'aluguel cuiabá corretor',
    'gestão de locação cuiabá',
    'anunciar imóvel para alugar cuiabá',
    'sistema para imobiliária pequena',
    'controle de aluguel para corretor',
  ],
  alternates: { canonical: 'https://aluguelcuiaba.com.br/corretor' },
  openGraph: {
    title: 'CRM de aluguel pra corretor de Cuiabá — AluguelCuiabá',
    description: 'Anuncie, organize contratos, gere recibo em PDF, controle comissão e repasse — tudo em um painel feito pra corretor autônomo de Cuiabá.',
    url: 'https://aluguelcuiaba.com.br/corretor',
    siteName: 'AluguelCuiabá',
    locale: 'pt_BR',
    type: 'website',
  },
}

const CTA_PRIMARIO = 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold shadow-lg shadow-amber-500/30'
const CTA_SECUNDARIO = 'bg-white border-2 border-violet-700 text-violet-700 hover:bg-violet-50 font-bold'

export default async function CorretorPage() {
  const whatsapp = await getWhatsAppNumber()
  const msgWpp = encodeURIComponent('Oi, vi o AluguelCuiabá e quero saber mais sobre o painel de gestão pra corretor.')

  return (
    <>
      <Navbar />

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet-900 via-violet-800 to-indigo-900 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-amber-400 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-violet-400 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 pt-12 pb-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-500/20 text-amber-200 px-3 py-1 rounded-full mb-5">
              <MapPinned size={11} /> Feito em Cuiabá · pra Cuiabá
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight mb-4">
              Você ainda controla seus aluguéis no <span className="text-amber-300 underline decoration-wavy decoration-amber-500/50 underline-offset-4">Excel</span>?
            </h1>

            <p className="text-base sm:text-lg text-violet-100 mb-7 leading-relaxed max-w-xl">
              Anuncie imóveis, receba contatos no WhatsApp e organize contratos, cobranças, recibos, comissões e repasses em um painel feito pra <strong className="text-white">corretores autônomos e pequenas imobiliárias de Cuiabá</strong>.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Link href="/entrar" className={`${CTA_PRIMARIO} flex items-center justify-center gap-2 px-7 py-4 rounded-2xl text-base transition-all hover:scale-[1.02]`}>
                Começar grátis <ArrowRight size={18} />
              </Link>
              <Link href="#como-funciona" className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-bold px-7 py-4 rounded-2xl text-base border border-white/20 transition-colors">
                Ver como funciona
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-violet-200">
              <span className="flex items-center gap-1"><CheckCircle2 size={13} className="text-amber-300" /> Plano grátis, sem cartão</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={13} className="text-amber-300" /> Em 2 minutos no ar</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={13} className="text-amber-300" /> Sem fidelidade</span>
            </div>
          </div>

          {/* Mockup do painel — CSS-only, placeholder até prints reais */}
          <MockupPainel />
        </div>
      </section>

      {/* ── BLOCO DE DOR ───────────────────────────────────────────── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-3">O problema real</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              Aluguel não deveria depender de <span className="text-violet-700">planilha</span>, Word e lembrete no WhatsApp.
            </h2>
            <p className="text-base text-gray-500 mt-4">
              Veja se você se reconhece em alguma dessas:
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DorCard icon={<FileSpreadsheet size={20} />} text="Controle de aluguel perdido no Excel, com aba pra cada inquilino e fórmula que sempre quebra." />
            <DorCard icon={<MessageCircle size={20} />} text="Cobrança manual todo mês — 'oi, lembra do aluguel?' — várias vezes, várias pessoas." />
            <DorCard icon={<Receipt size={20} />} text="Recibo feito no Word, salvo na pasta Downloads, com data trocada e número repetido." />
            <DorCard icon={<Calculator size={20} />} text="Comissão calculada na calculadora do celular. Erra fácil, esquece taxa de admin." />
            <DorCard icon={<Repeat size={20} />} text="Reajuste anual esquecido. Inquilino paga o mesmo valor por 2 anos." />
            <DorCard icon={<Wallet size={20} />} text="Repasse pro proprietário sem relatório. Sempre tem que explicar de onde saiu cada valor." />
            <DorCard icon={<Home size={20} />} text="Imóvel anunciado em 5 lugares diferentes. Liga gente em horário ruim e você não sabe de onde veio." />
            <DorCard icon={<Bell size={20} />} text="Seguro incêndio venceu há 3 meses. Você só lembrou quando o proprietário cobrou." />
            <DorCard icon={<FileSignature size={20} />} text="Contrato no Word v_FINAL_FINAL_v2.docx. Cada inquilino é uma versão diferente." />
          </div>
        </div>
      </section>

      {/* ── BEFORE / AFTER ─────────────────────────────────────────── */}
      <section id="como-funciona" className="bg-gradient-to-b from-gray-50 to-white py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-3">A transformação</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              Antes e depois do AluguelCuiabá
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* ANTES */}
            <div className="bg-red-50 border-2 border-red-100 rounded-3xl p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <X size={20} className="text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-red-900">Antes</h3>
              </div>
              <ul className="space-y-3 text-sm">
                <ItemLista negativo text="Excel aberto em 4 abas, célula com fórmula quebrada" />
                <ItemLista negativo text="WhatsApp cheio de conversa sobre aluguel sem ordem" />
                <ItemLista negativo text="Contrato salvo numa pasta perdida do Drive" />
                <ItemLista negativo text="Recibo digitado no Word, número repetido sem querer" />
                <ItemLista negativo text="Proprietário perguntando se o pagamento entrou" />
                <ItemLista negativo text="Você apagando incêndio todo dia 10 do mês" />
              </ul>
            </div>

            {/* DEPOIS */}
            <div className="bg-gradient-to-br from-violet-50 to-amber-50 border-2 border-violet-200 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/40 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-violet-700 flex items-center justify-center">
                    <Check size={20} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-violet-900">Depois</h3>
                </div>
                <ul className="space-y-3 text-sm">
                  <ItemLista text="Imóvel publicado em poucos minutos, com fotos e mapa" />
                  <ItemLista text="Contatos caindo direto no seu WhatsApp" />
                  <ItemLista text="Dados de cada cliente e contrato organizados" />
                  <ItemLista text="Recibo em PDF gerado com 1 clique, numerado automático" />
                  <ItemLista text="Status de pagamento por imóvel — quem pagou, quem deve" />
                  <ItemLista text="Comissão por proprietário com relatório imprimível" />
                  <ItemLista text="Painel no celular, igual app, com aviso de vencimento" />
                </ul>
              </div>
            </div>
          </div>

          <p className="text-center text-base sm:text-lg font-semibold text-gray-700 mt-10 max-w-2xl mx-auto">
            Você volta a trabalhar com <span className="text-violet-700">pessoas</span>. O sistema cuida da organização.
          </p>
        </div>
      </section>

      {/* ── FUNCIONALIDADES ────────────────────────────────────────── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-3">O que tem dentro</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              O básico bem feito pra quem vive de aluguel
            </h2>
            <p className="text-base text-gray-500 mt-4">
              Nada de funcionalidade que ninguém usa. O que tá aqui é o que corretor de Cuiabá pediu.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatCard icon={<Home />} titulo="Cadastro de imóveis" texto="Foto, descrição, preço, bairro, mapa com pin — tudo num formulário só." />
            <FeatCard icon={<Tag />} titulo="Anúncio no portal local" texto="Seu imóvel aparece na home, na busca por bairro e no mapa público do site." />
            <FeatCard icon={<MessageCircle />} titulo="Contato pelo WhatsApp" texto="Visitante clica e cai direto no seu Whats com a mensagem pronta." />
            <FeatCard icon={<Users />} titulo="Cadastro de pessoas" texto="Proprietários, inquilinos, fiadores e moradores adicionais — separados e linkados." />
            <FeatCard icon={<FileSignature />} titulo="Contratos de locação" texto="Wizard em 4 passos: imóvel, partes, valores, garantia. Salva e gera parcelas." />
            <FeatCard icon={<CheckCircle2 />} titulo="Status do imóvel" texto="Disponível, alugado, pausado, expirado — atualiza sozinho conforme o contrato." />
            <FeatCard icon={<Wallet />} titulo="Controle financeiro" texto="Dashboard com previsto, recebido, a receber e atrasado. Por mês ou ano." />
            <FeatCard icon={<Receipt />} titulo="Recibo em PDF" texto="Gera com sua logo, assinatura digital e numeração sequencial. 1 clique." />
            <FeatCard icon={<Calculator />} titulo="Controle de comissão" texto="Calcula automático na taxa que você definiu (% ou fixo) parcela a parcela." />
            <FeatCard icon={<FilePieChart />} titulo="Relatório por proprietário" texto="Comissões agrupadas por proprietário, imprimível, pronto pra emitir NF." />
            <FeatCard icon={<MapPin />} titulo="Organização por bairro" texto="Busca, filtros e mapa por bairros de Cuiabá. Visitante encontra fácil." />
            <FeatCard icon={<Smartphone />} titulo="Painel no celular" texto="Bottom-nav estilo app, instalável como PWA. Notificação de vencimento opcional." />
          </div>

          <div className="mt-10 bg-amber-50 border border-amber-200 rounded-2xl p-5 sm:p-6 max-w-3xl mx-auto">
            <p className="text-sm text-amber-900 leading-relaxed">
              <strong>Em breve:</strong> integração de boleto direto pelo banco, emissão automática de NF na Prefeitura de Cuiabá e relatório do IR pro proprietário. O que tá pronto agora você já usa hoje.
            </p>
          </div>
        </div>
      </section>

      {/* ── HIPERLOCAL ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-violet-900 to-indigo-900 text-white py-16 lg:py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-400 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-300 mb-3">Por que é diferente</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight">
              Feito pra quem aluga imóvel em Cuiabá
            </h2>
            <p className="text-base text-violet-100 mt-4 leading-relaxed">
              O AluguelCuiabá não nasceu pra ser um portal nacional. A proposta é ajudar quem trabalha todos os dias com locação aqui — entender que <strong className="text-white">Coxipó</strong> é diferente do <strong className="text-white">Jardim Cuiabá</strong>, que <strong className="text-white">Goiabeiras</strong> tem outro perfil de cliente, e que <strong className="text-white">CPA</strong> e <strong className="text-white">Centro</strong> pedem estratégias diferentes.
            </p>
          </div>

          {/* Bairros chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-10 max-w-4xl mx-auto">
            {[
              'Centro', 'Araés', 'Goiabeiras', 'Jardim das Américas', 'CPA', 'Coxipó',
              'Boa Esperança', 'Jardim Cuiabá', 'Santa Rosa', 'Duque de Caxias',
              'Popular', 'Miguel Sutil', 'Jardim Aclimação', 'Bosque da Saúde',
            ].map(b => (
              <span key={b} className="inline-flex items-center gap-1 text-xs font-medium bg-white/10 backdrop-blur-sm border border-white/20 text-white px-3 py-1.5 rounded-full hover:bg-amber-500/20 hover:border-amber-300/40 transition-colors">
                <MapPin size={10} /> {b}
              </span>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <LocalCard icon={<MapPin />} titulo="Busca por bairro" texto="Cada bairro de Cuiabá tem URL própria e SEO local." />
            <LocalCard icon={<MapPinned />} titulo="Mapa de imóveis" texto="Visitante vê os pins na região que ele quer, com raio configurável." />
            <LocalCard icon={<Users />} titulo="Público local" texto="Quem vê o seu imóvel é gente procurando em Cuiabá, não no Brasil inteiro." />
            <LocalCard icon={<MessageCircle />} titulo="Linguagem local" texto="O sistema fala como corretor de Cuiabá fala. Sem jargão corporativo." />
            <LocalCard icon={<Home />} titulo="Foco em locação" texto="Não temos compra e venda. Tudo aqui é pensado pra aluguel." />
            <LocalCard icon={<Award />} titulo="Pra autônomo e imobiliária pequena" texto="Sem barreira de entrada, sem onboarding caro, sem comissão por venda." />
          </div>
        </div>
      </section>

      {/* ── PLANOS ─────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-3">Planos</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              Comece grátis. Suba quando crescer.
            </h2>
            <p className="text-base text-gray-500 mt-4">
              Sem contrato longo. Sem multa. Cancela a qualquer momento.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            <PlanoCard
              nome="Gratuito"
              preco="0"
              periodo=""
              descricao="Pra testar e botar seu primeiro imóvel no ar."
              features={[
                '1 imóvel ativo',
                'Até 20 fotos',
                'Contato pelo WhatsApp',
                'Aparece no mapa e busca',
              ]}
              cta="Criar conta grátis"
              href="/entrar"
            />
            <PlanoCard
              nome="Básico"
              preco="49,90"
              periodo="/mês"
              descricao="Pra corretor autônomo com carteira pequena/média."
              features={[
                'Até 10 imóveis ativos',
                'Painel CRM completo',
                'Recibo em PDF',
                'Controle de comissão e repasse',
                'Notificação de novos imóveis',
                'Avisos de aluguel vencendo',
              ]}
              cta="Escolher Básico"
              href="/planos"
              destaque
            />
            <PlanoCard
              nome="Profissional"
              preco="99,90"
              periodo="/mês"
              descricao="Pra pequena imobiliária com volume maior."
              features={[
                'Imóveis ilimitados',
                'Tudo do plano Básico',
                'Anúncio em destaque',
                'Múltiplos corretores (em breve)',
                'Suporte prioritário',
              ]}
              cta="Conhecer Profissional"
              href="/planos"
            />
          </div>

          <p className="text-center text-sm text-gray-500 mt-8">
            <strong className="text-gray-700">Sem contrato longo.</strong> Comece simples e evolua conforme sua carteira crescer.
          </p>
        </div>
      </section>

      {/* ── PROVA E CONFIANÇA ──────────────────────────────────────── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-50 text-amber-700 px-3 py-1 rounded-full mb-4 border border-amber-200">
              <Award size={12} /> Projeto local · Cuiabá/MT
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              Criado por quem conhece a rotina de locação na prática
            </h2>
          </div>

          {/* Números */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12 max-w-4xl mx-auto">
            <Numero valor="100%" label="Foco em Cuiabá" />
            <Numero valor="0" label="Comissão por aluguel" />
            <Numero valor="R$ 0" label="Pra começar" />
            <Numero valor="24/7" label="Painel disponível" />
          </div>

          {/* Mockup de prints */}
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            <MockupPequeno tipo="dashboard" label="Painel de aluguel" />
            <MockupPequeno tipo="recibo" label="Recibo em PDF" />
            <MockupPequeno tipo="financeiro" label="Financeiro" />
          </div>

          {/* Depoimentos placeholder */}
          <div className="grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
            <Depoimento
              nome="Cuiabá / MT"
              papel="Corretor autônomo"
              texto="Antes eu tinha 4 abas do Excel só pra um inquilino. Hoje abro o painel, vejo quem pagou, gero o recibo e mando pelo Whats. Salvou minha sexta-feira."
            />
            <Depoimento
              nome="Centro / Cuiabá"
              papel="Pequena imobiliária"
              texto="O relatório por proprietário facilitou demais a emissão da nota fiscal na prefeitura. Antes era manual, agora vem agrupado pronto."
            />
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Depoimentos de corretores que usam o sistema. Identidade preservada a pedido.
          </p>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-3">Perguntas frequentes</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              Dúvidas comuns
            </h2>
          </div>

          <div className="space-y-3">
            <FAQ
              pergunta="Preciso ser imobiliária pra usar?"
              resposta="Não. O sistema foi pensado pra corretor autônomo. Pequena imobiliária também usa, mas a maioria dos usuários é gente que toca a operação sozinha."
            />
            <FAQ
              pergunta="Posso anunciar grátis?"
              resposta="Sim. O plano gratuito permite 1 imóvel ativo, com fotos, mapa e contato direto pelo WhatsApp. Sem prazo pra acabar — fica grátis enquanto for 1 imóvel."
            />
            <FAQ
              pergunta="Pra onde vai o contato do interessado?"
              resposta="Direto pro seu WhatsApp. Não existe call center, formulário no meio do caminho ou cobrança por lead. Visitante clica, abre o Whats com mensagem pronta — você responde."
            />
            <FAQ
              pergunta="Vocês substituem o Zap Imóveis ou o VivaReal?"
              resposta="Não. A proposta é diferente: aqueles são portais nacionais com bilhões de buscas. A gente é local, foca em Cuiabá e te dá o que eles não dão — um CRM pra organizar a operação. Use os dois junto se quiser."
            />
            <FAQ
              pergunta="Serve pra proprietário que aluga o próprio imóvel?"
              resposta="Sim, dá pra usar como proprietário também. Mas esta página é focada em corretor e pequena imobiliária — quem tem mais de 1 imóvel pra gerir."
            />
            <FAQ
              pergunta="Funciona no celular?"
              resposta="Sim. O painel é responsivo e tem bottom-nav estilo app. Dá pra instalar como PWA no celular (ícone na tela inicial, abre como aplicativo, recebe notificação)."
            />
            <FAQ
              pergunta="Os dados ficam comigo se eu sair?"
              resposta="Sim. Você pode exportar a qualquer momento e cancelar quando quiser. Sem fidelidade, sem multa, sem 'venha falar com o time de retenção'."
            />
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-violet-900 via-indigo-900 to-violet-900 text-white py-16 lg:py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-amber-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-violet-400 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <Sparkles className="mx-auto mb-4 text-amber-300" size={32} />

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-4">
            Pare de administrar aluguel como amador.
          </h2>
          <p className="text-base sm:text-lg text-violet-100 mb-8 max-w-2xl mx-auto leading-relaxed">
            Crie sua conta grátis, publique seu primeiro imóvel e veja como é mais simples organizar sua carteira de locações em Cuiabá.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
            <Link href="/entrar" className={`${CTA_PRIMARIO} flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base transition-all hover:scale-[1.02]`}>
              Começar grátis <ArrowRight size={18} />
            </Link>
            <a
              href={`https://wa.me/${whatsapp}?text=${msgWpp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-2xl text-base transition-colors shadow-lg shadow-green-600/30"
            >
              <MessageCircle size={18} /> Falar pelo WhatsApp
            </a>
          </div>

          <p className="text-xs text-violet-200 flex items-center justify-center gap-1.5">
            <Clock size={11} /> 2 minutos pra publicar · sem cartão · cancela quando quiser
          </p>
        </div>
      </section>

      <Footer />
    </>
  )
}

/* ──────────────────────────────────────────────────────────────── */
/* Componentes auxiliares                                          */
/* ──────────────────────────────────────────────────────────────── */

function DorCard({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-red-200 hover:shadow-md transition-all">
      <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
    </div>
  )
}

function ItemLista({ text, negativo }: { text: string; negativo?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <span className={`shrink-0 mt-0.5 ${negativo ? 'text-red-500' : 'text-violet-700'}`}>
        {negativo ? <X size={14} strokeWidth={3} /> : <Check size={14} strokeWidth={3} />}
      </span>
      <span className={negativo ? 'text-red-900' : 'text-violet-900 font-medium'}>{text}</span>
    </li>
  )
}

function FeatCard({ icon, titulo, texto }: { icon: React.ReactNode; titulo: string; texto: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-violet-200 hover:shadow-md transition-all group">
      <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center mb-3 group-hover:bg-violet-700 group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="font-bold text-gray-900 text-base mb-1">{titulo}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{texto}</p>
    </div>
  )
}

function LocalCard({ icon, titulo, texto }: { icon: React.ReactNode; titulo: string; texto: string }) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="font-bold text-white text-base mb-1">{titulo}</h3>
      <p className="text-sm text-violet-200 leading-relaxed">{texto}</p>
    </div>
  )
}

function PlanoCard({ nome, preco, periodo, descricao, features, cta, href, destaque }: {
  nome: string; preco: string; periodo: string; descricao: string
  features: string[]; cta: string; href: string; destaque?: boolean
}) {
  return (
    <div className={`relative rounded-3xl p-6 sm:p-7 ${
      destaque
        ? 'bg-gradient-to-br from-violet-700 to-indigo-700 text-white shadow-2xl shadow-violet-700/30 scale-[1.02] border-2 border-amber-400'
        : 'bg-white border-2 border-gray-100'
    }`}>
      {destaque && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
          MAIS POPULAR
        </div>
      )}
      <h3 className={`text-lg font-bold ${destaque ? 'text-white' : 'text-gray-900'}`}>{nome}</h3>
      <p className={`text-xs mt-1 mb-5 ${destaque ? 'text-violet-200' : 'text-gray-500'}`}>{descricao}</p>

      <div className="flex items-baseline gap-1 mb-5">
        <span className={`text-3xl font-extrabold ${destaque ? 'text-white' : 'text-gray-900'}`}>R$ {preco}</span>
        {periodo && <span className={`text-sm ${destaque ? 'text-violet-200' : 'text-gray-400'}`}>{periodo}</span>}
      </div>

      <ul className="space-y-2.5 mb-6">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check size={14} className={`shrink-0 mt-0.5 ${destaque ? 'text-amber-300' : 'text-violet-700'}`} strokeWidth={3} />
            <span className={destaque ? 'text-violet-100' : 'text-gray-700'}>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className={`block text-center font-bold py-3 rounded-xl transition-colors ${
          destaque
            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg'
            : 'bg-violet-700 hover:bg-violet-800 text-white'
        }`}
      >
        {cta}
      </Link>
    </div>
  )
}

function Numero({ valor, label }: { valor: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl sm:text-4xl font-extrabold text-violet-700">{valor}</p>
      <p className="text-xs sm:text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function Depoimento({ nome, papel, texto }: { nome: string; papel: string; texto: string }) {
  return (
    <div className="bg-gradient-to-br from-violet-50 to-amber-50 border border-violet-100 rounded-2xl p-5">
      <p className="text-sm text-gray-700 leading-relaxed italic mb-4">&ldquo;{texto}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-violet-700 text-white flex items-center justify-center font-bold text-sm">
          {nome.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">{nome}</p>
          <p className="text-xs text-gray-500">{papel}</p>
        </div>
      </div>
    </div>
  )
}

function FAQ({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  return (
    <details className="group bg-white border border-gray-100 rounded-2xl px-5 py-4 hover:border-violet-200 transition-colors">
      <summary className="flex items-center justify-between cursor-pointer list-none">
        <span className="font-semibold text-gray-900 text-sm sm:text-base pr-4">{pergunta}</span>
        <span className="shrink-0 w-7 h-7 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center group-open:rotate-45 transition-transform font-bold text-xl leading-none">
          +
        </span>
      </summary>
      <p className="text-sm text-gray-600 mt-3 leading-relaxed pr-8">{resposta}</p>
    </details>
  )
}

/* ──────────────────────────────────────────────────────────────── */
/* Mockup CSS-only do painel (placeholder até prints reais)        */
/* ──────────────────────────────────────────────────────────────── */

function MockupPainel() {
  return (
    <div className="relative mx-auto lg:mx-0 max-w-md w-full">
      <div className="absolute -top-6 -left-6 w-32 h-32 bg-amber-400/30 rounded-full blur-2xl" />
      <div className="absolute -bottom-6 -right-6 w-40 h-40 bg-violet-400/30 rounded-full blur-2xl" />

      <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20">
        {/* Header do mockup */}
        <div className="bg-violet-700 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-violet-200 font-semibold">Maio de 2026</p>
            <p className="text-sm font-bold text-white">Painel · 8 contratos</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-amber-400 text-violet-900 flex items-center justify-center text-xs font-bold">JV</div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50">
          <div className="bg-white rounded-lg p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Recebido</p>
            <p className="text-base font-bold text-green-600">R$ 12.480</p>
          </div>
          <div className="bg-white rounded-lg p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">A receber</p>
            <p className="text-base font-bold text-amber-600">R$ 6.200</p>
          </div>
          <div className="bg-white rounded-lg p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Comissão</p>
            <p className="text-base font-bold text-violet-700">R$ 1.248</p>
          </div>
          <div className="bg-white rounded-lg p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Atrasado</p>
            <p className="text-base font-bold text-red-600">R$ 0</p>
          </div>
        </div>

        {/* Lista de parcelas */}
        <div className="p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Próximas parcelas</p>
          <Parcela nome="João S." imovel="Apto Centro" valor="R$ 1.560" status="pago" />
          <Parcela nome="Maria O." imovel="Casa Coxipó" valor="R$ 2.100" status="vence" />
          <Parcela nome="Carlos R." imovel="Kitnet Araés" valor="R$ 900" status="pendente" />
        </div>

        {/* Bottom nav mockup */}
        <div className="grid grid-cols-4 border-t border-gray-100">
          {['🏠 Início', '📝 Contratos', '👥 Clientes', '💰 Financeiro'].map((l, i) => (
            <div key={l} className={`text-[9px] text-center py-2.5 ${i === 0 ? 'text-violet-700 font-semibold border-t-2 border-violet-700 -mt-px' : 'text-gray-400'}`}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Parcela({ nome, imovel, valor, status }: {
  nome: string; imovel: string; valor: string; status: 'pago' | 'vence' | 'pendente'
}) {
  const corStatus = {
    pago: 'bg-green-100 text-green-700',
    vence: 'bg-amber-100 text-amber-700',
    pendente: 'bg-gray-100 text-gray-600',
  }[status]
  const labelStatus = { pago: 'pago', vence: 'vence 5d', pendente: 'pendente' }[status]
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-[10px] shrink-0">
        {nome.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{nome}</p>
        <p className="text-[10px] text-gray-400 truncate">{imovel}</p>
      </div>
      <span className="font-semibold text-gray-900 shrink-0">{valor}</span>
      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${corStatus} shrink-0`}>{labelStatus}</span>
    </div>
  )
}

function MockupPequeno({ tipo, label }: { tipo: 'dashboard' | 'recibo' | 'financeiro'; label: string }) {
  return (
    <div className="bg-gradient-to-br from-violet-50 to-amber-50 rounded-2xl p-4 border border-violet-100 aspect-[3/4] flex flex-col">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 overflow-hidden">
        {tipo === 'dashboard' && (
          <div className="p-3 space-y-2">
            <div className="h-3 bg-violet-200 rounded w-2/3" />
            <div className="grid grid-cols-2 gap-1.5 my-2">
              <div className="h-8 bg-green-100 rounded" />
              <div className="h-8 bg-amber-100 rounded" />
              <div className="h-8 bg-violet-100 rounded" />
              <div className="h-8 bg-gray-100 rounded" />
            </div>
            <div className="space-y-1 mt-3">
              {[1, 2, 3].map(i => <div key={i} className="h-2 bg-gray-100 rounded" />)}
            </div>
          </div>
        )}
        {tipo === 'recibo' && (
          <div className="p-3">
            <div className="h-4 bg-violet-700 rounded mb-2" />
            <div className="h-2 bg-gray-200 rounded mb-1 w-1/2" />
            <div className="bg-violet-50 rounded-lg p-2 my-3 text-center">
              <div className="text-[9px] text-violet-600 font-bold tracking-wider mb-0.5">VALOR</div>
              <div className="text-sm font-bold text-violet-700">R$ 1.900</div>
            </div>
            <div className="space-y-1">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-1.5 bg-gray-100 rounded" />)}
            </div>
            <div className="mt-3 pt-2 border-t border-gray-200">
              <div className="h-1.5 bg-gray-300 rounded w-2/3 mx-auto" />
            </div>
          </div>
        )}
        {tipo === 'financeiro' && (
          <div className="p-3 space-y-2">
            <div className="h-3 bg-violet-200 rounded w-1/2" />
            <div className="flex items-end gap-1 h-12 mt-2">
              {[40, 65, 30, 80, 50, 70, 90, 55, 75].map((h, i) => (
                <div key={i} className="flex-1 bg-violet-300 rounded-t" style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1 mt-3">
              <div className="h-6 bg-green-100 rounded" />
              <div className="h-6 bg-amber-100 rounded" />
              <div className="h-6 bg-violet-100 rounded" />
            </div>
          </div>
        )}
      </div>
      <p className="text-center text-xs font-semibold text-gray-700 mt-3">{label}</p>
    </div>
  )
}
