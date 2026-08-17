import { AlertOctagon, Clock, Ban, HelpCircle } from 'lucide-react'

export const metadata = {
  title: 'Sessão encerrada',
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: Promise<{ motivo?: string }>
}

/**
 * Fim de linha da sessão — link inválido, vencido, revogado ou falha ao
 * autenticar.
 *
 * Diz qual dos quatro foi. A pessoa do outro lado é técnica e está
 * testando a nossa integração: "algo deu errado" faria ela abrir um
 * chamado sobre a plataforma quando o link é que venceu.
 */
const MOTIVOS: Record<string, { icone: typeof Clock; titulo: string; texto: string }> = {
  expirada: {
    icone: Clock,
    titulo: 'Este acesso venceu',
    texto: 'O link tinha prazo e ele terminou. Peça um novo — leva um minuto para gerar, e as anotações que você já fez continuam guardadas.',
  },
  revogada: {
    icone: Ban,
    titulo: 'Este acesso foi encerrado',
    texto: 'O link foi cancelado de propósito. Se ainda precisar testar, é só pedir outro.',
  },
  inexistente: {
    icone: HelpCircle,
    titulo: 'Endereço não encontrado',
    texto: 'Esse link não existe. Confira se veio completo — a última parte é longa e às vezes quebra ao ser copiada de um aplicativo de mensagem.',
  },
  falha: {
    icone: AlertOctagon,
    titulo: 'Não conseguimos abrir a sessão',
    texto: 'O link está válido, mas falhamos ao preparar o acesso. Isto é problema nosso: nos avise que resolvemos.',
  },
}

export default async function SessaoEncerradaPage({ searchParams }: Props) {
  const { motivo } = await searchParams
  const m = MOTIVOS[motivo ?? ''] ?? MOTIVOS.inexistente
  const Icone = m.icone

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
          <Icone size={22} className="text-gray-400" />
        </div>
        <h1 className="text-lg font-bold text-gray-900">{m.titulo}</h1>
        <p className="text-sm text-gray-600 leading-relaxed mt-2">{m.texto}</p>
        <p className="text-[11px] text-gray-400 mt-5">
          AluguelCuiabá · integração Maximiza
        </p>
      </div>
    </div>
  )
}
