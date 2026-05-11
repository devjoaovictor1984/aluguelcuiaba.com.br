import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { ShieldCheck, ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Política de Privacidade e LGPD — AluguelCuiabá',
  description: 'Saiba como o AluguelCuiabá trata seus dados pessoais em conformidade com a LGPD.',
  alternates: { canonical: 'https://aluguelcuiaba.com.br/privacidade' },
}

const ATUALIZADO = '11 de maio de 2025'

export default function PrivacidadePage() {
  return (
    <>
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-10 pb-20">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-xs text-gray-400 mb-6">
          <Link href="/" className="hover:text-violet-600 transition-colors">Início</Link>
          <ChevronRight size={12} />
          <span className="text-gray-600">Privacidade e LGPD</span>
        </nav>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck size={20} className="text-green-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Política de Privacidade e LGPD</h1>
        </div>
        <p className="text-sm text-gray-400 mb-10">Última atualização: {ATUALIZADO}</p>

        {/* Aviso LGPD */}
        <div className="bg-green-50 border border-green-100 rounded-xl px-5 py-4 mb-10">
          <p className="text-sm text-green-800 font-semibold mb-1">Comprometidos com sua privacidade</p>
          <p className="text-sm text-green-700">
            O AluguelCuiabá está em conformidade com a <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)</strong>. Esta política descreve como coletamos, usamos e protegemos suas informações pessoais.
          </p>
        </div>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-8">

          <Secao titulo="1. Controlador dos dados">
            <p>
              O controlador responsável pelo tratamento dos seus dados pessoais é a plataforma <strong>AluguelCuiabá</strong>, com sede em Cuiabá — MT, Brasil, acessível pelo endereço <strong>aluguelcuiaba.com.br</strong>.
            </p>
            <p>
              Para exercer seus direitos ou esclarecer dúvidas, entre em contato pelo e-mail:{' '}
              <a href="mailto:contato@aluguelcuiaba.com.br" className="text-violet-600 hover:underline">
                contato@aluguelcuiaba.com.br
              </a>
            </p>
          </Secao>

          <Secao titulo="2. Dados que coletamos">
            <p>Coletamos os seguintes dados pessoais:</p>
            <Tabela
              linhas={[
                ['Nome completo', 'Cadastro de conta', 'Identificação do usuário'],
                ['CPF', 'Cadastro de conta', 'Prevenção de fraudes (não compartilhado)'],
                ['E-mail', 'Cadastro de conta', 'Comunicação e autenticação'],
                ['Telefone / WhatsApp', 'Cadastro de conta', 'Contato entre anunciante e interessado'],
                ['Endereço', 'Perfil de anunciante', 'Verificação de localização'],
                ['Foto de perfil', 'Perfil (opcional)', 'Exibição no anúncio'],
                ['Dados de pagamento', 'Plano pago (via Stripe)', 'Processamento de assinatura'],
                ['Endereço IP e cookies', 'Navegação automática', 'Segurança e analytics'],
              ]}
            />
          </Secao>

          <Secao titulo="3. Como usamos seus dados">
            <p>Utilizamos seus dados pessoais para as seguintes finalidades:</p>
            <ul>
              <li><strong>Execução do contrato:</strong> criar e gerenciar sua conta, publicar e exibir seus anúncios;</li>
              <li><strong>Comunicação:</strong> enviar notificações sobre seu anúncio (expiração, renovação, interessados);</li>
              <li><strong>Pagamentos:</strong> processar cobranças de planos pagos com segurança;</li>
              <li><strong>Segurança:</strong> prevenir fraudes, abusos e acessos não autorizados;</li>
              <li><strong>Melhoria do serviço:</strong> analisar padrões de uso para aprimorar a plataforma;</li>
              <li><strong>Cumprimento legal:</strong> atender obrigações previstas em lei.</li>
            </ul>
          </Secao>

          <Secao titulo="4. Base legal para o tratamento (LGPD, art. 7º)">
            <ul>
              <li><strong>Execução de contrato</strong> — tratamento necessário para prestar o serviço contratado (art. 7º, V);</li>
              <li><strong>Consentimento</strong> — para cookies não essenciais e comunicações de marketing (art. 7º, I);</li>
              <li><strong>Legítimo interesse</strong> — segurança da plataforma e prevenção de fraudes (art. 7º, IX);</li>
              <li><strong>Cumprimento de obrigação legal</strong> — quando exigido por lei (art. 7º, II).</li>
            </ul>
          </Secao>

          <Secao titulo="5. Compartilhamento de dados">
            <p>Seus dados pessoais <strong>não são vendidos</strong>. Podemos compartilhá-los apenas com:</p>
            <ul>
              <li><strong>Stripe Inc.</strong> — processador de pagamentos (apenas dados necessários para cobrança);</li>
              <li><strong>Supabase Inc.</strong> — provedor de banco de dados e armazenamento (infraestrutura);</li>
              <li><strong>Vercel Inc.</strong> — hospedagem da aplicação;</li>
              <li><strong>Autoridades públicas</strong> — quando exigido por ordem judicial ou legal.</li>
            </ul>
            <p>
              Todos os fornecedores são contratados com cláusulas de proteção de dados compatíveis com a LGPD.
            </p>
          </Secao>

          <Secao titulo="6. Dados visíveis publicamente">
            <p>Ao publicar um anúncio, as seguintes informações tornam-se <strong>públicas</strong> na plataforma:</p>
            <ul>
              <li>Nome e foto de perfil (se cadastrados);</li>
              <li>Tipo de anunciante e CRECI (se corretor ou imobiliária);</li>
              <li>Número de WhatsApp informado no anúncio;</li>
              <li>Informações do imóvel (título, fotos, localização, preço).</li>
            </ul>
            <p>
              <strong>CPF e endereço residencial nunca são exibidos publicamente.</strong>
            </p>
          </Secao>

          <Secao titulo="7. Cookies">
            <p>Utilizamos cookies para:</p>
            <ul>
              <li><strong>Essenciais:</strong> manter sua sessão autenticada (não podem ser desativados);</li>
              <li><strong>Funcionais:</strong> lembrar preferências de filtros e favoritos (localStorage);</li>
              <li><strong>Analytics:</strong> compreender como os usuários navegam na plataforma.</li>
            </ul>
            <p>
              Você pode gerenciar cookies pelas configurações do seu navegador. A desativação de cookies essenciais pode impedir o uso de funcionalidades que exigem login.
            </p>
          </Secao>

          <Secao titulo="8. Retenção dos dados">
            <ul>
              <li>Dados de conta: mantidos enquanto a conta estiver ativa + 5 anos após encerramento;</li>
              <li>Dados de anúncios: mantidos por 2 anos após a expiração do anúncio;</li>
              <li>Dados de pagamento: conforme obrigação fiscal (mínimo 5 anos);</li>
              <li>Logs de segurança: 6 meses.</li>
            </ul>
          </Secao>

          <Secao titulo="9. Seus direitos como titular (LGPD, art. 18)">
            <p>Você tem os seguintes direitos em relação aos seus dados pessoais:</p>
            <ul>
              <li><strong>Confirmação e acesso</strong> — saber se tratamos seus dados e obter cópia;</li>
              <li><strong>Correção</strong> — solicitar atualização de dados incompletos ou incorretos;</li>
              <li><strong>Anonimização, bloqueio ou eliminação</strong> — de dados desnecessários ou tratados em desconformidade;</li>
              <li><strong>Portabilidade</strong> — receber seus dados em formato estruturado;</li>
              <li><strong>Revogação do consentimento</strong> — a qualquer momento, sem prejuízo dos tratamentos realizados anteriormente;</li>
              <li><strong>Oposição</strong> — opor-se ao tratamento em determinadas situações;</li>
              <li><strong>Eliminação</strong> — solicitar exclusão dos dados tratados com base em consentimento.</li>
            </ul>
            <p>
              Para exercer seus direitos, envie e-mail para{' '}
              <a href="mailto:contato@aluguelcuiaba.com.br" className="text-violet-600 hover:underline">
                contato@aluguelcuiaba.com.br
              </a>{' '}
              com o assunto "Direitos LGPD". Respondemos em até 15 dias.
            </p>
          </Secao>

          <Secao titulo="10. Segurança dos dados">
            <p>Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo:</p>
            <ul>
              <li>Transmissão criptografada via HTTPS/TLS;</li>
              <li>Armazenamento em banco de dados com controle de acesso por RLS (Row Level Security);</li>
              <li>Senhas armazenadas com hash seguro (bcrypt via Supabase Auth);</li>
              <li>Acesso administrativo restrito e autenticado;</li>
              <li>Monitoramento de atividades suspeitas.</li>
            </ul>
          </Secao>

          <Secao titulo="11. Crianças e adolescentes">
            <p>
              Os serviços do AluguelCuiabá são destinados exclusivamente a pessoas com 18 anos ou mais. Não coletamos intencionalmente dados de menores de idade. Caso identifiquemos tal situação, excluiremos os dados imediatamente.
            </p>
          </Secao>

          <Secao titulo="12. Alterações desta política">
            <p>
              Esta política pode ser atualizada periodicamente. Notificaremos usuários cadastrados por e-mail em caso de alterações significativas. A data da última atualização está sempre indicada no topo desta página.
            </p>
          </Secao>

          <Secao titulo="13. Contato e encarregado (DPO)">
            <p>
              Para qualquer questão relacionada a privacidade e proteção de dados:
            </p>
            <ul>
              <li>E-mail: <a href="mailto:contato@aluguelcuiaba.com.br" className="text-violet-600 hover:underline">contato@aluguelcuiaba.com.br</a></li>
              <li>Assunto: "Privacidade" ou "Direitos LGPD"</li>
              <li>Prazo de resposta: até 15 dias úteis</li>
            </ul>
            <p>
              Você também pode registrar reclamações perante a <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong> em{' '}
              <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">
                www.gov.br/anpd
              </a>.
            </p>
          </Secao>

        </div>

        {/* Links relacionados */}
        <div className="mt-12 pt-6 border-t border-gray-100 flex flex-wrap gap-4 text-sm">
          <Link href="/termos" className="text-violet-600 hover:underline font-medium">
            Termos de Uso →
          </Link>
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

function Tabela({ linhas }: { linhas: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-2.5 font-semibold text-gray-700">Dado</th>
            <th className="text-left px-4 py-2.5 font-semibold text-gray-700">Origem</th>
            <th className="text-left px-4 py-2.5 font-semibold text-gray-700">Finalidade</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {linhas.map(([dado, origem, finalidade], i) => (
            <tr key={i} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-2.5 font-medium text-gray-800">{dado}</td>
              <td className="px-4 py-2.5 text-gray-500">{origem}</td>
              <td className="px-4 py-2.5 text-gray-600">{finalidade}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
