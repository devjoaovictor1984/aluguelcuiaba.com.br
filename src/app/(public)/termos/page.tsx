import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { FileText, ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Termos de Uso — AluguelCuiabá',
  description: 'Conheça os termos e condições de uso da plataforma AluguelCuiabá.',
  alternates: { canonical: 'https://aluguelcuiaba.com.br/termos' },
}

const ATUALIZADO = '11 de maio de 2025'

export default function TermosPage() {
  return (
    <>
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-10 pb-20">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-xs text-gray-400 mb-6">
          <Link href="/" className="hover:text-violet-600 transition-colors">Início</Link>
          <ChevronRight size={12} />
          <span className="text-gray-600">Termos de Uso</span>
        </nav>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
            <FileText size={20} className="text-violet-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Termos de Uso</h1>
        </div>
        <p className="text-sm text-gray-400 mb-10">Última atualização: {ATUALIZADO}</p>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-8">

          <Secao titulo="1. Aceitação dos termos">
            <p>
              Ao acessar ou usar a plataforma <strong>AluguelCuiabá</strong> (disponível em aluguelcuiaba.com.br), você concorda com estes Termos de Uso. Se não concordar com qualquer disposição, não utilize nossos serviços.
            </p>
            <p>
              Estes termos podem ser atualizados periodicamente. A continuidade do uso após alterações implica aceitação das novas condições.
            </p>
          </Secao>

          <Secao titulo="2. Descrição do serviço">
            <p>
              O AluguelCuiabá é uma plataforma de classificados imobiliários que conecta proprietários, corretores e imobiliárias a pessoas interessadas em alugar imóveis em Cuiabá e região metropolitana — Mato Grosso, Brasil.
            </p>
            <p>
              A plataforma não é parte em nenhuma negociação entre anunciantes e interessados, não presta serviços de administração de contratos e não garante a veracidade das informações inseridas pelos usuários.
            </p>
          </Secao>

          <Secao titulo="3. Cadastro e conta">
            <ul>
              <li>Para publicar anúncios é necessário criar uma conta com e-mail e senha válidos.</li>
              <li>O usuário é responsável pela confidencialidade de suas credenciais.</li>
              <li>É proibido criar contas com dados falsos, de terceiros ou automatizadas por bots.</li>
              <li>O AluguelCuiabá pode suspender ou encerrar contas que violem estes termos.</li>
            </ul>
          </Secao>

          <Secao titulo="4. Publicação de anúncios">
            <p>Ao publicar um anúncio, o usuário declara e garante que:</p>
            <ul>
              <li>É proprietário do imóvel anunciado ou está devidamente autorizado a anunciá-lo;</li>
              <li>As informações fornecidas (localização, preço, características) são verdadeiras e atualizadas;</li>
              <li>As fotos publicadas são de sua autoria ou possui autorização para utilizá-las;</li>
              <li>O imóvel está disponível para locação e não está sujeito a restrições legais que impeçam sua divulgação.</li>
            </ul>
            <p>
              O AluguelCuiabá reserva-se o direito de remover anúncios que violem estes termos, sem aviso prévio e sem direito a reembolso de valores pagos.
            </p>
          </Secao>

          <Secao titulo="5. Conteúdo proibido">
            <p>É expressamente proibido publicar anúncios ou conteúdos que:</p>
            <ul>
              <li>Sejam falsos, enganosos ou fraudulentos;</li>
              <li>Pratiquem discriminação por raça, cor, sexo, origem, religião, idade ou deficiência;</li>
              <li>Anunciem imóveis irregulares perante a legislação brasileira;</li>
              <li>Contenham linguagem ofensiva, ameaçadora ou conteúdo adulto;</li>
              <li>Violem direitos de propriedade intelectual de terceiros;</li>
              <li>Constituam spam ou publicidade não solicitada.</li>
            </ul>
          </Secao>

          <Secao titulo="6. Planos e pagamentos">
            <p>
              O AluguelCuiabá oferece planos gratuitos e pagos. Os planos pagos são cobrados conforme descrito na página de Planos. O pagamento é processado por gateway seguro (Stripe).
            </p>
            <ul>
              <li>Planos são renovados automaticamente ao final do período contratado, salvo cancelamento prévio.</li>
              <li>Em caso de inadimplência, o plano é rebaixado automaticamente para o plano gratuito.</li>
              <li>Não há reembolso proporcional por cancelamento antecipado.</li>
              <li>Anúncios expiram conforme o prazo do plano. O anunciante é responsável por renovar seus anúncios.</li>
            </ul>
          </Secao>

          <Secao titulo="7. Propriedade intelectual">
            <p>
              A marca, logotipo, design e conteúdo editorial do AluguelCuiabá são de propriedade exclusiva da plataforma. É proibida a reprodução sem autorização prévia por escrito.
            </p>
            <p>
              O usuário mantém a titularidade das fotos e textos que publicar, mas concede ao AluguelCuiabá licença não exclusiva e gratuita para exibição, distribuição e promoção dos anúncios na plataforma.
            </p>
          </Secao>

          <Secao titulo="8. Limitação de responsabilidade">
            <p>
              O AluguelCuiabá atua como intermediário entre anunciantes e interessados. Não nos responsabilizamos por:
            </p>
            <ul>
              <li>Exatidão, completude ou atualidade das informações dos anúncios;</li>
              <li>Condutas de anunciantes ou usuários fora da plataforma;</li>
              <li>Negociações, contratos ou pagamentos realizados entre as partes;</li>
              <li>Danos diretos ou indiretos decorrentes do uso ou impossibilidade de uso do serviço.</li>
            </ul>
          </Secao>

          <Secao titulo="9. Privacidade e LGPD">
            <p>
              O tratamento de dados pessoais é regido pela nossa{' '}
              <Link href="/privacidade" className="text-violet-600 hover:underline">
                Política de Privacidade
              </Link>{' '}
              e observa a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
            </p>
          </Secao>

          <Secao titulo="10. Lei aplicável e foro">
            <p>
              Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da comarca de <strong>Cuiabá — MT</strong> para dirimir quaisquer controvérsias, com renúncia a qualquer outro, por mais privilegiado que seja.
            </p>
          </Secao>

          <Secao titulo="11. Contato">
            <p>
              Dúvidas sobre estes termos podem ser enviadas para{' '}
              <a href="mailto:contato@aluguelcuiaba.com.br" className="text-violet-600 hover:underline">
                contato@aluguelcuiaba.com.br
              </a>.
            </p>
          </Secao>

        </div>
      </div>

      <Footer />
    </>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-gray-900 mb-3 pb-1.5 border-b border-gray-100">{titulo}</h2>
      <div className="space-y-3 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  )
}
