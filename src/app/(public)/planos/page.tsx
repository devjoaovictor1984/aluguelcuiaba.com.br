import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { Check, X, Zap, Building2, Home } from 'lucide-react'
import { CheckoutButton } from './_components/checkout-button'

const PLANOS = [
  {
    id: 'free',
    nome: 'Gratuito',
    preco: 0,
    periodo: '',
    descricao: 'Para quem tem um único imóvel para alugar.',
    icone: <Home size={22} />,
    cor: 'gray',
    destaque: false,
    features: [
      { label: '1 anúncio ativo', ok: true },
      { label: 'Até 20 fotos por anúncio', ok: true },
      { label: 'Contato direto pelo WhatsApp', ok: true },
      { label: 'Renovação manual a cada 30 dias', ok: true },
      { label: 'Múltiplos anúncios', ok: false },
      { label: 'Anúncio em destaque', ok: false },
    ],
    cta: 'Criar conta grátis',
    href: '/entrar',
  },
  {
    id: 'basico',
    nome: 'Básico',
    preco: 49.90,
    periodo: '/mês',
    descricao: 'Para corretores e proprietários com até 10 imóveis.',
    icone: <Zap size={22} />,
    cor: 'violet',
    destaque: true,
    features: [
      { label: 'Até 10 anúncios ativos', ok: true },
      { label: 'Até 20 fotos por anúncio', ok: true },
      { label: 'Contato direto pelo WhatsApp', ok: true },
      { label: 'Renovação manual a cada 30 dias', ok: true },
      { label: 'Painel de gestão completo', ok: true },
      { label: 'Anúncio em destaque', ok: false },
    ],
    cta: 'Começar agora',
    href: '/entrar',
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    preco: 99.90,
    periodo: '/mês',
    descricao: 'Para imobiliárias e corretores com grande carteira.',
    icone: <Building2 size={22} />,
    cor: 'orange',
    destaque: false,
    features: [
      { label: 'Anúncios ilimitados', ok: true },
      { label: 'Até 20 fotos por anúncio', ok: true },
      { label: 'Contato direto pelo WhatsApp', ok: true },
      { label: 'Renovação manual a cada 30 dias', ok: true },
      { label: 'Painel de gestão completo', ok: true },
      { label: 'Anúncios em destaque', ok: true },
    ],
    cta: 'Começar agora',
    href: '/entrar',
  },
]

function formatarPreco(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const corMap = {
  gray:   { ring: 'ring-gray-200',   bg: 'bg-gray-50',    btn: 'bg-gray-800 hover:bg-gray-900', icon: 'bg-gray-100 text-gray-600', badge: '' },
  violet: { ring: 'ring-violet-500', bg: 'bg-violet-700', btn: 'bg-white hover:bg-violet-50 text-violet-700', icon: 'bg-violet-100 text-violet-700', badge: 'Mais popular' },
  orange: { ring: 'ring-orange-400', bg: 'bg-white',      btn: 'bg-orange-500 hover:bg-orange-600', icon: 'bg-orange-100 text-orange-600', badge: '' },
}

export default function PlanosPage() {
  return (
    <>
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-12 pb-20">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">
            Planos simples e transparentes
          </h1>
          <p className="text-gray-500 text-base max-w-xl mx-auto">
            Anuncie seus imóveis direto pelo WhatsApp. Sem intermediários, sem comissão.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-stretch">
          {PLANOS.map(plano => {
            const cor = corMap[plano.cor as keyof typeof corMap]
            const isDestaque = plano.destaque

            return (
              <div
                key={plano.id}
                className={`relative rounded-3xl overflow-hidden flex flex-col ring-2 ${cor.ring} ${isDestaque ? 'shadow-2xl scale-[1.02] sm:scale-105' : 'shadow-sm'}`}
              >
                {/* Badge */}
                {cor.badge && (
                  <div className="absolute top-4 right-4 bg-white text-violet-700 text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
                    {cor.badge}
                  </div>
                )}

                {/* Header do card */}
                <div className={`px-6 pt-7 pb-6 ${isDestaque ? 'bg-violet-700 text-white' : 'bg-white'}`}>
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${cor.icon}`}>
                    {plano.icone}
                  </div>
                  <h2 className={`text-lg font-bold mb-1 ${isDestaque ? 'text-white' : 'text-gray-900'}`}>
                    {plano.nome}
                  </h2>
                  <p className={`text-xs leading-relaxed mb-5 ${isDestaque ? 'text-violet-200' : 'text-gray-500'}`}>
                    {plano.descricao}
                  </p>

                  <div className="flex items-baseline gap-1">
                    {plano.preco === 0 ? (
                      <span className={`text-4xl font-extrabold ${isDestaque ? 'text-white' : 'text-gray-900'}`}>
                        Grátis
                      </span>
                    ) : (
                      <>
                        <span className={`text-4xl font-extrabold ${isDestaque ? 'text-white' : 'text-gray-900'}`}>
                          {formatarPreco(plano.preco)}
                        </span>
                        <span className={`text-sm ${isDestaque ? 'text-violet-300' : 'text-gray-400'}`}>
                          {plano.periodo}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Features */}
                <div className="px-6 py-5 flex-1 bg-white">
                  <ul className="space-y-3">
                    {plano.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm">
                        {f.ok
                          ? <Check size={15} className="text-green-500 shrink-0" />
                          : <X size={15} className="text-gray-300 shrink-0" />
                        }
                        <span className={f.ok ? 'text-gray-700' : 'text-gray-400'}>{f.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <div className="px-6 pb-6 bg-white">
                  {plano.id === 'free' ? (
                    <Link
                      href={plano.href}
                      className="block w-full text-center font-bold py-3 rounded-2xl text-sm transition-colors bg-gray-900 hover:bg-gray-800 text-white"
                    >
                      {plano.cta}
                    </Link>
                  ) : (
                    <CheckoutButton
                      plano={plano.id}
                      label={plano.cta}
                      className={`block w-full text-center font-bold py-3 rounded-2xl text-sm transition-colors disabled:opacity-60 ${
                        isDestaque
                          ? 'bg-violet-700 hover:bg-violet-800 text-white'
                          : 'bg-orange-500 hover:bg-orange-600 text-white'
                      }`}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* FAQ / notas */}
        <div className="mt-14 bg-gray-50 rounded-3xl p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-5">Perguntas frequentes</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                q: 'Como funciona o pagamento?',
                a: 'O pagamento é feito por Pix ou cartão de crédito. Entre em contato conosco para ativar seu plano.',
              },
              {
                q: 'Posso cancelar a qualquer momento?',
                a: 'Sim, sem fidelidade. Ao cancelar, seu plano fica ativo até o fim do período pago.',
              },
              {
                q: 'O que acontece se eu atingir o limite?',
                a: 'Você ainda pode ver seus anúncios ativos, mas não consegue publicar novos até fazer upgrade.',
              },
              {
                q: 'Os anúncios expiram?',
                a: 'Sim, a cada 30 dias você renova com um clique. Isso mantém o catálogo sempre atualizado.',
              },
            ].map((item, i) => (
              <div key={i}>
                <p className="font-semibold text-gray-800 text-sm mb-1">{item.q}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contato */}
        <p className="text-center text-sm text-gray-400 mt-8">
          Dúvidas?{' '}
          <a
            href="https://wa.me/556599999999"
            className="text-violet-600 font-semibold hover:underline"
          >
            Fale conosco pelo WhatsApp
          </a>
        </p>
      </div>

      <Footer />
    </>
  )
}
