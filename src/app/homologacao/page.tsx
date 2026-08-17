import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ShieldCheck, Flame, FlaskConical, PenLine, ArrowRight, AlertTriangle, Terminal,
} from 'lucide-react'
import { sessaoAtual } from '@/lib/homologacao/sessao'

export const metadata = {
  title: 'Homologação — AluguelCuiabá × Maximiza',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

/**
 * Tela de entrada da sessão — o roteiro.
 *
 * Escrita para a equipe TÉCNICA da corretora: quem abre isto conhece a
 * API melhor que nós, e o que falta a essa pessoa não é explicação de
 * seguro, é saber onde a nossa implementação está e o que exatamente
 * queremos que ela confira.
 *
 * Por isso o roteiro é curto e cada item termina numa pergunta objetiva.
 * Roteiro que pede "explore à vontade" volta sem nada.
 */
export default async function HomologacaoPage() {
  const sessao = await sessaoAtual()
  if (!sessao) redirect('/homologacao/encerrada?motivo=expirada')

  const dias = Math.max(0, Math.ceil((new Date(sessao.expiraEm).getTime() - Date.now()) / 86400_000))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 pb-32 space-y-5">
        <header>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200 px-2.5 py-1 text-[11px] font-bold">
            <FlaskConical size={11} /> Ambiente de homologação
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">
            Integração AluguelCuiabá × Maximiza
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Olá, {sessao.nome}. Este acesso é seu por mais {dias} dia{dias === 1 ? '' : 's'} e
            só abre o módulo de seguros.
          </p>
        </header>

        <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4 space-y-2.5">
          <h2 className="text-sm font-bold text-gray-900">O que isto é</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            É a nossa implementação da API de vocês, rodando contra
            <strong> ambiente 2</strong>, com o CNPJ de teste
            <strong> 10.961.528/0001-80</strong>. Nada aqui emite apólice de verdade
            nem toca em produção.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Queremos que vocês cotem como cotariam no painel de vocês, e nos digam
            onde divergimos. Em qualquer tela existe o botão
            <strong> Anotar</strong>, embaixo — ele já registra junto a tela, o
            registro e as últimas chamadas à API, então basta escrever a observação.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-gray-900">O roteiro, em ordem</h2>

          <Passo
            n={1}
            icone={<Flame size={16} className="text-orange-600" />}
            titulo="Seguro incêndio — do cálculo à apólice"
            href="/painel/seguros/incendio/nova"
            cor="orange"
          >
            <p>
              É o fluxo que vai até o fim hoje. Cotem na Alfa e na Porto e comparem
              com o painel de vocês: coberturas sugeridas, prêmio, IOF e
              parcelamento.
            </p>
            <Pergunta>
              O prêmio que sai aqui bate com o do painel de vocês para os mesmos
              limites?
            </Pergunta>
            <Pergunta>
              O campo <strong>Tabela</strong> (1 a 20), que no painel de vocês sai
              com 20, não existe em nenhum lugar da API que recebemos. O que ele
              muda, e como o enviamos?
            </Pergunta>
            <Pergunta>
              O <code>/calculo</code> da Alfa devolve <code>listaFormasPagto</code> vazia
              em toda cotação que fizemos. Estamos derivando o parcelamento do
              prêmio com parcela mínima de R$ 60 — é o correto?
            </Pergunta>
          </Passo>

          <Passo
            n={2}
            icone={<ShieldCheck size={16} className="text-violet-600" />}
            titulo="Seguro fiança — análise"
            href="/painel/seguros/fianca/nova"
            cor="violet"
          >
            <p>
              A análise transmite e o parecer chega. Ela para em
              <strong> pré-aprovado</strong>, como a regra de vocês prevê — e é aí
              que trava.
            </p>
            <Pergunta>
              O <code>GET /apiFiancaAnalise/&#123;id&#125;</code> devolve
              <code> statusBiometria</code> mas nunca <code>linkBiometria</code>.
              Confirmam que o link só trafega no webhook de biometria? Se sim,
              precisamos das nossas URLs cadastradas — sem elas nenhuma análise
              passa de pré-aprovado.
            </Pergunta>
            <Pergunta>
              No CNPJ de teste só <code>porto_fianca</code> está habilitada. Conseguem
              habilitar Too, Tokio e Pottencial? Cotar numa não habilitada não dá
              erro: dá análise sem parecer nenhum.
            </Pergunta>
            <Pergunta>
              Numa análise <strong>reduzida</strong>, o bloco <code>pessoal</code> com
              locatários solidários é considerado, ou só a completa avalia?
            </Pergunta>
          </Passo>
        </section>

        <section className="rounded-2xl bg-violet-50 ring-1 ring-violet-100 p-4">
          <h2 className="text-sm font-bold text-violet-900 flex items-center gap-1.5">
            <PenLine size={14} /> Como anotar
          </h2>
          <p className="text-sm text-violet-900 leading-relaxed mt-1">
            Use o botão <strong>Anotar</strong> na faixa de baixo, na própria tela em
            que notou a coisa. Vale tanto para o que está errado quanto para o que
            está <strong>certo</strong> — a confirmação de que um comportamento é o
            esperado fecha pergunta nossa e é tão útil quanto um defeito.
          </p>
        </section>

        <section className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Terminal size={14} className="text-gray-400" /> Se quiserem ver o que trafegou
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mt-1">
            Na página de cada análise de fiança há o bloco
            <strong> &quot;Conversa com a corretora&quot;</strong>: endpoint, código HTTP,
            duração, corpo enviado e corpo recebido, com um botão que copia tudo
            formatado. Senha, token e PDF em base64 nunca são gravados.
          </p>
        </section>

        <section className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-4 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 leading-relaxed">
            <p className="font-semibold">Sobre os dados que vocês digitarem</p>
            <p className="mt-0.5">
              Use CPF e nomes de teste. Os dados vão para a API de vocês em ambiente
              2 e ficam registrados aqui enquanto durar esta sessão.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

function Passo({ n, icone, titulo, href, cor, children }: {
  n: number
  icone: React.ReactNode
  titulo: string
  href: string
  cor: 'orange' | 'violet'
  children: React.ReactNode
}) {
  const botao = cor === 'orange'
    ? 'bg-orange-600 hover:bg-orange-700'
    : 'bg-violet-700 hover:bg-violet-800'

  return (
    <div className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <span className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 text-sm font-black text-gray-400">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            {icone} {titulo}
          </h3>
          <div className="text-sm text-gray-600 leading-relaxed mt-1.5 space-y-2">
            {children}
          </div>
          <Link
            href={href}
            className={`mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white ${botao}`}
          >
            Abrir <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Pergunta objetiva — é o que queremos de volta de cada passo. */
function Pergunta({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] text-gray-700 bg-gray-50 rounded-lg px-3 py-2 leading-snug border-l-2 border-gray-300">
      {children}
    </p>
  )
}
