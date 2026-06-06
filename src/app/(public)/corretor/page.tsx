import Link from 'next/link'
import type { Metadata } from 'next'
import { Footer } from '@/components/footer'
import { createAdminClient } from '@/lib/supabase/admin'
import { faqJsonLd } from '@/lib/seo/jsonld'
import {
  ArrowRight, Check, X, MessageCircle,
  FileSpreadsheet, Receipt, Bell, Repeat, Calculator, FileSignature,
  MapPin, Home, Users, Wallet, FilePieChart, Smartphone, Tag,
  Sparkles, CheckCircle2, Clock, Award, MapPinned, Building2,
  Search, ClipboardList, BadgeCheck, Quote,
} from 'lucide-react'
import { HeaderCorretor } from './_components/header-corretor'
import { CalculadoraCarteira } from './_components/calculadora-carteira'
import { CarrosselPrints } from './_components/carrossel-prints'
import { Reveal } from './_components/reveal'

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

const SIGNUP = '/entrar'

export const metadata: Metadata = {
  title: 'CRM para Corretor de Aluguel em Cuiabá | Renda recorrente com administração',
  description: 'Você já aluga imóveis. Agora administre as locações com contratos, cobranças, recibos, comissões e repasses num CRM feito pra corretor de Cuiabá. Pare de depender só da comissão de entrada.',
  keywords: [
    'crm imobiliário cuiabá',
    'administração de aluguel cuiabá',
    'sistema para corretor de aluguel',
    'taxa de administração de imóveis',
    'gestão de locação cuiabá',
    'carteira de imóveis administrados',
    'sistema para imobiliária pequena',
  ],
  alternates: { canonical: 'https://aluguelcuiaba.com.br/corretor' },
  openGraph: {
    title: 'Transforme locação em carteira administrada — AluguelCuiabá',
    description: 'Contratos, cobranças, recibos, comissão e repasse organizados num painel feito pra corretor autônomo de Cuiabá. Comece grátis.',
    url: 'https://aluguelcuiaba.com.br/corretor',
    siteName: 'AluguelCuiabá',
    locale: 'pt_BR',
    type: 'website',
  },
}

const CTA_PRIMARIO = 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold shadow-lg shadow-amber-500/30'

/* Perguntas — usadas no render E no JSON-LD (SEO). */
const FAQS = [
  { pergunta: 'Preciso ser imobiliária pra usar?', resposta: 'Não. O sistema foi pensado pra corretor autônomo. Pequena imobiliária também usa, mas a maioria dos usuários toca a operação sozinha.' },
  { pergunta: 'Posso começar grátis?', resposta: 'Sim. O plano gratuito permite 1 imóvel ativo, com fotos, mapa e contato direto pelo WhatsApp. Sem prazo pra acabar e sem cartão.' },
  { pergunta: 'O sistema gera contrato de locação?', resposta: 'Sim. Um assistente em etapas monta o contrato (imóvel, partes, valores, garantia), salva e já gera as parcelas do período.' },
  { pergunta: 'O sistema gera contrato de administração?', resposta: 'Sim. Você firma o contrato de administração com o proprietário, definindo a taxa de administração que será cobrada conforme o combinado.' },
  { pergunta: 'Consigo controlar a comissão de administração?', resposta: 'Sim. A comissão é calculada automaticamente parcela a parcela, na taxa que você definir (percentual ou valor fixo), conforme contrato firmado com o proprietário.' },
  { pergunta: 'O proprietário recebe relatório?', resposta: 'Sim. O relatório de repasse sai agrupado por proprietário, com os valores do mês organizados — pronto pra você apresentar e explicar sem refazer conta na mão.' },
  { pergunta: 'O contato do anúncio vai pro meu WhatsApp?', resposta: 'Vai direto pro seu WhatsApp, com a mensagem já preenchida. Sem call center, sem formulário no meio e sem cobrança por lead.' },
  { pergunta: 'Funciona no celular?', resposta: 'Sim. O painel é responsivo, com navegação estilo app, e pode ser instalado como atalho na tela inicial (PWA), com aviso de vencimento opcional.' },
  { pergunta: 'Posso usar só pra anunciar imóveis?', resposta: 'Pode. Dá pra usar só a parte de anúncio e WhatsApp. A administração (contratos, cobranças, recibos) você ativa quando quiser.' },
  { pergunta: 'Posso usar pra administrar minha carteira?', resposta: 'Sim — é justamente o foco. Cadastra proprietários, inquilinos, contratos, parcelas, recibos, comissão e repasse num lugar só.' },
  { pergunta: 'O sistema emite boleto?', resposta: 'Hoje o sistema gera um código de controle por parcela pra você registrar a cobrança no seu banco e acompanhar quem pagou. A emissão de boleto integrada ao banco está prevista no roadmap.' },
  { pergunta: 'O sistema emite nota fiscal?', resposta: 'Ainda não emite NF automática. O relatório por proprietário já sai agrupado e pronto pra você emitir a nota. A emissão automática está prevista no roadmap.' },
  { pergunta: 'Meus dados ficam comigo se eu sair?', resposta: 'Ficam. Você pode cancelar quando quiser, sem fidelidade e sem multa. Seus imóveis, contratos e clientes continuam sendo seus.' },
]

export default async function CorretorPage() {
  const whatsapp = await getWhatsAppNumber()
  const msgWpp = encodeURIComponent('Oi, vi o AluguelCuiabá e quero saber mais sobre administrar minha carteira de aluguéis.')

  return (
    <>
      {/* JSON-LD pra SEO das perguntas */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />

      <HeaderCorretor ctaHref={SIGNUP} />

      {/* ══ 1. HERO ══════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet-950 via-violet-900 to-indigo-950 text-white">
        {/* Glows decorativos */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-10 left-10 w-72 h-72 bg-amber-400 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-violet-400 rounded-full blur-3xl" />
        </div>
        {/* PLACEHOLDER parallax: troque por foto real de Cuiabá (Sesc Arsenal, ruas históricas).
            Ex.: bg-[url('/cuiaba/sesc-arsenal.jpg')] bg-cover bg-fixed */}
        <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_30%_20%,white,transparent_60%)] bg-fixed pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 pt-28 pb-16 lg:pt-32 lg:pb-24 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-500/20 text-amber-200 px-3 py-1 rounded-full mb-5">
              <MapPinned size={11} /> CRM de locação · feito em Cuiabá
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-extrabold leading-[1.1] tracking-tight mb-5">
              Corretor, você está deixando <span className="text-amber-300">renda mensal</span> na mesa?
            </h1>

            <p className="text-base sm:text-lg text-violet-100 mb-5 leading-relaxed max-w-xl">
              Você já aluga imóveis. Agora pode <strong className="text-white">administrar essas locações</strong> com contratos, cobranças, recibos, comissões e repasses organizados num CRM feito pra corretores de Cuiabá.
            </p>

            <p className="text-sm sm:text-base text-violet-200 mb-7 leading-relaxed max-w-xl">
              Pare de depender só da comissão de entrada. Transforme locações numa carteira administrada com mais controle, previsibilidade e profissionalismo.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <Link href={SIGNUP} className={`${CTA_PRIMARIO} flex items-center justify-center gap-2 px-7 py-4 rounded-2xl text-base transition-all hover:scale-[1.02]`}>
                Começar grátis agora <ArrowRight size={18} />
              </Link>
              <Link href="#como-funciona" className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-bold px-7 py-4 rounded-2xl text-base border border-white/20 transition-colors">
                Ver como funciona
              </Link>
            </div>

            <p className="text-xs text-violet-200 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-amber-300" /> Plano grátis · sem cartão · em poucos minutos no ar
            </p>
          </div>

          {/* Mockup do painel (CSS-only até prints reais) */}
          <Reveal delay={120}>
            <MockupPainel />
          </Reveal>
        </div>
      </section>

      {/* ══ 2. DOR / PROBLEMA ════════════════════════════════════════ */}
      <section className="bg-white py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-3">O problema real</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              O problema não é alugar. É <span className="text-violet-700">perder a renda que vem depois</span>.
            </h2>
            <p className="text-base text-gray-500 mt-4 leading-relaxed">
              Muitos corretores fazem todo o trabalho pesado: captam, anunciam, atendem, mostram, negociam e alugam. Mas depois entregam a administração pra outra pessoa — ou simplesmente deixam de ganhar uma receita mensal possível.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DorCard icon={<Wallet size={20} />} text="Você recebe uma vez e acabou." />
            <DorCard icon={<Building2 size={20} />} text="O proprietário continua precisando de gestão." />
            <DorCard icon={<MessageCircle size={20} />} text="A cobrança fica solta no WhatsApp." />
            <DorCard icon={<FileSignature size={20} />} text="O contrato fica perdido no Word." />
            <DorCard icon={<Receipt size={20} />} text="O recibo é feito manualmente, toda vez." />
            <DorCard icon={<Calculator size={20} />} text="A comissão de administração vai pra outro." />
            <DorCard icon={<Repeat size={20} />} text="O reajuste anual é esquecido." />
            <DorCard icon={<FileSpreadsheet size={20} />} text="O repasse ao proprietário vira explicação todo mês." />
          </div>

          <Reveal className="mt-10">
            <div className="bg-gradient-to-r from-violet-700 to-indigo-700 text-white rounded-3xl px-6 py-7 sm:px-10 text-center max-w-4xl mx-auto shadow-xl shadow-violet-900/10">
              <p className="text-lg sm:text-2xl font-bold leading-snug">
                Se você já fez a locação, faz sentido deixar a <span className="text-amber-300">administração</span> escapar?
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ 3. POSSIBILIDADE FINANCEIRA ══════════════════════════════ */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-3">A oportunidade</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              Uma carteira pequena já pode mudar sua <span className="text-violet-700">previsibilidade mensal</span>
            </h2>
            <p className="text-base text-gray-500 mt-4">
              Simule abaixo. Mexa nos números e veja a diferença entre ganhar uma vez e ganhar todo mês.
            </p>
          </Reveal>

          {/* 3 cenários (estáticos, pra skimming) */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <CenarioCard nivel="Cenário 1" imoveis={5} aluguel="R$ 1.800" receita="R$ 900" />
            <CenarioCard nivel="Cenário 2" imoveis={10} aluguel="R$ 2.000" receita="R$ 2.000" destaque />
            <CenarioCard nivel="Cenário 3" imoveis={20} aluguel="R$ 2.500" receita="R$ 5.000" />
          </div>

          {/* Calculadora interativa */}
          <Reveal>
            <CalculadoraCarteira />
          </Reveal>

          {/* Gráfico: comissão única x receita recorrente */}
          <Reveal className="mt-10">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8 max-w-4xl mx-auto">
              <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Comissão única × receita recorrente</h3>
              <p className="text-sm text-gray-500 text-center mb-6">A locação te paga uma vez. A administração se acumula mês a mês.</p>
              <GraficoContraste />
              <div className="flex justify-center gap-6 mt-5 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-gray-400 rounded" /> Comissão única (entrada)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-violet-600 rounded" /> Carteira administrada (recorrente)</span>
              </div>
            </div>
          </Reveal>

          <p className="text-center text-xs text-gray-400 mt-6 max-w-2xl mx-auto leading-relaxed">
            Simulação baseada em taxa de administração de 10%. Os valores dependem dos contratos firmados, do valor dos aluguéis e da carteira de cada corretor. Não é promessa de resultado.
          </p>

          <div className="flex justify-center mt-8">
            <Link href={SIGNUP} className={`${CTA_PRIMARIO} inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base transition-all hover:scale-[1.02]`}>
              Quero organizar minha carteira <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══ 4. ANTES / DEPOIS ════════════════════════════════════════ */}
      <section id="como-funciona" className="bg-white py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-3">A transformação</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              Antes: improviso. <span className="text-violet-700">Depois: carteira administrada.</span>
            </h2>
          </Reveal>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* ANTES */}
            <Reveal>
              <div className="bg-red-50 border-2 border-red-100 rounded-3xl p-6 sm:p-8 h-full">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                    <X size={20} className="text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-red-900">Antes</h3>
                </div>
                <ul className="space-y-3 text-sm">
                  <ItemLista negativo text="Excel com várias abas e fórmula que sempre quebra" />
                  <ItemLista negativo text="Contratos no Word, cada inquilino uma versão" />
                  <ItemLista negativo text="Cobranças manuais soltas no WhatsApp" />
                  <ItemLista negativo text="Recibos repetidos, número trocado sem querer" />
                  <ItemLista negativo text="Repasses sem relatório pro proprietário" />
                  <ItemLista negativo text="Proprietário perguntando os valores todo mês" />
                  <ItemLista negativo text="Comissão calculada na mão, na calculadora do celular" />
                  <ItemLista negativo text="Vencimentos e reajustes esquecidos" />
                </ul>
              </div>
            </Reveal>

            {/* DEPOIS */}
            <Reveal delay={120}>
              <div className="bg-gradient-to-br from-violet-50 to-amber-50 border-2 border-violet-200 rounded-3xl p-6 sm:p-8 relative overflow-hidden h-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/40 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-violet-700 flex items-center justify-center">
                      <Check size={20} className="text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-violet-900">Depois</h3>
                  </div>
                  <ul className="space-y-3 text-sm">
                    <ItemLista text="Painel com contratos ativos e parcelas organizadas" />
                    <ItemLista text="Recibo em PDF gerado com 1 clique, numerado automático" />
                    <ItemLista text="Comissão calculada sozinha, parcela a parcela" />
                    <ItemLista text="Relatório de repasse agrupado por proprietário" />
                    <ItemLista text="Avisos de vencimento e reajuste no tempo certo" />
                    <ItemLista text="Imóveis anunciados no portal local, contato no Whats" />
                    <ItemLista text="Gestão no celular, igual app, onde você estiver" />
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>

          <p className="text-center text-base sm:text-lg font-semibold text-gray-700 mt-10 max-w-2xl mx-auto">
            Você volta a trabalhar com <span className="text-violet-700">pessoas</span>. O sistema cuida da estrutura.
          </p>
        </div>
      </section>

      {/* ══ 5. O QUE VOCÊ CONSEGUE FAZER ═════════════════════════════ */}
      <section className="bg-gray-50 py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-3">Tudo num lugar só</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              Tudo que o corretor precisa pra administrar aluguel com estrutura
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FeatCard icon={<Home />} titulo="Cadastro de imóveis" texto="Foto, descrição, preço, bairro e pin no mapa num formulário só." />
            <FeatCard icon={<Tag />} titulo="Anúncio no portal local" texto="Aparece na home, na busca por bairro e no mapa público." />
            <FeatCard icon={<MessageCircle />} titulo="Contato pelo WhatsApp" texto="Visitante clica e cai no seu Whats com mensagem pronta." />
            <FeatCard icon={<Building2 />} titulo="Cadastro de proprietários" texto="Cada dono organizado, com seus imóveis e repasses." />
            <FeatCard icon={<Users />} titulo="Cadastro de inquilinos" texto="Inquilinos, fiadores e moradores separados e linkados." />
            <FeatCard icon={<ClipboardList />} titulo="Contrato de administração" texto="Firma a taxa de administração com o proprietário em contrato." />
            <FeatCard icon={<FileSignature />} titulo="Contrato de locação" texto="Assistente em etapas: imóvel, partes, valores e garantia." />
            <FeatCard icon={<CheckCircle2 />} titulo="Controle de parcelas" texto="Parcelas geradas pelo contrato, por mês de vencimento." />
            <FeatCard icon={<Wallet />} titulo="Controle financeiro" texto="Previsto, recebido, a receber e atrasado — por mês ou ano." />
            <FeatCard icon={<Receipt />} titulo="Recibo em PDF" texto="Com sua logo, assinatura e numeração sequencial. 1 clique." />
            <FeatCard icon={<Calculator />} titulo="Comissão de administração" texto="Calcula automático na taxa definida, parcela a parcela." />
            <FeatCard icon={<FilePieChart />} titulo="Relatório de repasse" texto="Agrupado por proprietário, pronto pra apresentar." />
            <FeatCard icon={<Bell />} titulo="Avisos de vencimento" texto="Aluguel vencendo, reajuste e seguro no tempo certo." />
            <FeatCard icon={<Smartphone />} titulo="Painel no celular" texto="Navegação estilo app, instalável como PWA." />
            <FeatCard icon={<Search />} titulo="Busca por bairro" texto="Filtros e URLs por bairro de Cuiabá, com SEO local." />
            <FeatCard icon={<MapPin />} titulo="Mapa de imóveis" texto="Pins na região com raio configurável pro visitante." />
          </div>

          <Reveal className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-5 max-w-3xl mx-auto">
            <p className="text-sm text-amber-900 leading-relaxed">
              <strong>No roadmap:</strong> emissão de boleto integrada ao banco e nota fiscal automática na Prefeitura de Cuiabá. O que está pronto agora, você já usa hoje.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══ 6. AUTORIDADE / PROVA REAL ═══════════════════════════════ */}
      <section className="bg-white py-16 lg:py-20">
        <div className="max-w-5xl mx-auto px-4">
          <Reveal className="grid lg:grid-cols-5 gap-8 items-center">
            {/* Foto do fundador (PLACEHOLDER) */}
            <div className="lg:col-span-2">
              {/* SUBSTITUIR: foto real do João Victor Vieira (operação/escritório em Cuiabá).
                  Sugestão: <Imagem src="/equipe/joao-victor.jpg" alt="João Victor Vieira" aspect="3/4" /> */}
              <div className="relative rounded-3xl overflow-hidden aspect-[3/4] bg-gradient-to-br from-violet-700 to-indigo-800 shadow-xl flex items-center justify-center">
                <span className="text-7xl font-extrabold text-white/90">JV</span>
                <div className="absolute bottom-0 inset-x-0 bg-black/30 backdrop-blur-sm px-4 py-3">
                  <p className="text-white font-bold text-sm">João Victor Vieira</p>
                  <p className="text-violet-100 text-xs">Corretor · CRECI-MT 12130-F</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-50 text-amber-700 px-3 py-1 rounded-full mb-4 border border-amber-200">
                <BadgeCheck size={12} /> Autoridade prática
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight mb-4">
                Criado por quem administra imóveis na prática
              </h2>
              <p className="text-base text-gray-600 leading-relaxed mb-4">
                O AluguelCuiabá não nasceu de uma ideia distante da rotina do corretor. Ele foi criado a partir da operação real de locação e administração de imóveis em Cuiabá.
              </p>
              <p className="text-base text-gray-600 leading-relaxed mb-6">
                &ldquo;Eu também administro imóveis. Uso estrutura pra gerar contratos de locação e de administração, cobranças, recibos, relatórios, controle financeiro, avisos de vencimento e anúncios. O sistema nasceu dessa necessidade: parar de depender de planilha e organizar uma carteira de aluguéis com mais profissionalismo.&rdquo;
              </p>
              <div className="text-sm text-gray-500 mb-6">
                <p className="font-bold text-gray-900">João Victor Vieira</p>
                <p>Corretor de imóveis em Cuiabá · CRECI-MT 12130-F</p>
                <p>Administrador de imóveis · criador do AluguelCuiabá.com.br</p>
              </div>
              <Link href={SIGNUP} className="inline-flex items-center gap-2 bg-violet-700 hover:bg-violet-800 text-white font-bold px-6 py-3 rounded-2xl transition-colors">
                Conhecer a ferramenta <ArrowRight size={17} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ 7. PRINTS / MOCKUPS ══════════════════════════════════════ */}
      <section className="bg-gray-50 py-16 lg:py-20 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-3">Por dentro</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              Veja a estrutura por dentro
            </h2>
            <p className="text-base text-gray-500 mt-4">
              Telas reais do sistema. Arraste pro lado pra ver mais.
            </p>
          </Reveal>

          <CarrosselPrints />
        </div>
      </section>

      {/* ══ 8. LOCAL / CUIABÁ ════════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-violet-950 to-indigo-950 text-white py-16 lg:py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-400 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4">
          <Reveal className="text-center max-w-3xl mx-auto mb-10">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-300 mb-3">Hiperlocal</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight">
              Não é um portal nacional genérico. É uma ferramenta feita pra Cuiabá.
            </h2>
            <p className="text-base text-violet-100 mt-4 leading-relaxed">
              O mercado de locação em Cuiabá tem bairros, perfis e comportamentos próprios. Coxipó, Araés, Goiabeiras, CPA, Centro, Jardim das Américas e Duque de Caxias não são só nomes no mapa — são regiões com públicos, preços e estratégias diferentes.
            </p>
          </Reveal>

          {/* Chips de bairro */}
          <div className="flex flex-wrap justify-center gap-2 mb-10 max-w-4xl mx-auto">
            {[
              'Centro', 'Araés', 'Goiabeiras', 'Coxipó', 'CPA', 'Jardim das Américas',
              'Jardim Cuiabá', 'Santa Rosa', 'Boa Esperança', 'Duque de Caxias',
              'Bosque da Saúde', 'Miguel Sutil',
            ].map(b => (
              <span key={b} className="inline-flex items-center gap-1 text-xs font-medium bg-white/10 backdrop-blur-sm border border-white/20 text-white px-3 py-1.5 rounded-full hover:bg-amber-500/20 hover:border-amber-300/40 transition-colors">
                <MapPin size={10} /> {b}
              </span>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <LocalCard icon={<Search />} titulo="SEO por bairro" texto="Cada bairro de Cuiabá tem URL própria e busca local." />
            <LocalCard icon={<MapPinned />} titulo="Mapa local" texto="Visitante vê os pins na região que quer, com raio configurável." />
            <LocalCard icon={<Home />} titulo="Portal de aluguel" texto="Sem compra e venda. Tudo aqui é pensado pra locação." />
            <LocalCard icon={<Users />} titulo="Público de Cuiabá" texto="Quem vê seu imóvel procura aqui, não no Brasil inteiro." />
            <LocalCard icon={<MessageCircle />} titulo="Linguagem local" texto="O sistema fala como corretor de Cuiabá fala." />
            <LocalCard icon={<Award />} titulo="Pra autônomo e imobiliária pequena" texto="Sem barreira de entrada e sem onboarding caro." />
          </div>
        </div>
      </section>

      {/* ══ 9. PROVA SOCIAL ══════════════════════════════════════════ */}
      <section className="bg-white py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-3">Quem usa</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              Corretores que organizam, crescem com mais controle
            </h2>
          </Reveal>

          {/* SUBSTITUIR: trocar pelos relatos reais conforme autorização dos clientes. */}
          <div className="grid sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <Depoimento
              papel="Corretor autônomo · Cuiabá/MT"
              texto="Antes eu controlava tudo em planilha. Hoje consigo ver pagamentos, gerar recibo e acompanhar repasse sem me perder."
            />
            <Depoimento
              papel="Pequena imobiliária · Centro"
              texto="O relatório por proprietário facilitou minha rotina. Ficou mais fácil explicar os valores e organizar minha comissão."
            />
            <Depoimento
              papel="Corretor de locação · Coxipó"
              texto="Eu alugava e parava por ali. Agora estou começando a montar minha carteira de imóveis administrados."
            />
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Depoimentos editáveis. Substituir por relatos reais conforme autorização dos clientes.
          </p>
        </div>
      </section>

      {/* ══ 10. PLANOS ═══════════════════════════════════════════════ */}
      <section className="bg-gray-50 py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-3">Planos</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              Comece grátis. Suba quando sua carteira crescer.
            </h2>
            <p className="text-base text-gray-500 mt-4">
              Sem contrato longo. Sem multa. Cancela quando quiser.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto items-start">
            <PlanoCard
              nome="Gratuito" preco="0" periodo=""
              descricao="Pra testar e botar seu primeiro imóvel no ar."
              features={['1 imóvel ativo', 'Contato pelo WhatsApp', 'Aparece na busca', 'Aparece no mapa']}
              cta="Criar conta grátis" href={SIGNUP}
            />
            <PlanoCard
              nome="Básico" preco="49,90" periodo="/mês"
              descricao="Pra corretor autônomo com carteira pequena/média."
              features={['Até 10 imóveis ativos', 'Painel CRM completo', 'Recibo em PDF', 'Controle financeiro', 'Comissão e repasse', 'Avisos de vencimento']}
              cta="Escolher Básico" href="/planos" destaque
            />
            <PlanoCard
              nome="Profissional" preco="99,90" periodo="/mês"
              descricao="Pra pequena imobiliária com volume maior."
              features={['Imóveis ilimitados', 'Tudo do Básico', 'Destaque no portal', 'Suporte prioritário', 'Recursos avançados']}
              cta="Conhecer Profissional" href="/planos"
            />
          </div>

          <p className="text-center text-sm text-gray-500 mt-8">
            <strong className="text-gray-700">Sem contrato longo. Sem multa.</strong> Cancela quando quiser.
          </p>
        </div>
      </section>

      {/* ══ 11. FAQ ══════════════════════════════════════════════════ */}
      <section className="bg-white py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4">
          <Reveal className="text-center mb-10">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-3">Perguntas frequentes</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              Dúvidas comuns
            </h2>
          </Reveal>

          <div className="space-y-3">
            {FAQS.map(f => <FAQ key={f.pergunta} pergunta={f.pergunta} resposta={f.resposta} />)}
          </div>
        </div>
      </section>

      {/* ══ 12. CTA FINAL ════════════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-violet-900 via-indigo-900 to-violet-900 text-white py-16 lg:py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-amber-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-violet-400 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <Sparkles className="mx-auto mb-4 text-amber-300" size={32} />
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-4">
            Você já aluga imóveis. Agora organize a administração.
          </h2>
          <p className="text-base sm:text-lg text-violet-100 mb-8 max-w-2xl mx-auto leading-relaxed">
            Crie sua conta grátis, publique seu primeiro imóvel e veja como o AluguelCuiabá pode ajudar você a transformar locações numa carteira mais organizada e recorrente.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
            <Link href={SIGNUP} className={`${CTA_PRIMARIO} flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base transition-all hover:scale-[1.02]`}>
              Começar grátis <ArrowRight size={18} />
            </Link>
            <a
              href={`https://wa.me/${whatsapp}?text=${msgWpp}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-2xl text-base transition-colors shadow-lg shadow-green-600/30"
            >
              <MessageCircle size={18} /> Falar pelo WhatsApp
            </a>
          </div>

          <p className="text-xs text-violet-200 flex items-center justify-center gap-1.5">
            <Clock size={11} /> Sem cartão · sem fidelidade · feito em Cuiabá
          </p>
        </div>
      </section>

      <Footer />
    </>
  )
}

/* ════════════════════════════════════════════════════════════════ */
/* Componentes auxiliares (apresentacionais, server)                */
/* ════════════════════════════════════════════════════════════════ */

function DorCard({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-red-200 hover:shadow-md transition-all">
      <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-3">{icon}</div>
      <p className="text-sm font-medium text-gray-700 leading-relaxed">{text}</p>
    </div>
  )
}

function CenarioCard({ nivel, imoveis, aluguel, receita, destaque }: {
  nivel: string; imoveis: number; aluguel: string; receita: string; destaque?: boolean
}) {
  return (
    <div className={`rounded-3xl p-6 border-2 ${destaque ? 'bg-violet-700 text-white border-amber-400 shadow-xl shadow-violet-900/15' : 'bg-white border-gray-100'}`}>
      <p className={`text-xs font-bold uppercase tracking-wider ${destaque ? 'text-amber-300' : 'text-amber-600'}`}>{nivel}</p>
      <p className={`text-3xl font-extrabold mt-1 ${destaque ? 'text-white' : 'text-gray-900'}`}>{imoveis} <span className="text-base font-semibold">imóveis</span></p>
      <div className={`text-sm mt-3 space-y-1 ${destaque ? 'text-violet-100' : 'text-gray-500'}`}>
        <p>Aluguel médio: <strong className={destaque ? 'text-white' : 'text-gray-700'}>{aluguel}</strong></p>
        <p>Taxa de administração: <strong className={destaque ? 'text-white' : 'text-gray-700'}>10%</strong></p>
      </div>
      <div className={`mt-4 pt-4 border-t ${destaque ? 'border-white/20' : 'border-gray-100'}`}>
        <p className={`text-[11px] uppercase tracking-wider font-semibold ${destaque ? 'text-violet-200' : 'text-gray-400'}`}>Receita mensal estimada</p>
        <p className={`text-2xl font-extrabold ${destaque ? 'text-amber-300' : 'text-violet-700'}`}>{receita}</p>
      </div>
    </div>
  )
}

/* Gráfico SVG: linha reta (comissão única) × linha crescente (recorrente). */
function GraficoContraste() {
  // 12 meses; recorrente acumula, única fica achatada
  const recorrente = [8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96]
  const w = 600, h = 180, pad = 8
  const xs = (i: number) => pad + (i * (w - pad * 2)) / 11
  const ys = (v: number) => h - pad - (v / 100) * (h - pad * 2)
  const linha = recorrente.map((v, i) => `${xs(i)},${ys(v)}`).join(' ')
  const unicaY = ys(12)
  const areaRec = `${pad},${h - pad} ${linha} ${xs(11)},${h - pad}`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Gráfico comparando comissão única e receita recorrente ao longo de 12 meses">
      <defs>
        <linearGradient id="grad-rec" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(124 58 237)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(124 58 237)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* área recorrente */}
      <polygon points={areaRec} fill="url(#grad-rec)" />
      {/* linha comissão única (achatada) */}
      <line x1={pad} y1={unicaY} x2={w - pad} y2={unicaY} stroke="rgb(156 163 175)" strokeWidth="2.5" strokeDasharray="5 5" />
      {/* linha recorrente */}
      <polyline points={linha} fill="none" stroke="rgb(124 58 237)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* ponto final recorrente */}
      <circle cx={xs(11)} cy={ys(96)} r="5" fill="rgb(124 58 237)" />
    </svg>
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
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-violet-200 hover:shadow-md hover:-translate-y-0.5 transition-all group">
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
      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center mb-3">{icon}</div>
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
        ? 'bg-gradient-to-br from-violet-700 to-indigo-700 text-white shadow-2xl shadow-violet-700/30 lg:scale-[1.04] border-2 border-amber-400'
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
          destaque ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg' : 'bg-violet-700 hover:bg-violet-800 text-white'
        }`}
      >
        {cta}
      </Link>
    </div>
  )
}

function Depoimento({ papel, texto }: { papel: string; texto: string }) {
  return (
    <div className="bg-gradient-to-br from-violet-50 to-amber-50 border border-violet-100 rounded-2xl p-5 flex flex-col h-full">
      <Quote size={22} className="text-violet-300 mb-3" />
      <p className="text-sm text-gray-700 leading-relaxed mb-4 flex-1">{texto}</p>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-violet-700 text-white flex items-center justify-center">
          <Users size={15} />
        </div>
        <p className="text-xs font-semibold text-gray-600">{papel}</p>
      </div>
    </div>
  )
}

function FAQ({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  return (
    <details className="group bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 hover:border-violet-200 transition-colors">
      <summary className="flex items-center justify-between cursor-pointer list-none">
        <span className="font-semibold text-gray-900 text-sm sm:text-base pr-4">{pergunta}</span>
        <span className="shrink-0 w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center group-open:rotate-45 transition-transform font-bold text-xl leading-none">
          +
        </span>
      </summary>
      <p className="text-sm text-gray-600 mt-3 leading-relaxed pr-8">{resposta}</p>
    </details>
  )
}

/* ════════════════════════════════════════════════════════════════ */
/* Mockup CSS-only do painel (placeholder até prints reais)         */
/* ════════════════════════════════════════════════════════════════ */

function MockupPainel() {
  return (
    <div className="relative mx-auto lg:mx-0 max-w-md w-full">
      <div className="absolute -top-6 -left-6 w-32 h-32 bg-amber-400/30 rounded-full blur-2xl" />
      <div className="absolute -bottom-6 -right-6 w-40 h-40 bg-violet-400/30 rounded-full blur-2xl" />

      <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20">
        <div className="bg-violet-700 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-violet-200 font-semibold">Maio de 2026</p>
            <p className="text-sm font-bold text-white">8 contratos administrados</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-amber-400 text-violet-900 flex items-center justify-center text-xs font-bold">JV</div>
        </div>

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

        {/* Mini-gráfico de crescimento da carteira */}
        <div className="px-4 pt-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Carteira administrada</p>
          <div className="flex items-end gap-1 h-10">
            {[30, 38, 45, 52, 60, 68, 78, 88, 100].map((h, i) => (
              <div key={i} className="flex-1 bg-gradient-to-t from-violet-600 to-violet-400 rounded-t" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>

        <div className="p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Próximas parcelas</p>
          <Parcela nome="João S." imovel="Apto Centro" valor="R$ 1.560" status="pago" />
          <Parcela nome="Maria O." imovel="Casa Coxipó" valor="R$ 2.100" status="vence" />
          <Parcela nome="Carlos R." imovel="Kitnet Araés" valor="R$ 900" status="pendente" />
        </div>

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
