import { marcaDe } from '@/lib/seguros/marcas'
import { statusAprovado, statusPendente } from '@/lib/seguros/tabelas'

interface Props {
  sigla: string
  status: number | null
}

/**
 * Selo compacto de uma seguradora na listagem.
 *
 * Duas informações no mesmo elemento, sem competir:
 *  · a COR é da marca — identifica a seguradora à distância;
 *  · o ANEL é semântico — verde aprovou, âmbar analisa, vermelho recusou.
 *
 * Quem ainda não respondeu fica esmaecido, então quatro selos contam a
 * história da análise inteira sem uma palavra.
 */
export function BandeiraSeguradora({ sigla, status }: Props) {
  const marca = marcaDe(sigla)
  const aprovado = statusAprovado(status)
  const pendente = statusPendente(status)

  const anel = aprovado
    ? 'ring-2 ring-emerald-400'
    : pendente
      ? 'ring-2 ring-amber-300'
      : status === null
        ? 'ring-1 ring-gray-200'
        : 'ring-2 ring-rose-300'

  const titulo = aprovado ? 'aprovou' : pendente ? 'analisando' : status === null ? 'sem parecer' : 'recusou'

  return (
    <span
      title={`${marca.nome} — ${titulo}`}
      className={`inline-grid place-items-center w-8 h-8 rounded-lg text-[10px] font-black ${anel} ${
        pendente || status === null ? 'opacity-55' : ''
      }`}
      style={{ backgroundColor: marca.corFundo, color: marca.cor }}
    >
      {marca.curto}
    </span>
  )
}
